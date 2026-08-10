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
    ].includes(code)
  )
    return {
      code: "conflict",
      message:
        code === "draft_incomplete"
          ? "Complete the required questions before confirming."
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
    if (input.kind === "message") {
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
