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
    await this.client
      .from("whatsapp_accounts")
      .update({ last_successful_webhook_at: new Date().toISOString() })
      .eq("organization_id", row.organization_id)
      .eq("id", row.account_id);
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

  async release(organizationId: string, deliveryId: string, errorCode: string) {
    const result = await this.client.rpc("release_whatsapp_delivery", {
      p_delivery_id: deliveryId,
      p_error_code: errorCode,
      p_organization_id: organizationId,
    });
    return result.error === null && result.data === true;
  }

  async consumeRateLimit(
    organizationId: string,
    action: "whatsapp_account" | "whatsapp_sender" | "whatsapp_agent",
    subjectDigest: string,
  ) {
    const limits = {
      whatsapp_account: [200, 3600],
      whatsapp_sender: [50, 3600],
      whatsapp_agent: [20, 3600],
    } as const;
    const [limit, window] = limits[action];
    const result = await this.client.rpc("consume_public_rate_limit", {
      p_action: action,
      p_limit: limit,
      p_organization_id: organizationId,
      p_subject_digest: subjectDigest,
      p_window_seconds: window,
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

  async completeWithoutReply(organizationId: string, deliveryId: string) {
    const result = await this.client.rpc("complete_whatsapp_handoff_delivery", {
      p_delivery_id: deliveryId,
      p_organization_id: organizationId,
    });
    return result.error === null && result.data === true;
  }

  async claimOutbound(organizationId: string, inboundDeliveryId: string) {
    const result = await this.client.rpc("claim_whatsapp_outbound", {
      p_inbound_delivery_id: inboundDeliveryId,
      p_organization_id: organizationId,
    });
    const row = result.data?.[0];
    return result.error || !row
      ? null
      : { id: row.delivery_id, content: row.message_content };
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
    const outcome = result.ok
      ? "sent"
      : result.code === "meta_rate_limited"
        ? "retryable"
        : result.code === "meta_timeout" || result.code === "meta_server_error"
          ? "delivery_unknown"
          : "failed";
    const recorded = await this.client.rpc("record_whatsapp_send_result", {
      p_delivery_id: outboundDeliveryId,
      p_error_code: result.ok ? undefined : result.code,
      p_organization_id: organizationId,
      p_outcome: outcome,
      p_provider_message_id: result.ok ? result.providerMessageId : undefined,
    });
    if (result.ok)
      await this.client
        .from("whatsapp_accounts")
        .update({
          last_successful_outbound_at: new Date().toISOString(),
          connection_status: "active",
          last_error_code: null,
        })
        .eq("organization_id", organizationId)
        .eq(
          "id",
          (
            await this.client
              .from("whatsapp_message_deliveries")
              .select("whatsapp_account_id")
              .eq("organization_id", organizationId)
              .eq("id", outboundDeliveryId)
              .maybeSingle()
          ).data?.whatsapp_account_id ?? "",
        )
        .eq("mode", "production");
    if (!result.ok && result.code === "meta_billing_required") {
      const delivery = await this.client
        .from("whatsapp_message_deliveries")
        .select("whatsapp_account_id")
        .eq("organization_id", organizationId)
        .eq("id", outboundDeliveryId)
        .maybeSingle();
      if (delivery.data)
        await this.client
          .from("whatsapp_accounts")
          .update({
            billing_status: "action_required",
            connection_status: "billing_required",
            last_error_code: "meta_billing_required",
          })
          .eq("organization_id", organizationId)
          .eq("id", delivery.data.whatsapp_account_id);
    }
    return recorded.error === null && recorded.data === true;
  }

  async updateStatus(input: Parameters<WhatsAppRepository["updateStatus"]>[0]) {
    await this.client.rpc("update_whatsapp_delivery_status", {
      p_error_code: input.errorCode ?? undefined,
      p_phone_number_id: input.phoneNumberId,
      p_provider_message_id: input.providerMessageId,
      p_status: input.status,
    });
  }

  async resolveAccount(
    input: Parameters<NonNullable<WhatsAppRepository["resolveAccount"]>>[0],
  ) {
    const result = await this.client.rpc("resolve_whatsapp_account", {
      p_whatsapp_business_account_id: input.businessAccountId,
      p_phone_number_id: input.phoneNumberId,
      p_wa_id: input.waId,
    });
    const row = result.data?.[0];
    return result.error || !row
      ? null
      : {
          organizationId: row.organization_id,
          accountId: row.account_id,
          mode: row.mode as "developer_test" | "production",
          billingStatus: row.billing_status as
            "unknown" | "ready" | "action_required" | "not_applicable",
          recipientAllowed: row.recipient_allowed,
        };
  }

  async getOutboundConnection(organizationId: string, accountId: string) {
    const account = await this.client
      .from("whatsapp_accounts")
      .select(
        "phone_number_id,graph_api_version,mode,connection_status,billing_status",
      )
      .eq("organization_id", organizationId)
      .eq("id", accountId)
      .eq("is_active", true)
      .in("connection_status", [
        "connected",
        "test_pending",
        "active",
        "degraded",
      ])
      .maybeSingle();
    if (!account.data) return null;
    const credential = await this.client
      .from("whatsapp_credential_envelopes")
      .select("key_version,ciphertext,initialization_vector,authentication_tag")
      .eq("organization_id", organizationId)
      .eq("whatsapp_account_id", accountId)
      .eq("credential_kind", "cloud_api_access_token")
      .maybeSingle();
    return {
      graphApiVersion: account.data.graph_api_version ?? "",
      phoneNumberId: account.data.phone_number_id,
      mode: account.data.mode as "developer_test" | "production",
      billingStatus: account.data.billing_status as
        "unknown" | "ready" | "action_required" | "not_applicable",
      keyVersion: credential.data?.key_version ?? null,
      ciphertext: credential.data?.ciphertext ?? null,
      initializationVector: credential.data?.initialization_vector ?? null,
      authenticationTag: credential.data?.authentication_tag ?? null,
    };
  }

  async recordOptOut(
    organizationId: string,
    accountId: string,
    recipientDigest: string,
    traceId: string,
  ) {
    const result = await this.client.rpc("record_whatsapp_opt_out", {
      p_organization_id: organizationId,
      p_whatsapp_account_id: accountId,
      p_recipient_digest: recipientDigest,
      p_trace_id: traceId,
    });
    return result.error === null && result.data === true;
  }
}
