import type { EmployeeAccessContext } from "@/lib/auth/access-records";
import type { HandoffDetail, HandoffSummary } from "@/lib/dto/handoff-dto";
import type { EscalationDecision } from "@/lib/domain/handoffs";
import type {
  HandoffAssignInput,
  HandoffListQuery,
  HandoffMessageInput,
  HandoffResolveInput,
} from "@/lib/schemas/handoff-api";

export type HandoffScope = Readonly<{
  organizationId: string;
  memberId: string;
  role: EmployeeAccessContext["membership"]["role"];
  departmentId: string | null;
}>;
export type HandoffRepositoryResult<T> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; code: string }>;

export interface HandoffRepository {
  requestPublic(
    conversationId: string,
    tokenDigest: string,
    idempotencyKey: string,
    decision: EscalationDecision,
  ): Promise<HandoffRepositoryResult<HandoffSummary>>;
  activeForConversation(
    conversationId: string,
    tokenDigest: string,
  ): Promise<HandoffRepositoryResult<HandoffSummary | null>>;
  list(
    scope: HandoffScope,
    query: HandoffListQuery,
  ): Promise<HandoffRepositoryResult<readonly HandoffSummary[]>>;
  detail(
    scope: HandoffScope,
    handoffId: string,
  ): Promise<HandoffRepositoryResult<HandoffDetail>>;
  members(
    scope: HandoffScope,
  ): Promise<
    HandoffRepositoryResult<
      readonly Readonly<{ id: string; displayName: string }>[]
    >
  >;
  assign(
    scope: HandoffScope,
    handoffId: string,
    input: HandoffAssignInput,
  ): Promise<HandoffRepositoryResult<HandoffSummary>>;
  join(
    scope: HandoffScope,
    handoffId: string,
  ): Promise<HandoffRepositoryResult<HandoffSummary>>;
  message(
    scope: HandoffScope,
    handoffId: string,
    input: HandoffMessageInput,
  ): Promise<HandoffRepositoryResult<{ id: string; createdAt: string }>>;
  resolve(
    scope: HandoffScope,
    handoffId: string,
    input: HandoffResolveInput,
  ): Promise<HandoffRepositoryResult<HandoffSummary>>;
}

export function handoffScope(access: EmployeeAccessContext): HandoffScope {
  return {
    organizationId: access.organization.id,
    memberId: access.membership.id,
    role: access.membership.role,
    departmentId: access.membership.departmentId,
  };
}
