import type { SupabaseClient } from "@supabase/supabase-js";

import type { EmployeeAccessContext } from "@/lib/auth/access-records";
import type {
  EmployeeRequestDetail,
  RequestListResult,
} from "@/lib/dto/request-dto";
import type {
  AssignmentInput,
  InternalNoteInput,
  RequestInformationInput,
  RequestListQuery,
  StatusTransitionInput,
} from "@/lib/schemas/request-api";
import type { Database } from "@/lib/supabase/database.types";

export type EmployeeRequestScope = Readonly<{
  organizationId: string;
  memberId: string;
  role: EmployeeAccessContext["membership"]["role"];
  departmentId: string | null;
}>;

export type RepositoryFailure = Readonly<{ ok: false; code: string }>;
export type RepositoryResult<T> =
  Readonly<{ ok: true; value: T }> | RepositoryFailure;

export interface RequestRepository {
  options(scope: EmployeeRequestScope): Promise<
    RepositoryResult<
      Readonly<{
        departments: readonly Readonly<{ id: string; name: string }>[];
        members: readonly Readonly<{
          id: string;
          displayName: string;
          departmentId: string | null;
        }>[];
      }>
    >
  >;
  list(
    scope: EmployeeRequestScope,
    query: RequestListQuery,
  ): Promise<RepositoryResult<RequestListResult>>;
  findDetail(
    scope: EmployeeRequestScope,
    requestId: string,
    includeNotes: boolean,
  ): Promise<RepositoryResult<EmployeeRequestDetail>>;
  assign(
    scope: EmployeeRequestScope,
    requestId: string,
    input: AssignmentInput,
  ): Promise<RepositoryResult<{ id: string; updatedAt: string }>>;
  transition(
    scope: EmployeeRequestScope,
    requestId: string,
    input: StatusTransitionInput,
  ): Promise<
    RepositoryResult<{ id: string; status: string; updatedAt: string }>
  >;
  addNote(
    scope: EmployeeRequestScope,
    requestId: string,
    input: InternalNoteInput,
  ): Promise<RepositoryResult<{ id: string; createdAt: string }>>;
  requestInformation(
    scope: EmployeeRequestScope,
    requestId: string,
    input: RequestInformationInput,
  ): Promise<
    RepositoryResult<{ id: string; status: string; updatedAt: string }>
  >;
  approveQuotation(
    scope: EmployeeRequestScope,
    requestId: string,
    attachmentId: string,
  ): Promise<RepositoryResult<{ id: string; approvedAt: string }>>;
}

export type DatabaseClient = SupabaseClient<Database>;

export function scopeFromAccess(
  access: EmployeeAccessContext,
): EmployeeRequestScope {
  return {
    organizationId: access.organization.id,
    memberId: access.membership.id,
    role: access.membership.role,
    departmentId: access.membership.departmentId,
  };
}
