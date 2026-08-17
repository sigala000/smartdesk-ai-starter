export type WhatsAppIngestResult = Readonly<{
  created: boolean;
  organizationId: string;
  accountId: string;
  identityId: string;
  conversationId: string;
  tokenDigest: string;
  deliveryId: string;
  clientMessageId: string;
  status: string;
}>;

export interface WhatsAppRepository {
  ingest(
    input: Readonly<{
      phoneNumberId: string;
      businessAccountId: string;
      waId: string;
      profileName: string | null;
      providerMessageId: string;
      providerTimestamp: string;
      clientMessageId: string;
      accessTokenDigest: string;
      traceId: string;
    }>,
  ): Promise<WhatsAppIngestResult | null>;
  claim(organizationId: string, deliveryId: string): Promise<boolean>;
  release(
    organizationId: string,
    deliveryId: string,
    errorCode: string,
  ): Promise<boolean>;
  consumeRateLimit(
    organizationId: string,
    action: "whatsapp_account" | "whatsapp_sender" | "whatsapp_agent",
    subjectDigest: string,
  ): Promise<boolean>;
  summaryReady(
    organizationId: string,
    conversationId: string,
    draftVersion: number,
    nonceDigest: string,
  ): Promise<boolean>;
  restoreConversationAccess(
    organizationId: string,
    conversationId: string,
  ): Promise<boolean>;
  findAssistantReply(
    organizationId: string,
    conversationId: string,
    clientMessageId: string,
  ): Promise<{ id: string; content: string } | null>;
  complete(
    organizationId: string,
    deliveryId: string,
    assistantMessageId: string,
    traceId: string,
  ): Promise<string | null>;
  completeWithoutReply?(
    organizationId: string,
    deliveryId: string,
  ): Promise<boolean>;
  claimOutbound(
    organizationId: string,
    inboundDeliveryId: string,
  ): Promise<{ id: string; content: string } | null>;
  markUnsupported(organizationId: string, deliveryId: string): Promise<void>;
  recordSendResult(
    organizationId: string,
    outboundDeliveryId: string,
    result:
      { ok: true; providerMessageId: string } | { ok: false; code: string },
  ): Promise<boolean>;
  updateStatus(
    input: Readonly<{
      phoneNumberId: string;
      providerMessageId: string;
      status: string;
      errorCode: string | null;
    }>,
  ): Promise<void>;
}
