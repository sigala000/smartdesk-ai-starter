import type { PublicConversationRepository } from "@/lib/repositories/public-conversation-repository";
import type {
  ConfirmRequestInput,
  EditDraftInput,
  PublicMessageInput,
} from "@/lib/schemas/public-conversation-api";
import type { AgentOrchestrator } from "@/lib/agent/orchestrator";
import type { TrustedAgentContext } from "@/lib/agent/types";
import type { z } from "zod";
import { saveConversationFieldsSchema } from "@/lib/agent/tool-schemas";
import {
  classifyEscalation,
  type EscalationDecision,
} from "@/lib/domain/handoffs";
import type { HandoffService } from "@/lib/services/handoff-service";

export type PublicConversationError = Readonly<{
  code:
    | "not_found"
    | "validation_error"
    | "conflict"
    | "rate_limited"
    | "internal_error";
  message: string;
}>;

function mapFailure(code: string): PublicConversationError {
  if (code === "organization_not_found" || code === "conversation_not_found")
    return {
      code: "not_found",
      message: "This conversation is unavailable. Start a new chat.",
    };
  if (code.startsWith("invalid_"))
    return {
      code: "validation_error",
      message: "That answer is not valid for the current question.",
    };
  if (
    [
      "draft_incomplete",
      "confirmation_nonce_invalid",
      "service_unavailable",
      "routing_unavailable",
      "idempotency_conflict",
      "stale_draft",
      "conversation_closed",
      "attachment_upload_in_progress",
    ].includes(code)
  )
    return {
      code: "conflict",
      message:
        code === "draft_incomplete"
          ? "Complete the required questions before confirming."
          : code === "attachment_upload_in_progress"
            ? "Wait for the attachment upload to finish or remove it before confirming."
            : "The conversation changed. Refresh and try again.",
    };
  return {
    code: "internal_error",
    message: "The conversation could not be completed. Please try again.",
  };
}

export class PublicConversationService {
  constructor(
    private readonly repository: PublicConversationRepository,
    private readonly orchestrator?: AgentOrchestrator,
    private readonly handoffs?: HandoffService,
  ) {}

  async create(slug: string, tokenDigest: string, subjectDigest: string) {
    if (
      !(await this.repository.consumeRateLimit(
        null,
        "create_conversation",
        subjectDigest,
      ))
    )
      return {
        ok: false as const,
        error: {
          code: "rate_limited",
          message: "Too many chats were started. Please try again later.",
        } satisfies PublicConversationError,
      };
    const result = await this.repository.create(slug, tokenDigest);
    return result.ok
      ? result
      : { ok: false as const, error: mapFailure(result.code) };
  }

  async requestHandoff(
    id: string,
    tokenDigest: string,
    idempotencyKey: string,
    decision: EscalationDecision,
  ) {
    if (!this.handoffs)
      return { ok: false as const, error: mapFailure("internal_error") };
    const result = await this.handoffs.requestPublic(
      id,
      tokenDigest,
      idempotencyKey,
      decision,
    );
    return result.ok
      ? result
      : { ok: false as const, error: mapFailure(result.code) };
  }

  async view(id: string, tokenDigest: string) {
    const result = await this.repository.view(id, tokenDigest);
    return result.ok
      ? result
      : { ok: false as const, error: mapFailure(result.code) };
  }

