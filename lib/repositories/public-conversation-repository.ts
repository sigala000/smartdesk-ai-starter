import type {
  PublicConversationView,
  PublicDraft,
} from "@/lib/dto/public-conversation-dto";
import type {
  ConfirmRequestInput,
  EditDraftInput,
  PublicMessageInput,
} from "@/lib/schemas/public-conversation-api";
import type { TrustedAgentContext } from "@/lib/agent/types";
import type { z } from "zod";
import { saveConversationFieldsSchema } from "@/lib/agent/tool-schemas";

export type PublicRepositoryResult<T> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; code: string }>;

export interface PublicConversationRepository {
  consumeRateLimit(
    organizationId: string | null,
    action: string,
    subjectDigest: string,
  ): Promise<boolean>;
  create(
    organizationSlug: string,
    tokenDigest: string,
  ): Promise<
    PublicRepositoryResult<{
      id: string;
      organizationName: string;
      createdAt: string;
    }>
  >;
  view(
    conversationId: string,
    tokenDigest: string,
  ): Promise<PublicRepositoryResult<PublicConversationView>>;
  message(
    conversationId: string,
    tokenDigest: string,
    input: PublicMessageInput,
  ): Promise<PublicRepositoryResult<PublicConversationView>>;
  agentContext(
    conversationId: string,
    tokenDigest: string,
  ): Promise<PublicRepositoryResult<TrustedAgentContext>>;
  existingAgentExchange(
    conversationId: string,
    tokenDigest: string,
    clientMessageId: string,
    customerMessage: string,
  ): Promise<PublicRepositoryResult<PublicConversationView | null>>;
  saveAgentFields(
    context: TrustedAgentContext,
    input: z.infer<typeof saveConversationFieldsSchema>,
    customerMessage: string,
  ): Promise<PublicRepositoryResult<TrustedAgentContext>>;
  recordAgentExchange(
    context: TrustedAgentContext,
    tokenDigest: string,
    clientMessageId: string,
    customerMessage: string,
    assistantMessage: string,
  ): Promise<PublicRepositoryResult<PublicConversationView>>;
  edit(
    conversationId: string,
    tokenDigest: string,
    input: EditDraftInput,
  ): Promise<PublicRepositoryResult<PublicConversationView>>;
  issueSummary(
    conversationId: string,
    tokenDigest: string,
    nonceDigest: string,
  ): Promise<
    PublicRepositoryResult<{
      conversation: PublicConversationView;
      expiresAt: string;
    }>
  >;
  confirm(
    conversationId: string,
    tokenDigest: string,
    nonceDigest: string,
    input: ConfirmRequestInput,
  ): Promise<
    PublicRepositoryResult<{
      id: string;
      referenceNumber: string;
      status: string;
      createdAt: string;
      replayed: boolean;
    }>
  >;
}

export type { PublicDraft };
