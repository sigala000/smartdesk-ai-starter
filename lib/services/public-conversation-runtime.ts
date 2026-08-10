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
import { serverAgentObserver } from "@/lib/agent/observability";

export function createPublicConversationRuntime() {
  const repository = new SupabasePublicConversationRepository(
    createAdminClient(),
  );
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
    },
    serverAgentObserver,
  );
  const service = new PublicConversationService(repository, orchestrator);
  serviceHolder.current = service;
  return service;
}
