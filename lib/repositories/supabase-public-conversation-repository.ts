import type { SupabaseClient } from "@supabase/supabase-js";

import {
  applyAction,
  isComplete,
  nextRequiredStage,
  normalizeCameroonPhone,
  openingMessage,
  promptForStage,
  publicActions,
  type EditableField,
  type PublicAction,
} from "@/lib/domain/conversation-workflow";
import type {
  PublicConversationView,
  PublicDraft,
  PublicStage,
} from "@/lib/dto/public-conversation-dto";
import type {
  PublicConversationRepository,
  PublicRepositoryResult,
} from "@/lib/repositories/public-conversation-repository";
import type {
  ConfirmRequestInput,
  EditDraftInput,
  PublicMessageInput,
} from "@/lib/schemas/public-conversation-api";
import type { Database } from "@/lib/supabase/database.types";
import type { TrustedAgentContext } from "@/lib/agent/types";
import type { z } from "zod";
import { saveConversationFieldsSchema } from "@/lib/agent/tool-schemas";
import { permitsAgentFieldChange } from "@/lib/agent/field-corrections";

type Client = SupabaseClient<Database>;
type DraftRow = Database["public"]["Tables"]["conversation_drafts"]["Row"];

const fail = (code: string) => ({ ok: false as const, code });

function mapDraft(row: DraftRow, serviceName: string | null): PublicDraft {
  return {
    intent: publicActions.includes(row.intent as PublicAction)
      ? (row.intent as PublicAction)
      : null,
    requestType:
      row.request_type === "quotation" ||
      row.request_type === "site_visit" ||
      row.request_type === "support"
        ? row.request_type
        : null,
    serviceId: row.service_id,
    serviceName,
    customerName: row.customer_name,
    phone: row.phone,
    phoneConfirmedAt: row.phone_confirmed_at,
    email: row.email,
    description: row.description,
    location: row.location,
    preferredStartDate: row.preferred_start_date,
    budgetMin: row.budget_min,
    budgetMax: row.budget_max,
    stage: row.stage as PublicStage,
    version: row.version,
  };
}

function safeRpcCode(message: string) {
  return (
    [
      "organization_not_found",
      "conversation_not_found",
      "draft_incomplete",
      "confirmation_nonce_invalid",
      "service_unavailable",
      "routing_unavailable",
      "idempotency_conflict",
      "stale_draft",
      "attachment_upload_in_progress",
    ].find((code) => message.includes(code)) ?? "internal_error"
  );
}

export class SupabasePublicConversationRepository implements PublicConversationRepository {
  constructor(private readonly client: Client) {}

  async consumeRateLimit(
    organizationId: string | null,
    action: string,
    subjectDigest: string,
  ) {
    const limits: Record<string, [number, number]> = {
      create_conversation: [10, 3600],
      message: [60, 3600],
      summary: [15, 3600],
      confirmation: [10, 3600],
    };
    const [limit, window] = limits[action] ?? [30, 3600];
    const result = await this.client.rpc("consume_public_rate_limit", {
      p_action: action,
      p_limit: limit,
      p_organization_id: organizationId as never,
      p_subject_digest: subjectDigest,
      p_window_seconds: window,
    });
    return result.error === null && result.data === true;
  }

  async recordHandoffCustomerMessage(
    conversationId: string,
    tokenDigest: string,
    clientMessageId: string,
    customerMessage: string,
  ) {
    const result = await this.client.rpc("record_handoff_customer_message", {
      p_conversation_id: conversationId,
      p_token_digest: tokenDigest,
      p_client_message_id: clientMessageId,
      p_content: customerMessage,
    });
    if (result.error) return fail(safeRpcCode(result.error.message));
    if (result.data !== true) return { ok: true as const, value: null };
    return this.view(conversationId, tokenDigest);
  }

