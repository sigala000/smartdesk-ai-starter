import "server-only";

import { SupabasePublicConversationRepository } from "@/lib/repositories/supabase-public-conversation-repository";
import { PublicConversationService } from "@/lib/services/public-conversation-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOpenAIConfig } from "@/lib/config/env-schema";
import { serverEnvironment } from "@/lib/config/env-server";
import { OpenAIResponsesClient } from "@/lib/openai/responses-client";
import { AgentOrchestrator } from "@/lib/agent/orchestrator";
import { ToolExecutor } from "@/lib/agent/tool-executor";
import { saveConversationFieldsSchema } from "@/lib/agent/tool-schemas";
import { requestHumanSupportSchema } from "@/lib/agent/tool-schemas";
import { serverAgentObserver } from "@/lib/agent/observability";
import { SupabaseHandoffRepository } from "@/lib/repositories/supabase-handoff-repository";
import { HandoffService } from "@/lib/services/handoff-service";
import { classifyEscalation } from "@/lib/domain/handoffs";
import { getRequestStatusSchema } from "@/lib/agent/tool-schemas";
import { createRequestStatusRuntime } from "@/lib/services/request-status-runtime";

export function createPublicConversationRuntime() {
  const admin = createAdminClient();
  const repository = new SupabasePublicConversationRepository(admin);
  const handoffs = new HandoffService(new SupabaseHandoffRepository(admin));
  const openAI = requireOpenAIConfig(serverEnvironment);
  const serviceHolder: { current?: PublicConversationService } = {};
  const executor = new ToolExecutor({
    async searchCompanyInformation(context, question) {
      const words = question.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
      const matches = context.knowledge
        .filter((item) =>
          words.some((word) =>
            `${item.title} ${item.content}`.toLowerCase().includes(word),
          ),
        )
        .slice(0, 3);
      const services = context.conversation.services
        .filter((service) =>
          words.some((word) =>
            `${service.name} ${service.description ?? ""}`
              .toLowerCase()
              .includes(word),
          ),
        )
        .slice(0, 3);
      return {
        found: matches.length + services.length > 0,
        sources: matches.map(({ id, title, content }) => ({
          id,
          title,
          excerpt: content.slice(0, 600),
        })),
        services,
      };
    },
    async saveConversationFields(context, input, customerMessage) {
      const parsed = saveConversationFieldsSchema.safeParse(input);
      return parsed.success
        ? (serviceHolder.current?.saveAgentFields(
            context,
            parsed.data,
            customerMessage,
          ) ?? {
            success: false,
            errorCode: "internal_error",
          })
        : { success: false, errorCode: "invalid_tool_arguments" };
    },
    async requestHumanSupport(context, input, customerMessage) {
      const parsed = requestHumanSupportSchema.safeParse(input);
      if (!parsed.success)
        return { success: false, errorCode: "invalid_tool_arguments" };
      const detected = classifyEscalation(customerMessage);
      const result = await handoffs.requestPublic(
        context.conversationId,
        context.tokenDigest,
        crypto.randomUUID(),
        {
          priority: detected?.priority ?? "normal",
          reason:
            detected?.reason ??
            "The virtual assistant could not safely complete the customer request.",
          reasonCode: detected?.reasonCode ?? "unsupported_information",
        },
      );
      return result.ok
        ? {
            success: true,
            handoffId: result.value.id,
            status: result.value.status,
          }
        : { success: false, errorCode: result.code };
    },
    async getRequestStatus(context, input) {
      const parsed = getRequestStatusSchema.safeParse(input);
      if (!parsed.success)
        return { success: false, errorCode: "invalid_tool_arguments" };
      try {
        const result = await createRequestStatusRuntime().statusForConversation(
          {
            reference: parsed.data.referenceNumber,
            organizationId: context.organizationId,
            conversationId: context.conversationId,
          },
        );
        return result.ok
          ? { success: true, verified: true, ...result.value }
          : { success: false, verified: false, errorCode: result.code };
      } catch {
        return {
          success: false,
          verified: false,
          errorCode: "service_unavailable",
        };
      }
    },
  });
  const provider = openAI
    ? new OpenAIResponsesClient(
        openAI.apiKey,
        openAI.model,
        openAI.maxOutputTokens,
      )
    : null;
  const orchestrator = new AgentOrchestrator(
    provider,
    executor,
    {
      historyMessages: openAI?.historyMessages ?? 16,
      inputCharacters: openAI?.inputCharacters ?? 12_000,
      maxToolCalls: openAI?.maxToolCalls ?? 4,
      timeoutMs: openAI?.timeoutMs ?? 15_000,
      maxTokensPerTurn: openAI?.maxTokensPerTurn ?? 8_000,
    },
    serverAgentObserver,
  );
  const service = new PublicConversationService(
    repository,
    orchestrator,
    handoffs,
  );
  serviceHolder.current = service;
  return service;
}
