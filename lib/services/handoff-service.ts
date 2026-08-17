import type { EmployeeAccessContext } from "@/lib/auth/access-records";
import { can, type Permission } from "@/lib/auth/permissions";
import { failure, success } from "@/lib/core/result";
import type { EscalationDecision } from "@/lib/domain/handoffs";
import {
  handoffScope,
  type HandoffRepository,
} from "@/lib/repositories/handoff-repository";
import type {
  HandoffAssignInput,
  HandoffListQuery,
  HandoffMessageInput,
  HandoffResolveInput,
} from "@/lib/schemas/handoff-api";

export type HandoffServiceError = Readonly<{
  code:
    | "forbidden"
    | "not_found"
    | "conflict"
    | "validation_error"
    | "internal_error";
  message: string;
}>;
function map(code: string): HandoffServiceError {
  if (code.includes("not_found"))
    return { code: "not_found", message: "Handoff not found." };
  if (code.includes("forbidden") || code.includes("not_active_owner"))
    return {
      code: "forbidden",
      message: "You are not authorized to perform this handoff action.",
    };
  if (code.startsWith("invalid_"))
    return {
      code: "conflict",
      message: "The handoff changed or this action is not allowed.",
    };
  if (code.includes("conflict"))
    return {
      code: "conflict",
      message: "Another employee changed this handoff. Refresh and try again.",
    };
  return {
    code: "internal_error",
    message: "The handoff operation could not be completed.",
  };
}
export class HandoffService {
  constructor(private readonly repository: HandoffRepository) {}
  requestPublic(
    conversationId: string,
    tokenDigest: string,
    idempotencyKey: string,
    decision: EscalationDecision,
  ) {
    return this.repository.requestPublic(
      conversationId,
      tokenDigest,
      idempotencyKey,
      decision,
    );
  }
  activeForConversation(conversationId: string, tokenDigest: string) {
    return this.repository.activeForConversation(conversationId, tokenDigest);
  }
  private allowed(access: EmployeeAccessContext, p: Permission) {
    return can(access.membership.role, p);
  }
  async list(access: EmployeeAccessContext, query: HandoffListQuery) {
    if (!this.allowed(access, "handoffs:list"))
      return failure(map("forbidden"));
    const r = await this.repository.list(handoffScope(access), query);
    return r.ok ? success(r.value) : failure(map(r.code));
  }
  async detail(access: EmployeeAccessContext, id: string) {
    if (!this.allowed(access, "handoffs:view"))
      return failure(map("forbidden"));
    const r = await this.repository.detail(handoffScope(access), id);
    return r.ok ? success(r.value) : failure(map(r.code));
  }
  async members(access: EmployeeAccessContext) {
    if (!this.allowed(access, "handoffs:assign"))
      return failure(map("forbidden"));
    const r = await this.repository.members(handoffScope(access));
    return r.ok ? success(r.value) : failure(map(r.code));
  }
  async assign(
    access: EmployeeAccessContext,
    id: string,
    input: HandoffAssignInput,
  ) {
    if (!this.allowed(access, "handoffs:assign"))
      return failure(map("forbidden"));
    const r = await this.repository.assign(handoffScope(access), id, input);
    return r.ok ? success(r.value) : failure(map(r.code));
  }
  async join(access: EmployeeAccessContext, id: string) {
    if (!this.allowed(access, "handoffs:join"))
      return failure(map("forbidden"));
    const r = await this.repository.join(handoffScope(access), id);
    return r.ok ? success(r.value) : failure(map(r.code));
  }
  async message(
    access: EmployeeAccessContext,
    id: string,
    input: HandoffMessageInput,
  ) {
    if (!this.allowed(access, "handoffs:message"))
      return failure(map("forbidden"));
    const r = await this.repository.message(handoffScope(access), id, input);
    return r.ok ? success(r.value) : failure(map(r.code));
  }
  async resolve(
    access: EmployeeAccessContext,
    id: string,
    input: HandoffResolveInput,
  ) {
    if (!this.allowed(access, "handoffs:resolve"))
      return failure(map("forbidden"));
    const r = await this.repository.resolve(handoffScope(access), id, input);
    return r.ok ? success(r.value) : failure(map(r.code));
  }
}
