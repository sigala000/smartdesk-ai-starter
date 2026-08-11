import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { MetaWhatsAppClient } from "@/lib/meta/whatsapp-client";
import type { PublicDraft } from "@/lib/dto/public-conversation-dto";
import type { WhatsAppWebhookEvent } from "@/lib/schemas/whatsapp-webhook";
import type { WhatsAppRepository } from "@/lib/repositories/whatsapp-repository";
import type { PublicConversationService } from "@/lib/services/public-conversation-service";

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stableUuid(value: string) {
  const bytes = Buffer.from(digest(value).slice(0, 32), "hex");
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const explicitConfirmation = /^(confirm|confirmed|yes,? submit|submit)$/i;

function requestSummary(draft: PublicDraft) {
  return [
    "Please review your request:",
    `Name: ${draft.customerName}`,
    `Contact: ${draft.phone}`,
    `Service: ${draft.serviceName}`,
    `Description: ${draft.description}`,
    `Location: ${draft.location}`,
    `Email: ${draft.email ?? "Not provided"}`,
    `Preferred start: ${draft.preferredStartDate ?? "Not provided"}`,
    `Budget: ${draft.budgetMin == null ? "Not provided" : `${draft.budgetMin}${draft.budgetMax !== draft.budgetMin ? `-${draft.budgetMax}` : ""} XAF`}`,
    "Reply Confirm to submit, or describe the field you want to correct.",
  ].join("\n");
}

export class WhatsAppChannelService {
  constructor(
    private readonly repository: WhatsAppRepository,
    private readonly conversations: PublicConversationService,
    private readonly sender: MetaWhatsAppClient,
    private readonly config: Readonly<{
      phoneNumberId: string;
      businessAccountId: string;
      testRecipient: string;
    }>,
  ) {}

  async handle(event: WhatsAppWebhookEvent, traceId = randomUUID()) {
    if (event.kind === "status") {
      if (event.phoneNumberId === this.config.phoneNumberId)
        await this.repository.updateStatus(event);
      return { accepted: true as const, processed: false };
    }
    if (
      event.phoneNumberId !== this.config.phoneNumberId ||
      event.businessAccountId !== this.config.businessAccountId ||
      event.waId !== this.config.testRecipient
    )
      return { accepted: true as const, processed: false };

    const ingested = await this.repository.ingest({
      phoneNumberId: event.phoneNumberId,
      businessAccountId: event.businessAccountId,
      waId: event.waId,
      profileName: event.profileName,
      providerMessageId: event.providerMessageId,
      providerTimestamp: event.timestamp.toISOString(),
      clientMessageId: stableUuid(`inbound:${event.providerMessageId}`),
      accessTokenDigest: digest(randomBytes(32).toString("hex")),
      traceId,
    });
    if (!ingested) return { accepted: false as const, processed: false };
    if (event.messageType !== "text" || !event.text) {
      await this.repository.markUnsupported(
        ingested.organizationId,
        ingested.deliveryId,
      );
      return { accepted: true as const, processed: false };
    }
    if (
      !(await this.repository.claim(
        ingested.organizationId,
        ingested.deliveryId,
      ))
    )
      return { accepted: true as const, processed: false, duplicate: true };

    const subjectDigest = digest(`${ingested.accountId}:${event.waId}`);
    const current = await this.conversations.channelContext(
      ingested.conversationId,
      ingested.tokenDigest,
    );
    if (!current.ok) return { accepted: false as const, processed: false };

    if (
      current.value.conversation.draft.stage === "review" &&
      explicitConfirmation.test(event.text)
    ) {
      const stored = await this.conversations.ensureChannelCustomerMessage(
        ingested.conversationId,
        ingested.tokenDigest,
        ingested.clientMessageId,
        event.text,
      );
      if (!stored.ok) return { accepted: false as const, processed: false };
      const nonce = Buffer.from(
        digest(
          `whatsapp-confirm:${ingested.tokenDigest}:${current.value.conversation.draft.version}`,
        ),
        "hex",
      ).toString("base64url");
      const nonceDigest = digest(nonce);
      const ready = await this.repository.summaryReady(
        ingested.organizationId,
        ingested.conversationId,
        current.value.conversation.draft.version,
        nonceDigest,
      );
      if (!ready) {
        const summary = await this.conversations.summary(
          ingested.conversationId,
          ingested.tokenDigest,
          nonceDigest,
          subjectDigest,
        );
        if (!summary.ok) return { accepted: false as const, processed: false };
        await this.conversations.recordChannelReply(
          current.value,
          ingested.clientMessageId,
          event.text,
          requestSummary(current.value.conversation.draft),
        );
      } else {
        const confirmed = await this.conversations.confirm(
          ingested.conversationId,
          ingested.tokenDigest,
          nonceDigest,
          {
            confirmation: true,
            confirmationNonce: nonce,
            idempotencyKey: stableUuid(
              `confirm:${ingested.conversationId}:${current.value.conversation.draft.version}`,
            ),
          },
          subjectDigest,
        );
        if (!confirmed.ok)
          return { accepted: false as const, processed: false };
        if (
          !(await this.repository.restoreConversationAccess(
            ingested.organizationId,
            ingested.conversationId,
          ))
        )
          return { accepted: false as const, processed: false };
        await this.conversations.recordChannelReply(
          current.value,
          ingested.clientMessageId,
          event.text,
          `Your request has been submitted successfully. Your reference is ${confirmed.value.referenceNumber}.`,
        );
      }
    } else {
      const input =
        current.value.conversation.draft.stage === "confirm_phone"
          ? ({
              kind: "answer" as const,
              clientMessageId: ingested.clientMessageId,
              value: event.text,
            } as const)
          : ({
              kind: "message" as const,
              clientMessageId: ingested.clientMessageId,
              message: event.text,
            } as const);
      const result = await this.conversations.message(
        ingested.conversationId,
        ingested.tokenDigest,
        input,
        subjectDigest,
      );
      if (!result.ok) return { accepted: false as const, processed: false };
    }

    const reply = await this.repository.findAssistantReply(
      ingested.organizationId,
      ingested.conversationId,
      ingested.clientMessageId,
    );
    if (!reply) return { accepted: false as const, processed: false };
    const outboundId = await this.repository.complete(
      ingested.organizationId,
      ingested.deliveryId,
      reply.id,
      traceId,
    );
    if (!outboundId) return { accepted: false as const, processed: false };
    const sent = await this.sender.sendText(event.waId, reply.content);
    await this.repository.recordSendResult(
      ingested.organizationId,
      outboundId,
      sent,
    );
    return {
      accepted: true as const,
      processed: true,
      delivered: sent.ok,
      traceId,
    };
  }
}