  async recordRequestFollowUp(
    conversationId: string,
    tokenDigest: string,
    clientMessageId: string,
    customerMessage: string,
  ) {
    const result = await this.client.rpc("record_public_request_follow_up", {
      p_conversation_id: conversationId,
      p_token_digest: tokenDigest,
      p_client_message_id: clientMessageId,
      p_content: customerMessage,
    });
    if (result.error) return fail(safeRpcCode(result.error.message));
    if (result.data !== true) return { ok: true as const, value: null };
    return this.view(conversationId, tokenDigest);
  }

  async create(organizationSlug: string, tokenDigest: string) {
    const result = await this.client.rpc("create_public_conversation", {
      p_organization_slug: organizationSlug,
      p_token_digest: tokenDigest,
    });
    if (result.error) return fail(safeRpcCode(result.error.message));
    const row = result.data[0];
    if (!row) return fail("internal_error");
    return {
      ok: true as const,
      value: {
        id: row.conversation_id,
        organizationName: row.organization_name,
        createdAt: row.created_at,
      },
    };
  }

  private async authorized(conversationId: string, tokenDigest: string) {
    const access = await this.client
      .from("public_conversation_access")
      .select("organization_id,expires_at,revoked_at,read_disabled_at")
      .eq("conversation_id", conversationId)
      .eq("token_digest", tokenDigest)
      .is("revoked_at", null)
      .is("read_disabled_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    return access.error || !access.data ? null : access.data.organization_id;
  }

  async view(
    conversationId: string,
    tokenDigest: string,
  ): Promise<PublicRepositoryResult<PublicConversationView>> {
    const organizationId = await this.authorized(conversationId, tokenDigest);
    if (!organizationId) return fail("conversation_not_found");
    const [conversation, organization, draft, services, messages, handoff] =
      await Promise.all([
        this.client
          .from("conversations")
          .select("id,state")
          .eq("organization_id", organizationId)
          .eq("id", conversationId)
          .maybeSingle(),
        this.client
          .from("organizations")
          .select("name")
          .eq("id", organizationId)
          .eq("is_active", true)
          .maybeSingle(),
        this.client
          .from("conversation_drafts")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("conversation_id", conversationId)
          .maybeSingle(),
        this.client
          .from("services")
          .select("id,name,description")
          .eq("organization_id", organizationId)
          .eq("is_active", true)
          .order("name"),
        this.client
          .from("messages")
          .select("id,sender_type,content,created_at")
          .eq("organization_id", organizationId)
          .eq("conversation_id", conversationId)
          .in("sender_type", ["customer", "assistant", "employee"])
          .order("created_at")
          .limit(100),
        this.client
          .from("human_handoffs")
          .select("status")
          .eq("organization_id", organizationId)
          .eq("conversation_id", conversationId)
          .in("status", ["queued", "assigned", "active"])
          .maybeSingle(),
      ]);
    if (
      conversation.error ||
      organization.error ||
      draft.error ||
      services.error ||
      messages.error ||
      handoff.error
    )
      return fail("internal_error");
    if (!conversation.data || !organization.data || !draft.data)
      return fail("conversation_not_found");
    const draftRow = draft.data;
    const serviceName =
      services.data.find((service) => service.id === draftRow.service_id)
        ?.name ?? null;
    const publicDraft = mapDraft(draftRow, serviceName);
    return {
      ok: true,
      value: {
        id: conversation.data.id,
        organizationName: organization.data.name,
        state: conversation.data.state,
        handoffStatus:
          handoff.data?.status === "queued" ||
          handoff.data?.status === "assigned" ||
          handoff.data?.status === "active"
            ? handoff.data.status
            : null,
        draft: publicDraft,
        prompt: promptForStage(publicDraft.stage),
        services: services.data,
        messages: messages.data.flatMap((message) =>
          message.sender_type === "customer" ||
          message.sender_type === "assistant" ||
          message.sender_type === "employee"
            ? [
                {
                  id: message.id,
                  senderType: message.sender_type,
                  content: message.content,
                  createdAt: message.created_at,
                },
              ]
            : [],
        ),
      },
    };
  }

  async message(
    conversationId: string,
    tokenDigest: string,
    input: PublicMessageInput,
  ) {
    if (input.kind === "message") return fail("invalid_message_mode");
    const organizationId = await this.authorized(conversationId, tokenDigest);
    if (!organizationId) return fail("conversation_not_found");
    const draftResult = await this.client
      .from("conversation_drafts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("conversation_id", conversationId)
      .maybeSingle();
    if (draftResult.error || !draftResult.data)
      return fail("conversation_not_found");
    const current = mapDraft(draftResult.data, null);
    if (current.stage === "confirmed" || current.stage === "cancelled")
      return fail("conversation_closed");

    const customerContent =
      input.kind === "action"
        ? input.action
        : input.kind === "skip"
          ? "Skip"
          : input.kind === "cancel"
            ? "Cancel request"
            : input.value;
    const update: Database["public"]["Tables"]["conversation_drafts"]["Update"] =
      {
        version: draftResult.data.version + 1,
        confirmation_nonce_digest: null,
        confirmation_nonce_expires_at: null,
      };
    let reply =
      "I could not apply that answer. Please try the current question again.";

    if (input.kind === "cancel") {
      update.stage = "cancelled";
      update.cancelled_at = new Date().toISOString();
      reply = promptForStage("cancelled");
    } else if (current.stage === "choose_action" && input.kind === "action") {
      const result = applyAction(input.action);
      Object.assign(update, {
        intent: result.values.intent,
        request_type: result.values.requestType,
        stage: result.values.stage,
      });
      reply = result.reply;
    } else if (current.stage === "choose_service" && input.kind === "answer") {
      const service = await this.client
        .from("services")
        .select("id,name")
        .eq("organization_id", organizationId)
        .eq("id", input.value)
        .eq("is_active", true)
        .maybeSingle();
      if (!service.data)
        reply = "Please choose one of the available BuildPro services.";
      else {
        update.service_id = service.data.id;
        update.stage = "collect_name";
        reply = promptForStage("collect_name");
      }
    } else if (
      current.stage === "collect_name" &&
      input.kind === "answer" &&
      input.value.length >= 2
    ) {
      update.customer_name = input.value;
      update.stage = "collect_phone";
      reply = promptForStage("collect_phone");
    } else if (current.stage === "collect_phone" && input.kind === "answer") {
      const phone = normalizeCameroonPhone(input.value);
      if (!phone)
        reply =
          "Enter a valid Cameroon mobile number, for example +237 6XX XXX XXX.";
      else {
        update.phone = phone;
        update.phone_confirmed_at = null;
        update.stage = "confirm_phone";
        reply = `Please confirm that ${phone} belongs to you.`;
      }
    } else if (current.stage === "confirm_phone" && input.kind === "answer") {
      if (["yes", "confirm", "confirmed"].includes(input.value.toLowerCase())) {
        update.phone_confirmed_at = new Date().toISOString();
        update.stage = "collect_description";
        reply = promptForStage("collect_description");
      } else {
        update.phone = null;
        update.phone_confirmed_at = null;
        update.stage = "collect_phone";
        reply = promptForStage("collect_phone");
      }
    } else if (
      current.stage === "collect_description" &&
      input.kind === "answer" &&
      input.value.length >= 10
    ) {
      update.description = input.value;
      update.stage = "collect_location";
      reply = promptForStage("collect_location");
    } else if (
      current.stage === "collect_location" &&
      input.kind === "answer" &&
      input.value.length >= 2
    ) {
      update.location = input.value;
      update.stage = "collect_email";
      reply = promptForStage("collect_email");
    } else if (current.stage === "collect_email" && input.kind === "skip") {
      update.email = null;
      update.stage = "collect_start";
      reply = promptForStage("collect_start");
    } else if (
      current.stage === "collect_email" &&
      input.kind === "answer" &&
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.value)
    ) {
      update.email = input.value;
      update.stage = "collect_start";
      reply = promptForStage("collect_start");
    } else if (current.stage === "collect_start" && input.kind === "skip") {
      update.preferred_start_date = null;
      update.stage = "collect_budget";
      reply = promptForStage("collect_budget");
    } else if (
      current.stage === "collect_start" &&
      input.kind === "answer" &&
      /^\d{4}-\d{2}-\d{2}$/.test(input.value)
    ) {
      update.preferred_start_date = input.value;
      update.stage = "collect_budget";
      reply = promptForStage("collect_budget");
    } else if (current.stage === "collect_budget" && input.kind === "skip") {
      update.budget_min = null;
      update.budget_max = null;
      update.stage = "review";
      reply = promptForStage("review");
    } else if (current.stage === "collect_budget" && input.kind === "answer") {
      const match = input.value
        .replace(/[, ]/g, "")
        .match(/^(\d+)(?:-(\d+))?$/);
      if (match) {
        update.budget_min = Number(match[1]);
        update.budget_max = Number(match[2] ?? match[1]);
        update.stage = "review";
        reply = promptForStage("review");
      } else
        reply =
          "Enter a number or range such as 500000-1000000, or skip this optional question.";
    } else if (
      current.stage === "review" &&
      input.kind === "action" &&
      input.action === "request_quotation"
    ) {
      reply = promptForStage("review");
    }

    const processed = await this.client.rpc("process_public_message", {
      p_budget_max:
        "budget_max" in update
          ? (update.budget_max ?? null)
          : draftResult.data.budget_max,
      p_budget_min:
        "budget_min" in update
          ? (update.budget_min ?? null)
          : draftResult.data.budget_min,
      p_cancelled_at: update.cancelled_at ?? draftResult.data.cancelled_at,
      p_client_message_id: input.clientMessageId,
      p_conversation_id: conversationId,
      p_customer_content: customerContent,
      p_customer_name: update.customer_name ?? draftResult.data.customer_name,
      p_description: update.description ?? draftResult.data.description,
      p_email:
        "email" in update ? (update.email ?? null) : draftResult.data.email,
      p_expected_version: draftResult.data.version,
      p_intent: update.intent ?? draftResult.data.intent,
      p_location: update.location ?? draftResult.data.location,
      p_phone:
        "phone" in update ? (update.phone ?? null) : draftResult.data.phone,
      p_phone_confirmed_at:
        "phone_confirmed_at" in update
          ? (update.phone_confirmed_at ?? null)
          : draftResult.data.phone_confirmed_at,
      p_preferred_start_date:
        "preferred_start_date" in update
          ? (update.preferred_start_date ?? null)
          : draftResult.data.preferred_start_date,
      p_reply: reply,
      p_request_type: update.request_type ?? draftResult.data.request_type,
      p_service_id: update.service_id ?? draftResult.data.service_id,
      p_stage: update.stage ?? draftResult.data.stage,
      p_token_digest: tokenDigest,
    } as never);
    if (processed.error) return fail(safeRpcCode(processed.error.message));
    const view = await this.view(conversationId, tokenDigest);
    if (view.ok && input.kind === "cancel") {
      const revoked = await this.client
        .from("public_conversation_access")
        .update({ read_disabled_at: new Date().toISOString() })
        .eq("organization_id", organizationId)
        .eq("conversation_id", conversationId);
      if (revoked.error) return fail("internal_error");
    }
    return view;
  }

  async agentContext(
    conversationId: string,
    tokenDigest: string,
  ): Promise<PublicRepositoryResult<TrustedAgentContext>> {
    const organizationId = await this.authorized(conversationId, tokenDigest);
    if (!organizationId) return fail("conversation_not_found");
    const [conversation, knowledge] = await Promise.all([
      this.view(conversationId, tokenDigest),
      this.client
        .from("knowledge_documents")
        .select("id,title,content")
        .eq("organization_id", organizationId)
        .eq("status", "approved")
        .order("updated_at", { ascending: false })
        .limit(20),
    ]);
    if (!conversation.ok || knowledge.error) return fail("internal_error");
    return {
      ok: true,
      value: {
        organizationId,
        conversationId,
        tokenDigest,
        conversation: conversation.value,
        knowledge: knowledge.data.map((item) => ({
          id: item.id,
          title: item.title,
          content: item.content.slice(0, 2000),
        })),
      },
    };
  }

  async existingAgentExchange(
    conversationId: string,
    tokenDigest: string,
    clientMessageId: string,
    customerMessage: string,
  ) {
    const organizationId = await this.authorized(conversationId, tokenDigest);
    if (!organizationId) return fail("conversation_not_found");
    const customer = await this.client
      .from("messages")
      .select("id,created_at")
      .eq("organization_id", organizationId)
      .eq("conversation_id", conversationId)
      .eq("client_message_id", clientMessageId)
      .maybeSingle();
    if (customer.error) return fail("internal_error");
    if (!customer.data) {
      const inserted = await this.client.from("messages").insert({
        organization_id: organizationId,
        conversation_id: conversationId,
        sender_type: "customer",
        client_message_id: clientMessageId,
        content: customerMessage,
      });
      if (inserted.error) {
        if (inserted.error.code === "23505")
          return this.view(conversationId, tokenDigest);
        return fail("internal_error");
      }
      return { ok: true as const, value: null };
    }
    const reply = await this.client
      .from("messages")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("reply_to_message_id", customer.data.id)
      .maybeSingle();
    if (reply.error) return fail("internal_error");
    if (reply.data) return this.view(conversationId, tokenDigest);
    if (Date.now() - new Date(customer.data.created_at).getTime() < 30_000)
      return this.view(conversationId, tokenDigest);
    const current = await this.view(conversationId, tokenDigest);
    if (!current.ok) return current;
    const recovered = await this.client.from("messages").insert({
      organization_id: organizationId,
      conversation_id: conversationId,
      sender_type: "assistant",
      reply_to_message_id: customer.data.id,
      content:
        current.value.prompt ||
        "Please choose one of the available request options.",
      metadata: { agent_outcome: "recovered_fallback" },
    });
    if (recovered.error && recovered.error.code !== "23505")
      return fail("internal_error");
    return this.view(conversationId, tokenDigest);
  }

  async saveAgentFields(
    context: TrustedAgentContext,
    input: z.infer<typeof saveConversationFieldsSchema>,
    customerMessage: string,
  ): Promise<PublicRepositoryResult<TrustedAgentContext>> {
    const authorizedOrganization = await this.authorized(
      context.conversationId,
      context.tokenDigest,
    );
    if (authorizedOrganization !== context.organizationId)
      return fail("conversation_not_found");
    if (input.expectedDraftVersion !== context.conversation.draft.version)
      return fail("stale_draft");
    const fields = input.fields;
    const currentValues = context.conversation.draft;
    const fieldMap = {
      intent: "intent",
      serviceId: "serviceId",
      customerName: "customerName",
      phone: "phone",
      email: "email",
      description: "description",
      location: "location",
      preferredStartDate: "preferredStartDate",
      budgetMin: "budgetMin",
      budgetMax: "budgetMax",
    } as const;
    for (const [field, draftField] of Object.entries(fieldMap) as Array<
      [keyof typeof fields, keyof typeof currentValues]
    >) {
      const proposed = fields[field];
      const current = currentValues[draftField];
      if (
        !permitsAgentFieldChange(
          current,
          proposed,
          input.fieldSources[field],
          customerMessage,
        )
      )
        return fail("explicit_correction_required");
    }
    if (fields.serviceId) {
      const service = await this.client
        .from("services")
        .select("id")
        .eq("organization_id", context.organizationId)
        .eq("id", fields.serviceId)
        .eq("is_active", true)
        .maybeSingle();
      if (!service.data) return fail("invalid_service");
    }
    const requestType =
      fields.intent === "request_site_visit"
        ? "site_visit"
        : fields.intent === "report_problem"
          ? "support"
          : fields.intent === "request_quotation"
            ? "quotation"
            : context.conversation.draft.requestType;
    const phone = fields.phone
      ? normalizeCameroonPhone(fields.phone)
      : context.conversation.draft.phone;
    if (fields.phone && !phone) return fail("invalid_phone");
    const merged = {
      ...context.conversation.draft,
      intent: fields.intent ?? context.conversation.draft.intent,
      requestType,
      serviceId: fields.serviceId ?? context.conversation.draft.serviceId,
      customerName:
        fields.customerName ?? context.conversation.draft.customerName,
      phone,
      phoneConfirmedAt: fields.phone
        ? null
        : context.conversation.draft.phoneConfirmedAt,
      email: fields.email ?? context.conversation.draft.email,
      description: fields.description ?? context.conversation.draft.description,
      location: fields.location ?? context.conversation.draft.location,
      preferredStartDate:
        fields.preferredStartDate ??
        context.conversation.draft.preferredStartDate,
      budgetMin: fields.budgetMin ?? context.conversation.draft.budgetMin,
      budgetMax: fields.budgetMax ?? context.conversation.draft.budgetMax,
    };
    const stage = nextRequiredStage(merged);
    const updated = await this.client
      .from("conversation_drafts")
      .update({
        intent: merged.intent,
        request_type: merged.requestType,
        service_id: merged.serviceId,
        customer_name: merged.customerName,
        phone: merged.phone,
        phone_confirmed_at: merged.phoneConfirmedAt,
        email: merged.email,
        description: merged.description,
        location: merged.location,
        preferred_start_date: merged.preferredStartDate,
        budget_min: merged.budgetMin,
        budget_max: merged.budgetMax,
        stage,
        version: input.expectedDraftVersion + 1,
        confirmation_nonce_digest: null,
        confirmation_nonce_expires_at: null,
      })
      .eq("organization_id", context.organizationId)
      .eq("conversation_id", context.conversationId)
      .eq("version", input.expectedDraftVersion)
      .select("conversation_id")
      .maybeSingle();
    if (updated.error || !updated.data) return fail("stale_draft");
    return this.agentContext(context.conversationId, context.tokenDigest);
  }

  async recordAgentExchange(
    context: TrustedAgentContext,
    tokenDigest: string,
    clientMessageId: string,
    customerMessage: string,
    assistantMessage: string,
  ) {
    const existing = await this.client
      .from("messages")
      .select("id")
      .eq("organization_id", context.organizationId)
      .eq("conversation_id", context.conversationId)
      .eq("client_message_id", clientMessageId)
      .maybeSingle();
    let customerMessageId = existing.data?.id;
    if (!customerMessageId) {
      const inserted = await this.client
        .from("messages")
        .insert({
          organization_id: context.organizationId,
          conversation_id: context.conversationId,
          sender_type: "customer",
          client_message_id: clientMessageId,
          content: customerMessage,
        })
        .select("id")
        .single();
      if (inserted.error) {
        if (inserted.error.code !== "23505") return fail("internal_error");
        const raced = await this.client
          .from("messages")
          .select("id")
          .eq("organization_id", context.organizationId)
          .eq("conversation_id", context.conversationId)
          .eq("client_message_id", clientMessageId)
          .single();
        if (raced.error) return fail("internal_error");
        customerMessageId = raced.data.id;
      } else customerMessageId = inserted.data.id;
    }
    const reply = await this.client
      .from("messages")
      .select("id")
      .eq("organization_id", context.organizationId)
      .eq("reply_to_message_id", customerMessageId)
      .maybeSingle();
    if (!reply.data) {
      const insertedReply = await this.client.from("messages").insert({
        organization_id: context.organizationId,
        conversation_id: context.conversationId,
        sender_type: "assistant",
        reply_to_message_id: customerMessageId,
        content: assistantMessage,
      });
      if (insertedReply.error && insertedReply.error.code !== "23505")
        return fail("internal_error");
    }
    return this.view(context.conversationId, tokenDigest);
  }

  async edit(
    conversationId: string,
    tokenDigest: string,
    input: EditDraftInput,
  ) {
    const organizationId = await this.authorized(conversationId, tokenDigest);
    if (!organizationId) return fail("conversation_not_found");
    const changes: Database["public"]["Tables"]["conversation_drafts"]["Update"] =
      {
        version: input.expectedVersion + 1,
        stage: "review",
        confirmation_nonce_digest: null,
        confirmation_nonce_expires_at: null,
      };
    const field = input.field as EditableField;
    if (field === "phone") {
      const phone = normalizeCameroonPhone(input.value);
      if (!phone) return fail("invalid_phone");
      changes.phone = phone;
      changes.phone_confirmed_at = null;
      changes.stage = "confirm_phone";
    } else if (field === "service") {
      const service = await this.client
        .from("services")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("id", input.value)
        .eq("is_active", true)
        .maybeSingle();
      if (!service.data) return fail("invalid_service");
      changes.service_id = service.data.id;
    } else if (field === "customer_name") {
      if (input.value.length < 2 || input.value.length > 160)
        return fail("invalid_customer_name");
      changes.customer_name = input.value;
    } else if (field === "description") {
      if (input.value.length < 10) return fail("invalid_description");
      changes.description = input.value;
    } else if (field === "location") {
      if (input.value.length < 2 || input.value.length > 500)
        return fail("invalid_location");
      changes.location = input.value;
    } else if (field === "email") {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.value))
        return fail("invalid_email");
      changes.email = input.value;
    } else if (field === "preferred_start_date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.value))
        return fail("invalid_preferred_start_date");
      changes.preferred_start_date = input.value;
    } else {
      const match = input.value
        .replace(/[, ]/g, "")
        .match(/^(\d+)(?:-(\d+))?$/);
      if (!match) return fail("invalid_budget");
      changes.budget_min = Number(match[1]);
      changes.budget_max = Number(match[2] ?? match[1]);
    }
    const result = await this.client
      .from("conversation_drafts")
      .update(changes)
      .eq("organization_id", organizationId)
      .eq("conversation_id", conversationId)
      .eq("version", input.expectedVersion)
      .select("conversation_id")
      .maybeSingle();
    if (result.error || !result.data) return fail("stale_draft");
    return this.view(conversationId, tokenDigest);
  }

  async issueSummary(
    conversationId: string,
    tokenDigest: string,
    nonceDigest: string,
  ) {
    const organizationId = await this.authorized(conversationId, tokenDigest);
    if (!organizationId) return fail("conversation_not_found");
    const current = await this.view(conversationId, tokenDigest);
    if (
      !current.ok ||
      !isComplete(current.value.draft) ||
      current.value.draft.stage !== "review"
    )
      return fail("draft_incomplete");
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const update = await this.client
      .from("conversation_drafts")
      .update({
        confirmation_nonce_digest: nonceDigest,
        confirmation_nonce_expires_at: expiresAt,
        summary_version: current.value.draft.version,
      })
      .eq("organization_id", organizationId)
      .eq("conversation_id", conversationId)
      .eq("version", current.value.draft.version)
      .select("conversation_id")
      .maybeSingle();
    if (update.error) return fail("internal_error");
    if (!update.data) return fail("stale_draft");
    return {
      ok: true as const,
      value: { conversation: current.value, expiresAt },
    };
  }

  async confirm(
    conversationId: string,
    tokenDigest: string,
    nonceDigest: string,
    input: ConfirmRequestInput,
  ) {
    const result = await this.client.rpc("confirm_public_request", {
      p_conversation_id: conversationId,
      p_idempotency_key: input.idempotencyKey,
      p_nonce_digest: nonceDigest,
      p_token_digest: tokenDigest,
    });
    if (result.error) return fail(safeRpcCode(result.error.message));
    const row = result.data[0];
    if (!row) return fail("internal_error");
    return {
      ok: true as const,
      value: {
        id: row.id,
        referenceNumber: row.reference_number,
        status: row.status,
        createdAt: row.created_at,
        replayed: row.replayed,
      },
    };
  }
}

export { openingMessage, nextRequiredStage };
