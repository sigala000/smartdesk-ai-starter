import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { MetaSendResult } from "@/lib/meta/whatsapp-client";
import type {
  PublicDraft,
  PublicConversationView,
} from "@/lib/dto/public-conversation-dto";
import type { PublicMessageInput } from "@/lib/schemas/public-conversation-api";
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
const optionalSkip = /^(skip|none|not provided|no)$/i;
const optOut = /^(stop|unsubscribe|opt\s*out|cancel messages|arr[eê]t)$/i;

function deterministicChannelInput(
  conversation: PublicConversationView,
  clientMessageId: string,
  message: string,
): PublicMessageInput {
  const text = message.trim();
  const normalized = text.toLowerCase();
  const stage = conversation.draft.stage;
  if (stage === "choose_action") {
    const action = /quot|devis|estimate|price/.test(normalized)
      ? "request_quotation"
      : /site.{0,8}visit|inspection/.test(normalized)
        ? "request_site_visit"
        : /service|offer|do you do/.test(normalized)
          ? "ask_about_services"
          : /status|track|follow.?up/.test(normalized)
            ? "check_request_status"
            : /problem|complaint|issue|repair/.test(normalized)
              ? "report_problem"
              : null;
    if (action) return { kind: "action", clientMessageId, action };
  }
  if (stage === "choose_service") {
    const service = conversation.services.find((candidate) =>
      normalized.includes(candidate.name.toLowerCase()),
    );
    if (service) return { kind: "answer", clientMessageId, value: service.id };
  }
  if (
    ["collect_email", "collect_start", "collect_budget"].includes(stage) &&
    optionalSkip.test(text)
  )
    return { kind: "skip", clientMessageId };
  if (
    [
      "collect_name",
      "collect_phone",
      "confirm_phone",
      "collect_description",
      "collect_location",
      "collect_email",
      "collect_start",
      "collect_budget",
    ].includes(stage)
  )
    return { kind: "answer", clientMessageId, value: text };
  return { kind: "message", clientMessageId, message: text };
}

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
    private readonly sender: Readonly<{
      sendText(
        recipient: string,
        text: string,
        context?: Readonly<{ organizationId: string; accountId: string }>,
      ): Promise<MetaSendResult>;
    }>,
    private readonly config: Readonly<{
      phoneNumberId: string;
      businessAccountId: string;
      testRecipient?: string;
      testRecipients?: readonly string[];
    }>,
  ) {}

  private async sendOutbound(
    organizationId: string,
    accountId: string,
    inboundDeliveryId: string,
    recipient: string,
    traceId: string,
  ) {
    const outbound = await this.repository.claimOutbound(
      organizationId,
      inboundDeliveryId,
    );
    if (!outbound)
      return { accepted: true as const, processed: false, duplicate: true };
    const sent = await this.sender.sendText(recipient, outbound.content, {
      organizationId,
      accountId,
    });
    const recorded = await this.repository.recordSendResult(
      organizationId,
      outbound.id,
      sent,
    );
    if (!recorded) {
      console.error("whatsapp_send_result_not_persisted", { traceId });
      return { accepted: true as const, processed: true, delivered: false };
    }
    return {
      accepted: sent.ok || sent.code !== "meta_rate_limited",
      processed: true,
      delivered: sent.ok,
      traceId,
    } as const;
  }

  async handle(event: WhatsAppWebhookEvent, traceId = randomUUID()) {
    if (event.kind === "status") {
      await this.repository.updateStatus(event);
      return { accepted: true as const, processed: false };
    }
    const resolved = this.repository.resolveAccount
      ? await this.repository.resolveAccount({
          phoneNumberId: event.phoneNumberId,
          businessAccountId: event.businessAccountId,
          waId: event.waId,
        })
      : null;
    const legacyRecipients =
      this.config.testRecipients ??
      (this.config.testRecipient ? [this.config.testRecipient] : []);
    const legacyMatches =
      event.phoneNumberId === this.config.phoneNumberId &&
      event.businessAccountId === this.config.businessAccountId &&
      legacyRecipients.includes(event.waId);
    if (!(resolved?.recipientAllowed || legacyMatches)) {
      console.info("whatsapp_event_ignored", {
        traceId,
        code: "destination_mismatch",
        phoneNumberMatches: event.phoneNumberId === this.config.phoneNumberId,
        businessAccountMatches:
          event.businessAccountId === this.config.businessAccountId,
        testRecipientMatches: legacyRecipients.includes(event.waId),
      });
      return { accepted: true as const, processed: false };
    }

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
    ) {
      if (ingested.status === "processing" || ingested.status === "received")
        return { accepted: false as const, processed: false, duplicate: true };
      if (ingested.status === "processed")
        return this.sendOutbound(
          ingested.organizationId,
          ingested.accountId,
          ingested.deliveryId,
          event.waId,
          traceId,
        );
      return { accepted: true as const, processed: false, duplicate: true };
    }

    const fail = async (code: string) => {
      await this.repository.release(
        ingested.organizationId,
        ingested.deliveryId,
        code,
      );
      return { accepted: false as const, processed: false };
    };

    if (optOut.test(event.text) && this.repository.recordOptOut) {
      const recipientDigest = digest(`${ingested.accountId}:${event.waId}`);
      if (
        !(await this.repository.recordOptOut(
          ingested.organizationId,
          ingested.accountId,
          recipientDigest,
          traceId,
        ))
      )
        return fail("opt_out_failed");
      const current = await this.conversations.channelContext(
        ingested.conversationId,
        ingested.tokenDigest,
      );
      if (!current.ok) return fail("context_unavailable");
      const recorded = await this.conversations.recordChannelReply(
        current.value,
        ingested.clientMessageId,
        event.text,
        "You have been opted out of business-initiated WhatsApp messages. You can still contact us when you need help.",
      );
      if (!recorded.ok) return fail("opt_out_reply_failed");
      const reply = await this.repository.findAssistantReply(
        ingested.organizationId,
        ingested.conversationId,
        ingested.clientMessageId,
      );
      if (!reply) return fail("assistant_reply_missing");
      const outboundId = await this.repository.complete(
        ingested.organizationId,
        ingested.deliveryId,
        reply.id,
        traceId,
      );
      if (!outboundId) return fail("outbound_intent_failed");
      return this.sendOutbound(
        ingested.organizationId,
        ingested.accountId,
        ingested.deliveryId,
        event.waId,
        traceId,
      );
    }

    const subjectDigest = digest(`${ingested.accountId}:${event.waId}`);
    const current = await this.conversations.channelContext(
      ingested.conversationId,
      ingested.tokenDigest,
    );
    if (!current.ok) return fail("context_unavailable");

    const accountAllowed = await this.repository.consumeRateLimit(
      ingested.organizationId,
      "whatsapp_account",
      digest(ingested.accountId),
    );
    const senderAllowed = await this.repository.consumeRateLimit(
      ingested.organizationId,
      "whatsapp_sender",
      subjectDigest,
    );
    const agentAllowed = await this.repository.consumeRateLimit(
      ingested.organizationId,
      "whatsapp_agent",
      subjectDigest,
    );
    if (!accountAllowed || !senderAllowed || !agentAllowed) {
      const limited = await this.conversations.recordChannelReply(
        current.value,
        ingested.clientMessageId,
        event.text,
        "Too many messages were sent. Please wait and try again.",
      );
      if (!limited.ok) return fail("rate_limit_reply_failed");
    } else if (
      current.value.conversation.draft.stage === "review" &&
      explicitConfirmation.test(event.text)
    ) {
      const stored = await this.conversations.ensureChannelCustomerMessage(
        ingested.conversationId,
        ingested.tokenDigest,
        ingested.clientMessageId,
        event.text,
      );
      if (!stored.ok) return fail("customer_message_failed");
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
        if (!summary.ok) return fail("summary_failed");
        const recorded = await this.conversations.recordChannelReply(
          current.value,
          ingested.clientMessageId,
          event.text,
          requestSummary(current.value.conversation.draft),
        );
        if (!recorded.ok) return fail("summary_reply_failed");
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
        if (!confirmed.ok) return fail("confirmation_failed");
        if (
          !(await this.repository.restoreConversationAccess(
            ingested.organizationId,
            ingested.conversationId,
          ))
        )
          return fail("access_restore_failed");
        const recorded = await this.conversations.recordChannelReply(
          current.value,
          ingested.clientMessageId,
          event.text,
          `Your request has been submitted successfully. Your reference is ${confirmed.value.referenceNumber}.`,
        );
        if (!recorded.ok) return fail("confirmation_reply_failed");
      }
    } else {
      const input = deterministicChannelInput(
        current.value.conversation,
        ingested.clientMessageId,
        event.text,
      );
      const result = await this.conversations.message(
        ingested.conversationId,
        ingested.tokenDigest,
        input,
        subjectDigest,
      );
      if (!result.ok) return fail("conversation_failed");
      if (result.value.handoffStatus) {
        const completed = await this.repository.completeWithoutReply?.(
          ingested.organizationId,
          ingested.deliveryId,
        );
        return completed
          ? {
              accepted: true as const,
              processed: true,
              delivered: false,
              traceId,
            }
          : fail("handoff_completion_failed");
      }
    }

    const reply = await this.repository.findAssistantReply(
      ingested.organizationId,
      ingested.conversationId,
      ingested.clientMessageId,
    );
    if (!reply) return fail("assistant_reply_missing");
    const outboundId = await this.repository.complete(
      ingested.organizationId,
      ingested.deliveryId,
      reply.id,
      traceId,
    );
    if (!outboundId) return fail("outbound_intent_failed");
    return this.sendOutbound(
      ingested.organizationId,
      ingested.accountId,
      ingested.deliveryId,
      event.waId,
      traceId,
    );
  }
}
