import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  RequestStatusRepository,
  StatusTarget,
} from "@/lib/repositories/request-status-repository";
import {
  requestStatuses,
  type RequestStatus,
} from "@/lib/domain/request-status";
import { toCustomerRequestStatus } from "@/lib/dto/request-status-dto";
type Client = SupabaseClient<Database>;
export class SupabaseRequestStatusRepository implements RequestStatusRepository {
  constructor(private readonly client: Client) {}
  async findTarget(slug: string, reference: string) {
    const result = await this.client.rpc("find_status_target", {
      p_organization_slug: slug,
      p_reference_number: reference,
    });
    const target = result.data?.[0];
    if (result.error || !target) return null;
    return {
      organizationId: target.organization_id,
      requestId: target.request_id,
      referenceNumber: target.reference_number,
      phone: target.phone,
      serviceName: target.service_name,
      status: target.status,
      updatedAt: target.updated_at,
    } satisfies StatusTarget;
  }
  async consumeRateLimit(
    organizationId: string | null,
    action: string,
    subjectDigest: string,
    limit: number,
    windowSeconds: number,
  ) {
    const r = await this.client.rpc("consume_public_rate_limit", {
      // The SQL argument is nullable; generated RPC types do not represent
      // nullable function arguments.
      p_organization_id: organizationId as string,
      p_action: action,
      p_subject_digest: subjectDigest,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    return !r.error && r.data === true;
  }
  async createChallenge(
    input: Parameters<RequestStatusRepository["createChallenge"]>[0],
  ) {
    await this.client
      .from("status_verification_challenges")
      .update({ state: "expired" })
      .eq("subject_digest", input.subjectDigest)
      .eq("state", "pending")
      .lte("expires_at", new Date().toISOString());
    const existing = await this.client
      .from("status_verification_challenges")
      .select("id,organization_id,request_id,expires_at")
      .eq("subject_digest", input.subjectDigest)
      .eq("state", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (existing.data)
      return {
        id: existing.data.id,
        organizationId: existing.data.organization_id,
        requestId: existing.data.request_id,
        expiresAt: existing.data.expires_at,
        created: false,
      };
    const r = await this.client
      .from("status_verification_challenges")
      .insert({
        id: input.id,
        organization_id: input.organizationId,
        request_id: input.requestId,
        subject_digest: input.subjectDigest,
        code_digest: input.codeDigest,
        expires_at: input.expiresAt,
        max_attempts: input.maxAttempts,
        delivery_outcome: input.real ? "pending" : "synthetic",
      })
      .select("id,organization_id,request_id,expires_at")
      .single();
    if (r.error?.code === "23505") {
      const raced = await this.client
        .from("status_verification_challenges")
        .select("id,organization_id,request_id,expires_at")
        .eq("subject_digest", input.subjectDigest)
        .eq("state", "pending")
        .single();
      if (raced.data)
        return {
          id: raced.data.id,
          organizationId: raced.data.organization_id,
          requestId: raced.data.request_id,
          expiresAt: raced.data.expires_at,
          created: false,
        };
    }
    if (r.error) throw new Error("challenge_create_failed");
    await this.client.from("status_verification_events").insert({
      organization_id: input.organizationId,
      challenge_id: input.organizationId ? r.data.id : null,
      subject_digest: input.subjectDigest,
      event_type: "challenge_requested",
      outcome_code: input.real ? "candidate_match" : "synthetic",
      trace_id: input.traceId,
    });
    return {
      id: r.data.id,
      organizationId: r.data.organization_id,
      requestId: r.data.request_id,
      expiresAt: r.data.expires_at,
      created: true,
    };
  }
  async setDelivery(challengeId: string, accepted: boolean, traceId: string) {
    const current = await this.client
      .from("status_verification_challenges")
      .select("organization_id,subject_digest")
      .eq("id", challengeId)
      .single();
    if (current.error) throw new Error("challenge_update_failed");
    const update = await this.client
      .from("status_verification_challenges")
      .update({
        delivery_outcome: accepted ? "accepted" : "failed",
        state: accepted ? "pending" : "delivery_failed",
      })
      .eq("id", challengeId);
    if (update.error) throw new Error("challenge_update_failed");
    await this.client.from("status_verification_events").insert({
      organization_id: current.data.organization_id,
      challenge_id: current.data.organization_id ? challengeId : null,
      subject_digest: current.data.subject_digest,
      event_type: accepted ? "delivery_accepted" : "delivery_failed",
      outcome_code: accepted ? "accepted" : "provider_error",
      trace_id: traceId,
    });
  }
  async verify(input: Parameters<RequestStatusRepository["verify"]>[0]) {
    const r = await this.client.rpc("verify_status_challenge", {
      p_challenge_id: input.challengeId,
      p_code_digest: input.codeDigest,
      p_token_digest: input.tokenDigest,
      p_conversation_token_digest: input.conversationTokenDigest as string,
      p_organization_id: input.organizationId as string,
      p_conversation_id: input.conversationId as string,
      p_token_ttl_seconds: input.tokenTtlSeconds,
      p_lockout_seconds: input.lockoutSeconds,
      p_trace_id: input.traceId,
    });
    if (r.error) throw new Error("verification_failed");
    const row = r.data?.[0];
    return {
      success: row?.success === true,
      expiresAt: row?.token_expires_at ?? null,
    };
  }
  private projection(
    row:
      | {
          reference_number: string;
          service_name: string;
          status: string;
          updated_at: string;
        }
      | undefined,
  ) {
    if (!row || !requestStatuses.includes(row.status as RequestStatus))
      return null;
    return toCustomerRequestStatus({
      referenceNumber: row.reference_number,
      serviceName: row.service_name,
      status: row.status as RequestStatus,
      updatedAt: row.updated_at,
    });
  }
  async consumeStatus(tokenDigest: string, reference: string, traceId: string) {
    const result = await this.client.rpc("consume_status_token", {
      p_token_digest: tokenDigest,
      p_reference_number: reference,
      p_trace_id: traceId,
    });
    if (result.error) throw new Error("status_read_failed");
    return this.projection(result.data?.[0]);
  }
  async consumeConversationStatus(
    organizationId: string,
    conversationId: string,
    reference: string,
    traceId: string,
  ) {
    const result = await this.client.rpc("consume_conversation_status_grant", {
      p_organization_id: organizationId,
      p_conversation_id: conversationId,
      p_reference_number: reference,
      p_trace_id: traceId,
    });
    if (result.error) throw new Error("status_read_failed");
    return this.projection(result.data?.[0]);
  }
}
