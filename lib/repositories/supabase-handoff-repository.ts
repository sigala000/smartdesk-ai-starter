import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { HandoffDetail, HandoffSummary } from "@/lib/dto/handoff-dto";
import type {
  HandoffRepository,
  HandoffRepositoryResult,
  HandoffScope,
} from "@/lib/repositories/handoff-repository";
import type {
  EscalationDecision,
  HandoffPriority,
  HandoffStatus,
} from "@/lib/domain/handoffs";
import type {
  HandoffAssignInput,
  HandoffListQuery,
  HandoffMessageInput,
  HandoffResolveInput,
} from "@/lib/schemas/handoff-api";

type Client = SupabaseClient<Database>;
type Row = Database["public"]["Tables"]["human_handoffs"]["Row"];
const fail = (code: string) => ({ ok: false as const, code });
function code(message: string) {
  return (
    [
      "handoff_not_found",
      "invalid_member",
      "handoff_assignment_forbidden",
      "invalid_handoff_transition",
      "handoff_ownership_conflict",
      "handoff_not_active_owner",
      "invalid_message",
      "invalid_resolution",
      "conversation_not_found",
      "invalid_handoff",
    ].find((item) => message.includes(item)) ?? "internal_error"
  );
}
function summary(
  row: Row,
  requestReference: string | null = null,
  memberName: string | null = null,
): HandoffSummary {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    requestId: row.request_id,
    requestReference,
    status: row.status as HandoffStatus,
    priority: row.priority as HandoffPriority,
    reason: row.reason,
    assignedMemberId: row.assigned_member_id,
    assignedMemberName: memberName,
    requestedAt: row.requested_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseHandoffRepository implements HandoffRepository {
  constructor(private readonly client: Client) {}
  async requestPublic(
    conversationId: string,
    tokenDigest: string,
    idempotencyKey: string,
    decision: EscalationDecision,
  ) {
    const result = await this.client.rpc("request_public_handoff", {
      p_conversation_id: conversationId,
      p_token_digest: tokenDigest,
      p_idempotency_key: idempotencyKey,
      p_reason: decision.reason,
      p_reason_code: decision.reasonCode,
      p_priority: decision.priority,
    });
    if (result.error) return fail(code(result.error.message));
    const row = result.data as unknown as Row;
    return row?.id
      ? { ok: true as const, value: summary(row) }
      : fail("internal_error");
  }
  async activeForConversation(conversationId: string, tokenDigest: string) {
    const access = await this.client
      .from("public_conversation_access")
      .select("organization_id")
      .eq("conversation_id", conversationId)
      .eq("token_digest", tokenDigest)
      .is("revoked_at", null)
      .is("read_disabled_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (access.error || !access.data) return fail("conversation_not_found");
    const result = await this.client
      .from("human_handoffs")
      .select("*")
      .eq("organization_id", access.data.organization_id)
      .eq("conversation_id", conversationId)
      .in("status", ["requested", "queued", "assigned", "active"])
      .maybeSingle();
    if (result.error) return fail("internal_error");
    return {
      ok: true as const,
      value: result.data ? summary(result.data) : null,
    };
  }
  async list(scope: HandoffScope, query: HandoffListQuery) {
    let request = this.client
      .from("human_handoffs")
      .select("*")
      .eq("organization_id", scope.organizationId)
      .order("requested_at", { ascending: true })
      .limit(100);
    request =
      query.status === "open"
        ? request.in("status", ["requested", "queued", "assigned", "active"])
        : request.eq("status", query.status);
    const result = await request;
    if (result.error) return fail("internal_error");
    const rank: Record<HandoffPriority, number> = {
      urgent: 0,
      high: 1,
      normal: 2,
    };
    return {
      ok: true as const,
      value: result.data
        .map((row) => summary(row))
        .sort((a, b) => rank[a.priority] - rank[b.priority]),
    };
  }
  async detail(
    scope: HandoffScope,
    handoffId: string,
  ): Promise<HandoffRepositoryResult<HandoffDetail>> {
    const handoff = await this.client
      .from("human_handoffs")
      .select("*")
      .eq("organization_id", scope.organizationId)
      .eq("id", handoffId)
      .maybeSingle();
    if (handoff.error || !handoff.data) return fail("handoff_not_found");
    const [conversation, messages, member, request] = await Promise.all([
      this.client
        .from("conversations")
        .select("customer_id")
        .eq("organization_id", scope.organizationId)
        .eq("id", handoff.data.conversation_id)
        .single(),
      this.client
        .from("messages")
        .select("id,sender_type,content,created_at")
        .eq("organization_id", scope.organizationId)
        .eq("conversation_id", handoff.data.conversation_id)
        .in("sender_type", ["customer", "assistant", "employee"])
        .order("created_at")
        .limit(200),
      handoff.data.assigned_member_id
        ? this.client
            .from("organization_members")
            .select("display_name")
            .eq("organization_id", scope.organizationId)
            .eq("id", handoff.data.assigned_member_id as string)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      handoff.data.request_id
        ? this.client
            .from("requests")
            .select("reference_number")
            .eq("organization_id", scope.organizationId)
            .eq("id", handoff.data.request_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (conversation.error || messages.error) return fail("internal_error");
    const customer = conversation.data?.customer_id
      ? await this.client
          .from("customers")
          .select("full_name")
          .eq("organization_id", scope.organizationId)
          .eq("id", conversation.data.customer_id)
          .maybeSingle()
      : { data: null };
    const base = summary(
      handoff.data,
      request.data?.reference_number ?? null,
      member.data?.display_name ?? null,
    );
    return {
      ok: true,
      value: {
        ...base,
        customerName: customer.data?.full_name ?? null,
        messages: messages.data.flatMap((m) =>
          m.sender_type === "customer" ||
          m.sender_type === "assistant" ||
          m.sender_type === "employee"
            ? [
                {
                  id: m.id,
                  senderType: m.sender_type,
                  content: m.content,
                  createdAt: m.created_at,
                },
              ]
            : [],
        ),
      },
    };
  }
  async members(scope: HandoffScope) {
    const result = await this.client
      .from("organization_members")
      .select("id,display_name,role")
      .eq("organization_id", scope.organizationId)
      .eq("is_active", true)
      .neq("role", "viewer")
      .order("display_name");
    return result.error
      ? fail("internal_error")
      : {
          ok: true as const,
          value: result.data.map((m) => ({
            id: m.id,
            displayName: m.display_name,
          })),
        };
  }
  private async rpc(
    name: "assign_handoff" | "join_handoff" | "resolve_handoff",
    args: Record<string, unknown>,
  ) {
    const result = await this.client.rpc(name, args as never);
    if (result.error) return fail(code(result.error.message));
    const row = result.data as unknown as Row;
    return row?.id
      ? { ok: true as const, value: summary(row) }
      : fail("internal_error");
  }
  assign(_scope: HandoffScope, id: string, input: HandoffAssignInput) {
    return this.rpc("assign_handoff", {
      p_handoff_id: id,
      p_member_id: input.memberId,
    });
  }
  join(_scope: HandoffScope, id: string) {
    return this.rpc("join_handoff", { p_handoff_id: id });
  }
  resolve(_scope: HandoffScope, id: string, input: HandoffResolveInput) {
    return this.rpc("resolve_handoff", {
      p_handoff_id: id,
      p_resolution: input.resolution,
      p_resume_automation: input.resumeAutomation,
    });
  }
  async message(_scope: HandoffScope, id: string, input: HandoffMessageInput) {
    const result = await this.client.rpc("send_handoff_message", {
      p_handoff_id: id,
      p_client_message_id: input.clientMessageId,
      p_content: input.message,
    });
    if (result.error) return fail(code(result.error.message));
    const row = result.data as unknown as { id: string; created_at: string };
    return row?.id
      ? { ok: true as const, value: { id: row.id, createdAt: row.created_at } }
      : fail("internal_error");
  }
}
