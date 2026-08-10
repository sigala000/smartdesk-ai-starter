import type { EmployeeAccessContext } from "@/lib/auth/access-records";
import { can, type Permission } from "@/lib/auth/permissions";
import {
  canRoleTransition,
  transitionReasonRequired,
} from "@/lib/domain/request-transitions";
import { failure, success, type Result } from "@/lib/core/result";
import type {
  EmployeeRequestDetail,
  RequestListResult,
} from "@/lib/dto/request-dto";
import {
  scopeFromAccess,
  type RequestRepository,
} from "@/lib/repositories/request-repository";
import type {
  AssignmentInput,
  InternalNoteInput,
  RequestInformationInput,
  RequestListQuery,
  StatusTransitionInput,
} from "@/lib/schemas/request-api";

export type RequestServiceError = Readonly<{
  code:
    | "forbidden"
    | "not_found"
    | "conflict"
    | "validation_error"
    | "internal_error";
  message: string;
}>;

function denied(): RequestServiceError {
  return {
    code: "forbidden",
    message: "You are not authorized to perform this action.",
  };
}

function mapRepositoryError(code: string): RequestServiceError {
  if (code === "request_not_found" || code === "not_found")
    return { code: "not_found", message: "Request not found." };
  if (code.includes("forbidden")) return denied();
  if (code === "invalid_cursor")
    return {
      code: "validation_error",
      message: "The pagination cursor is invalid.",
    };
  if (
    [
      "stale_request",
      "invalid_transition",
      "conversation_required",
      "invalid_department",
      "invalid_member",
      "member_department_mismatch",
      "cancellation_reason_required",
      "assignment_target_required",
      "responsible_employee_required",
      "quotation_attachment_required",
      "transition_provenance_required",
    ].includes(code)
  ) {
    const messages: Record<string, string> = {
      stale_request: "The request changed. Refresh and try again.",
      invalid_transition: "That status transition is not allowed.",
      conversation_required:
        "This request has no active customer conversation.",
      invalid_department: "Select an active department in this organization.",
      invalid_member: "Select an active employee in this organization.",
      member_department_mismatch:
        "The employee does not belong to the selected department.",
      cancellation_reason_required: "A cancellation reason is required.",
      assignment_target_required: "Select a department or employee.",
      responsible_employee_required:
        "Assign a responsible employee before scheduling a site visit.",
      quotation_attachment_required:
        "An approved PDF quotation must be attached before marking it sent.",
      transition_provenance_required:
        "Record the required customer or authorization evidence in the reason.",
    };
    return {
      code: "conflict",
      message: messages[code] ?? "The request could not be changed.",
    };
  }
  if (code.startsWith("invalid_"))
    return {
      code: "validation_error",
      message: "The submitted value is invalid.",
    };
  return {
    code: "internal_error",
    message: "The request could not be completed.",
  };
}

export class RequestService {
  constructor(private readonly repository: RequestRepository) {}

  private allowed(
    access: EmployeeAccessContext,
    permission: Permission,
  ): boolean {
    return can(access.membership.role, permission);
  }

  async list(
    access: EmployeeAccessContext,
    query: RequestListQuery,
  ): Promise<Result<RequestListResult, RequestServiceError>> {
    if (!this.allowed(access, "requests:list")) return failure(denied());
    const result = await this.repository.list(scopeFromAccess(access), query);
    return result.ok
      ? success(result.value)
      : failure(mapRepositoryError(result.code));
  }

  async options(access: EmployeeAccessContext) {
    if (!this.allowed(access, "requests:list")) return failure(denied());
    const result = await this.repository.options(scopeFromAccess(access));
    return result.ok
      ? success(result.value)
      : failure(mapRepositoryError(result.code));
  }

  async detail(
    access: EmployeeAccessContext,
    requestId: string,
  ): Promise<Result<EmployeeRequestDetail, RequestServiceError>> {
    if (!this.allowed(access, "requests:view")) return failure(denied());
    const result = await this.repository.findDetail(
      scopeFromAccess(access),
      requestId,
      this.allowed(access, "requests:notes:view"),
    );
    return result.ok
      ? success(result.value)
      : failure(mapRepositoryError(result.code));
  }

  async assign(
    access: EmployeeAccessContext,
    requestId: string,
    input: AssignmentInput,
  ) {
    if (!this.allowed(access, "requests:assign")) return failure(denied());
    const result = await this.repository.assign(
      scopeFromAccess(access),
      requestId,
      input,
    );
    return result.ok
      ? success(result.value)
      : failure(mapRepositoryError(result.code));
  }

  async transition(
    access: EmployeeAccessContext,
    requestId: string,
    input: StatusTransitionInput,
  ) {
    if (!this.allowed(access, "requests:status:update"))
      return failure(denied());
    const current = await this.repository.findDetail(
      scopeFromAccess(access),
      requestId,
      false,
    );
    if (!current.ok) return failure(mapRepositoryError(current.code));
    if (
      !canRoleTransition(
        access.membership.role,
        current.value.status,
        input.newStatus,
        current.value.requestType,
      )
    ) {
      return failure({
        code: "conflict",
        message: "That status transition is not allowed.",
      } satisfies RequestServiceError);
    }
    if (transitionReasonRequired(input.newStatus) && !input.reason) {
      return failure({
        code: "conflict",
        message: "A cancellation reason is required.",
      } satisfies RequestServiceError);
    }
    const result = await this.repository.transition(
      scopeFromAccess(access),
      requestId,
      input,
    );
    return result.ok
      ? success(result.value)
      : failure(mapRepositoryError(result.code));
  }

  async addNote(
    access: EmployeeAccessContext,
    requestId: string,
    input: InternalNoteInput,
  ) {
    if (!this.allowed(access, "requests:notes:create"))
      return failure(denied());
    const result = await this.repository.addNote(
      scopeFromAccess(access),
      requestId,
      input,
    );
    return result.ok
      ? success(result.value)
      : failure(mapRepositoryError(result.code));
  }

  async requestInformation(
    access: EmployeeAccessContext,
    requestId: string,
    input: RequestInformationInput,
  ) {
    if (!this.allowed(access, "requests:request_information"))
      return failure(denied());
    const result = await this.repository.requestInformation(
      scopeFromAccess(access),
      requestId,
      input,
    );
    return result.ok
      ? success(result.value)
      : failure(mapRepositoryError(result.code));
  }
}
