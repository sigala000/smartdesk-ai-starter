import type { SupabaseClient } from "@supabase/supabase-js";

import type { WhatsAppRepository } from "@/lib/repositories/whatsapp-repository";
import type { Database } from "@/lib/supabase/database.types";

export class SupabaseWhatsAppRepository implements WhatsAppRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async ingest(input: Parameters<WhatsAppRepository["ingest"]>[0]) {
    const result = await this.client.rpc("ingest_whatsapp_text_message", {
      p_access_token_digest: input.accessTokenDigest,
      p_client_message_id: input.clientMessageId,
      p_phone_number_id: input.phoneNumberId,
      p_whatsapp_business_account_id: input.businessAccountId,
      p_profile_name: input.profileName ?? "",
      p_provider_message_id: input.providerMessageId,
      p_provider_timestamp: input.providerTimestamp,
      p_trace_id: input.traceId,
      p_wa_id: input.waId,
    });
    const row = result.data?.[0];
    if (result.error || !row) return null;
    return {
      created: row.created,
      organizationId: row.organization_id,
      accountId: row.account_id,
      identityId: row.identity_id,
      conversationId: row.conversation_id,
      tokenDigest: row.access_token_digest,
      deliveryId: row.delivery_id,
      clientMessageId: row.client_message_id,
      status: row.delivery_status,
    };
  }

  async claim(organizationId: string, deliveryId: string) {
    const result = await this.client.rpc("claim_whatsapp_delivery", {
      p_delivery_id: deliveryId,
      p_organization_id: organizationId,
    });
    return result.error === null && result.data === true;
  }

  async summaryReady(
    organizationId: string,
    conversationId: string,
    draftVersion: number,
    nonceDigest: string,
  ) {
    const result = await this.client
      .from("conversation_drafts")
      .select("conversation_id")
      .eq("organization_id", organizationId)
      .eq("conversation_id", conversationId)
      .eq("version", draftVersion)
      .eq("summary_version", draftVersion)
      .eq("confirmation_nonce_digest", nonceDigest)
      .gt("confirmation_nonce_expires_at", new Date().toISOString())
      .maybeSingle();
    return result.error === null && result.data !== null;
  }

  async restoreConversationAccess(
    organizationId: string,
    conversationId: string,
  ) {
    const result = await this.client.rpc(
      "restore_whatsapp_conversation_access",
      {
        p_conversation_id: conversationId,
        p_organization_id: organizationId,
      },
    );
    return result.error === null && result.data === true;
  }

  async findAssistantReply(
    organizationId: string,
    conversationId: string,
    clientMessageId: string,
  ) {
    const customer = await this.client
      .from("messages")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("conversation_id", conversationId)
      .eq("client_message_id", clientMessageId)
      .maybeSingle();
    if (!customer.data) return null;
    const reply = await this.client
      .from("messages")
      .select("id,content")
      .eq("organization_id", organizationId)
      .eq("conversation_id", conversationId)
      .eq("reply_to_message_id", customer.data.id)
      .maybeSingle();
    return reply.data ?? null;
  }

  async complete(
    organizationId: string,
    deliveryId: string,
    assistantMessageId: string,
    traceId: string,
  ) {
    const result = await this.client.rpc("complete_whatsapp_delivery", {
      p_delivery_id: deliveryId,
      p_message_id: assistantMessageId,
      p_organization_id: organizationId,
      p_trace_id: traceId,
    });
    return result.error ? null : result.data;
  }

  async markUnsupported(organizationId: string, deliveryId: string) {
    await this.client
      .from("whatsapp_message_deliveries")
      .update({ status: "unsupported", last_error_code: "unsupported_type" })
      .eq("organization_id", organizationId)
      .eq("id", deliveryId)
      .eq("direction", "inbound");
  }

  async recordSendResult(
    organizationId: string,
    outboundDeliveryId: string,
    result: Parameters<WhatsAppRepository["recordSendResult"]>[2],
  ) {
    await this.client
      .from("whatsapp_message_deliveries")
      .update(
        result.ok
          ? {
              provider_message_id: result.providerMessageId,
              status: "sent",
              attempt_count: 1,
              next_attempt_at: null,
              last_error_code: null,
            }
          : {
              status: "failed",
              attempt_count: 1,
              next_attempt_at: null,
              last_error_code: result.code,
            },
      )
      .eq("organization_id", organizationId)
      .eq("id", outboundDeliveryId)
      .eq("status", "queued");
  }

  async updateStatus(input: Parameters<WhatsAppRepository["updateStatus"]>[0]) {
    await this.client.rpc("update_whatsapp_delivery_status", {
      p_error_code: input.errorCode ?? undefined,
      p_phone_number_id: input.phoneNumberId,
      p_provider_message_id: input.providerMessageId,
      p_status: input.status,
    });
  }
}
