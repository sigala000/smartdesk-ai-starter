import {
  decodeRequestCursor,
  encodeRequestCursor,
} from "@/lib/domain/request-cursor";
import { isRequestStatus, isRequestType } from "@/lib/domain/requests";
import type {
  EmployeeRequestDetail,
  RequestListItem,
} from "@/lib/dto/request-dto";
import type { RequestListQuery } from "@/lib/schemas/request-api";
import type {
  DatabaseClient,
  EmployeeRequestScope,
  RepositoryResult,
  RequestRepository,
} from "@/lib/repositories/request-repository";

function one<T>(value: T | readonly T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value as T | null);
}

function failure(code: string): Readonly<{ ok: false; code: string }> {
  return { ok: false, code };
}

function mapRpcError(message: string): string {
  const known = [
    "request_not_found",
    "assignment_forbidden",
    "transition_forbidden",
    "notes_forbidden",
    "request_information_forbidden",
    "stale_request",
    "assignment_target_required",
    "invalid_department",
    "invalid_member",
    "member_department_mismatch",
    "invalid_transition",
    "cancellation_reason_required",
    "invalid_reason",
    "invalid_note",
    "invalid_question",
    "conversation_required",
    "responsible_employee_required",
    "quotation_attachment_required",
    "transition_provenance_required",
    "quotation_approval_forbidden",
    "quotation_attachment_invalid",
    "attachment_not_found",
  ];
  return known.find((code) => message.includes(code)) ?? "internal_error";
}

type ListRow = {
  id: string;
  reference_number: string;
  title: string;
  request_type: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  customers:
    { full_name: string | null } | { full_name: string | null }[] | null;
  services: { name: string } | { name: string }[] | null;
  departments: { name: string } | { name: string }[] | null;
  organization_members:
    { display_name: string } | { display_name: string }[] | null;
};