  async message(
    id: string,
    tokenDigest: string,
    input: PublicMessageInput,
    subjectDigest: string,
  ) {
    if (
      !(await this.repository.consumeRateLimit(null, "message", subjectDigest))
    )
      return {
        ok: false as const,
        error: {
          code: "rate_limited",
          message: "Too many messages were sent. Please wait and try again.",
        } satisfies PublicConversationError,
      };
    if (input.kind === "answer") {
      const escalation = classifyEscalation(input.value);
      if (escalation && this.handoffs) {
        const requested = await this.handoffs.requestPublic(
          id,
          tokenDigest,
          input.clientMessageId,
          escalation,
        );
        if (!requested.ok)
          return { ok: false as const, error: mapFailure(requested.code) };
        if (this.repository.recordHandoffCustomerMessage) {
          const recorded = await this.repository.recordHandoffCustomerMessage(
            id,
            tokenDigest,
            input.clientMessageId,
            input.value,
          );
          if (!recorded.ok)
            return { ok: false as const, error: mapFailure(recorded.code) };
          if (recorded.value)
            return { ok: true as const, value: recorded.value };
        }
      }
    }
    if (input.kind === "message") {
      const escalation = classifyEscalation(input.message);
      if (escalation && this.handoffs) {
        const requested = await this.handoffs.requestPublic(
          id,
          tokenDigest,
          input.clientMessageId,
          escalation,
        );
        if (!requested.ok)
          return { ok: false as const, error: mapFailure(requested.code) };
      }
      if (this.repository.recordHandoffCustomerMessage) {
        const handedOff = await this.repository.recordHandoffCustomerMessage(
          id,
          tokenDigest,
          input.clientMessageId,
          input.message,
        );
        if (!handedOff.ok)
          return { ok: false as const, error: mapFailure(handedOff.code) };
        if (handedOff.value)
          return { ok: true as const, value: handedOff.value };
      }
      if (this.repository.recordRequestFollowUp) {
        const followUp = await this.repository.recordRequestFollowUp(
          id,
          tokenDigest,
          input.clientMessageId,
          input.message,
        );
        if (!followUp.ok)
          return { ok: false as const, error: mapFailure(followUp.code) };
        if (followUp.value) return { ok: true as const, value: followUp.value };
      }
      const existing = await this.repository.existingAgentExchange(
        id,
        tokenDigest,
        input.clientMessageId,
        input.message,
      );
      if (!existing.ok)
        return { ok: false as const, error: mapFailure(existing.code) };
      if (existing.value) return { ok: true as const, value: existing.value };
      const context = await this.repository.agentContext(id, tokenDigest);
      if (!context.ok)
        return { ok: false as const, error: mapFailure(context.code) };
      const outcome = this.orchestrator
        ? await this.orchestrator.run(context.value, input.message)
        : {
            text: context.value.conversation.prompt,
            fallback: true,
            toolNames: [] as string[],
          };
      const recorded = await this.repository.recordAgentExchange(
        context.value,
        tokenDigest,
        input.clientMessageId,
        input.message,
        outcome.text,
      );
      return recorded.ok
        ? recorded
        : { ok: false as const, error: mapFailure(recorded.code) };
    }
    const result = await this.repository.message(id, tokenDigest, input);
    return result.ok
      ? result
      : { ok: false as const, error: mapFailure(result.code) };
  }

  async saveAgentFields(
    context: TrustedAgentContext,
    input: z.infer<typeof saveConversationFieldsSchema>,
    customerMessage: string,
  ) {
    const result = await this.repository.saveAgentFields(
      context,
      input,
      customerMessage,
    );
    return result.ok
      ? { success: true, draft: result.value.conversation.draft }
      : { success: false, errorCode: result.code };
  }

  async channelContext(id: string, tokenDigest: string) {
    return this.repository.agentContext(id, tokenDigest);
  }

  async ensureChannelCustomerMessage(
    id: string,
    tokenDigest: string,
    clientMessageId: string,
    message: string,
  ) {
    return this.repository.existingAgentExchange(
      id,
      tokenDigest,
      clientMessageId,
      message,
    );
  }

  async recordChannelReply(
    context: TrustedAgentContext,
    clientMessageId: string,
    customerMessage: string,
    assistantMessage: string,
  ) {
    return this.repository.recordAgentExchange(
      context,
      context.tokenDigest,
      clientMessageId,
      customerMessage,
      assistantMessage,
    );
  }

  async edit(id: string, tokenDigest: string, input: EditDraftInput) {
    const result = await this.repository.edit(id, tokenDigest, input);
    return result.ok
      ? result
      : { ok: false as const, error: mapFailure(result.code) };
  }

  async summary(
    id: string,
    tokenDigest: string,
    nonceDigest: string,
    subjectDigest: string,
  ) {
    if (
      !(await this.repository.consumeRateLimit(null, "summary", subjectDigest))
    )
      return {
        ok: false as const,
        error: {
          code: "rate_limited",
          message: "Please wait before preparing another summary.",
        } satisfies PublicConversationError,
      };
    const result = await this.repository.issueSummary(
      id,
      tokenDigest,
      nonceDigest,
    );
    return result.ok
      ? result
      : { ok: false as const, error: mapFailure(result.code) };
  }

  async confirm(
    id: string,
    tokenDigest: string,
    nonceDigest: string,
    input: ConfirmRequestInput,
    subjectDigest: string,
  ) {
    if (
      !(await this.repository.consumeRateLimit(
        null,
        "confirmation",
        subjectDigest,
      ))
    )
      return {
        ok: false as const,
        error: {
          code: "rate_limited",
          message: "Too many confirmation attempts. Please wait and try again.",
        } satisfies PublicConversationError,
      };
    const result = await this.repository.confirm(
      id,
      tokenDigest,
      nonceDigest,
      input,
    );
    return result.ok
      ? result
      : { ok: false as const, error: mapFailure(result.code) };
  }
}