function mapListRow(row: ListRow): RequestListItem | null {
  if (!isRequestStatus(row.status) || !isRequestType(row.request_type))
    return null;
  return {
    id: row.id,
    referenceNumber: row.reference_number,
    title: row.title,
    requestType: row.request_type,
    priority: row.priority,
    status: row.status,
    customerName: one(row.customers)?.full_name ?? "Customer",
    serviceName: one(row.services)?.name ?? "Unknown service",
    departmentName: one(row.departments)?.name ?? null,
    assignedMemberName: one(row.organization_members)?.display_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseRequestRepository implements RequestRepository {
  constructor(private readonly client: DatabaseClient) {}

  async options(scope: EmployeeRequestScope) {
    const [departments, members] = await Promise.all([
      this.client
        .from("departments")
        .select("id,name")
        .eq("organization_id", scope.organizationId)
        .eq("is_active", true)
        .order("name"),
      this.client
        .from("organization_members")
        .select("id,display_name,department_id")
        .eq("organization_id", scope.organizationId)
        .eq("is_active", true)
        .neq("role", "viewer")
        .order("display_name"),
    ]);
    if (departments.error || members.error) return failure("internal_error");
    return {
      ok: true as const,
      value: {
        departments: departments.data,
        members: members.data.map((member) => ({
          id: member.id,
          displayName: member.display_name,
          departmentId: member.department_id,
        })),
      },
    };
  }

  async list(
    scope: EmployeeRequestScope,
    input: RequestListQuery,
  ): Promise<
    RepositoryResult<{
      items: readonly RequestListItem[];
      nextCursor: string | null;
    }>
  > {
    const cursor = input.cursor ? decodeRequestCursor(input.cursor) : null;
    if (input.cursor && !cursor) return failure("invalid_cursor");

    let customerIds: string[] = [];
    if (input.search) {
      const safeSearch = input.search
        .replace(/[^\p{L}\p{N}@+.' -]/gu, " ")
        .trim();
      const pattern = `%${safeSearch}%`;
      const customers = await this.client
        .from("customers")
        .select("id")
        .eq("organization_id", scope.organizationId)
        .or(
          `full_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`,
        )
        .limit(100);
      if (customers.error) return failure("internal_error");
      customerIds = customers.data.map((customer) => customer.id);
    }

    let query = this.client
      .from("requests")
      .select(
        "id,reference_number,title,request_type,priority,status,created_at,updated_at,customers(full_name),services(name),departments(name),organization_members!requests_organization_id_assigned_member_id_fkey(display_name)",
      )
      .eq("organization_id", scope.organizationId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (input.status) query = query.eq("status", input.status);
    if (input.departmentId)
      query = query.eq("department_id", input.departmentId);
    if (input.assignedMemberId)
      query = query.eq("assigned_member_id", input.assignedMemberId);
    if (input.serviceId) query = query.eq("service_id", input.serviceId);
    if (input.search) {
      const safe = input.search.replace(/[,%_()]/g, " ").trim();
      const clauses = [
        `reference_number.ilike.%${safe}%`,
        `title.ilike.%${safe}%`,
        `location.ilike.%${safe}%`,
      ];
      if (customerIds.length > 0)
        clauses.push(`customer_id.in.(${customerIds.join(",")})`);
      query = query.or(clauses.join(","));
    }
    if (cursor) {
      query = query.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
      );
    }
    const result = await query.limit(input.limit + 1);
    if (result.error) return failure("internal_error");
    const mapped = (result.data as ListRow[])
      .map(mapListRow)
      .filter((item): item is RequestListItem => item !== null);
    const hasMore = mapped.length > input.limit;
    const items = mapped.slice(0, input.limit);
    const last = items.at(-1);
    return {
      ok: true,
      value: {
        items,
        nextCursor:
          hasMore && last
            ? encodeRequestCursor({ createdAt: last.createdAt, id: last.id })
            : null,
      },
    };
  }

  async findDetail(
    scope: EmployeeRequestScope,
    requestId: string,
    includeNotes: boolean,
  ): Promise<RepositoryResult<EmployeeRequestDetail>> {
    const request = await this.client
      .from("requests")
      .select(
        "id,reference_number,title,request_type,priority,status,description,location,conversation_id,created_at,updated_at,customers(full_name,email,phone),services(name),departments(name),organization_members!requests_organization_id_assigned_member_id_fkey(display_name)",
      )
      .eq("organization_id", scope.organizationId)
      .eq("id", requestId)
      .maybeSingle();
    if (request.error) return failure("internal_error");
    if (!request.data || !isRequestStatus(request.data.status))
      return failure("not_found");

    const [
      history,
      assignments,
      notes,
      attachments,
      messages,
      departments,
      members,
    ] = await Promise.all([
      this.client
        .from("request_status_history")
        .select(
          "id,from_status,to_status,changed_by_type,reason,source,created_at,organization_members!request_status_history_organization_id_changed_by_member_i_fkey(display_name)",
        )
        .eq("organization_id", scope.organizationId)
        .eq("request_id", requestId)
        .order("created_at"),
      this.client
        .from("assignments")
        .select(
          "id,reason,assigned_at,unassigned_at,departments(name),member:organization_members!assignments_organization_id_member_id_fkey(display_name),actor:organization_members!assignments_organization_id_assigned_by_member_id_fkey(display_name)",
        )
        .eq("organization_id", scope.organizationId)
        .eq("request_id", requestId)
        .order("assigned_at"),
      includeNotes
        ? this.client
            .from("internal_notes")
            .select(
              "id,content,created_at,organization_members!internal_notes_organization_id_author_member_id_fkey(display_name)",
            )
            .eq("organization_id", scope.organizationId)
            .eq("request_id", requestId)
            .order("created_at")
        : Promise.resolve({ data: [], error: null }),
      this.client
        .from("attachments")
        .select(
          "id,original_filename,mime_type,size_bytes,created_at,document_kind,approved_at",
        )
        .eq("organization_id", scope.organizationId)
        .eq("request_id", requestId)
        .eq("upload_status", "active")
        .order("created_at"),
      request.data.conversation_id
        ? this.client
            .from("messages")
            .select(
              "id,sender_type,content,created_at,organization_members!messages_organization_id_sender_member_id_fkey(display_name)",
            )
            .eq("organization_id", scope.organizationId)
            .eq("conversation_id", request.data.conversation_id)
            .in("sender_type", ["customer", "assistant", "employee"])
            .order("created_at")
        : Promise.resolve({ data: [], error: null }),
      this.client
        .from("departments")
        .select("id,name")
        .eq("organization_id", scope.organizationId)
        .eq("is_active", true)
        .order("name"),
      this.client
        .from("organization_members")
        .select("id,display_name,department_id")
        .eq("organization_id", scope.organizationId)
        .eq("is_active", true)
        .neq("role", "viewer")
        .order("display_name"),
    ]);
    if (
      [
        history,
        assignments,
        notes,
        attachments,
        messages,
        departments,
        members,
      ].some((item) => item.error)
    )
      return failure("internal_error");

    const customer = one(request.data.customers);
    const base = mapListRow(request.data as unknown as ListRow);
    if (!base) return failure("internal_error");
    return {
      ok: true,
      value: {
        ...base,
        description: request.data.description,
        location: request.data.location,
        customerEmail: customer?.email ?? null,
        customerPhone: customer?.phone ?? null,
        conversationId: request.data.conversation_id,
        statusHistory: (history.data ?? []).map((item) => ({
          id: item.id,
          fromStatus: item.from_status,
          toStatus: item.to_status,
          changedByName: one(item.organization_members)?.display_name ?? null,
          changedByType: item.changed_by_type,
          reason: item.reason,
          source: item.source,
          createdAt: item.created_at,
        })),
        assignmentHistory: (assignments.data ?? []).map((item) => ({
          id: item.id,
          departmentName: one(item.departments)?.name ?? null,
          memberName: one(item.member)?.display_name ?? null,
          assignedByName: one(item.actor)?.display_name ?? null,
          reason: item.reason,
          assignedAt: item.assigned_at,
          unassignedAt: item.unassigned_at,
        })),
        internalNotes: (notes.data ?? []).map((item) => ({
          id: item.id,
          authorName:
            one(item.organization_members)?.display_name ?? "Employee",
          content: item.content,
          createdAt: item.created_at,
        })),
        attachments: (attachments.data ?? []).map((item) => ({
          id: item.id,
          filename: item.original_filename,
          mimeType:
            item.mime_type as EmployeeRequestDetail["attachments"][number]["mimeType"],
          sizeBytes: item.size_bytes,
          createdAt: item.created_at,
          documentKind: item.document_kind as "general" | "quotation",
          approvedAt: item.approved_at,
        })),
        messages: (messages.data ?? []).flatMap((item) =>
          item.sender_type === "customer" ||
          item.sender_type === "assistant" ||
          item.sender_type === "employee"
            ? [
                {
                  id: item.id,
                  senderType: item.sender_type,
                  senderName:
                    one(item.organization_members)?.display_name ?? null,
                  content: item.content,
                  createdAt: item.created_at,
                },
              ]
            : [],
        ),
        departments: departments.data ?? [],
        assignableMembers: (members.data ?? []).map((member) => ({
          id: member.id,
          displayName: member.display_name,
          departmentId: member.department_id,
        })),
      },
    };
  }

  async assign(
    _scope: EmployeeRequestScope,
    requestId: string,
    input: import("@/lib/schemas/request-api").AssignmentInput,
  ): Promise<RepositoryResult<{ id: string; updatedAt: string }>> {
    const result = await this.client.rpc("assign_request", {
      p_request_id: requestId,
      p_department_id: input.departmentId as never,
      p_member_id: input.memberId as never,
      p_reason: (input.reason ?? null) as never,
      p_expected_updated_at: input.expectedUpdatedAt,
    });
    if (result.error) return failure(mapRpcError(result.error.message));
    return {
      ok: true,
      value: { id: result.data.id, updatedAt: result.data.updated_at },
    };
  }

  async transition(
    _scope: EmployeeRequestScope,
    requestId: string,
    input: import("@/lib/schemas/request-api").StatusTransitionInput,
  ): Promise<
    RepositoryResult<{ id: string; status: string; updatedAt: string }>
  > {
    const result = await this.client.rpc("transition_request_status", {
      p_request_id: requestId,
      p_new_status: input.newStatus,
      p_reason: (input.reason ?? null) as never,
      p_expected_updated_at: input.expectedUpdatedAt,
    });
    if (result.error) return failure(mapRpcError(result.error.message));
    return {
      ok: true,
      value: {
        id: result.data.id,
        status: result.data.status,
        updatedAt: result.data.updated_at,
      },
    };
  }

  async addNote(
    _scope: EmployeeRequestScope,
    requestId: string,
    input: import("@/lib/schemas/request-api").InternalNoteInput,
  ): Promise<RepositoryResult<{ id: string; createdAt: string }>> {
    const result = await this.client.rpc("add_internal_note", {
      p_request_id: requestId,
      p_content: input.content,
    });
    if (result.error) return failure(mapRpcError(result.error.message));
    return {
      ok: true,
      value: { id: result.data.id, createdAt: result.data.created_at },
    };
  }

  async approveQuotation(
    _scope: EmployeeRequestScope,
    requestId: string,
    attachmentId: string,
  ) {
    const result = await this.client.rpc("approve_quotation_attachment", {
      p_request_id: requestId,
      p_attachment_id: attachmentId,
    });
    if (result.error) return failure(mapRpcError(result.error.message));
    return {
      ok: true as const,
      value: { id: result.data.id, approvedAt: result.data.approved_at! },
    };
  }

  async requestInformation(
    _scope: EmployeeRequestScope,
    requestId: string,
    input: import("@/lib/schemas/request-api").RequestInformationInput,
  ): Promise<
    RepositoryResult<{ id: string; status: string; updatedAt: string }>
  > {
    const result = await this.client.rpc("request_more_information", {
      p_request_id: requestId,
      p_question: input.question,
      p_expected_updated_at: input.expectedUpdatedAt,
    });
    if (result.error) return failure(mapRpcError(result.error.message));
    return {
      ok: true,
      value: {
        id: result.data.id,
        status: result.data.status,
        updatedAt: result.data.updated_at,
      },
    };
  }
}
