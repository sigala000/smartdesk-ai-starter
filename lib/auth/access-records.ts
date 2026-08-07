import type { User } from "@supabase/supabase-js";

import { isEmployeeRole, type EmployeeRole } from "@/lib/auth/roles";

export type EmployeeAccessContext = Readonly<{
  user: Readonly<{ id: string; email: string | null }>;
  membership: Readonly<{
    id: string;
    displayName: string;
    role: EmployeeRole;
    departmentId: string | null;
    departmentName: string | null;
  }>;
  organization: Readonly<{
    id: string;
    name: string;
    slug: string;
  }>;
}>;

export type AccessFailureCode =
  | "unauthenticated"
  | "membership_required"
  | "membership_ambiguous"
  | "organization_inactive"
  | "invalid_role"
  | "internal_error";

export type AccessResolution =
  | Readonly<{ ok: true; context: EmployeeAccessContext }>
  | Readonly<{
      ok: false;
      code: AccessFailureCode;
      authenticated: boolean;
    }>;

export type MembershipRecord = Readonly<{
  id: string;
  display_name: string;
  role: string;
  department_id: string | null;
  organizations:
    | Readonly<{ id: string; name: string; slug: string; is_active: boolean }>
    | readonly Readonly<{
        id: string;
        name: string;
        slug: string;
        is_active: boolean;
      }>[];
  departments:
    | Readonly<{ id: string; name: string }>
    | readonly Readonly<{ id: string; name: string }>[]
    | null;
}>;

function one<T>(value: T | readonly T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value as T | null;
}

export function resolveAccessRecords(
  user: Pick<User, "id" | "email">,
  records: readonly MembershipRecord[],
): AccessResolution {
  if (records.length === 0) {
    return { ok: false, code: "membership_required", authenticated: true };
  }
  if (records.length !== 1) {
    return { ok: false, code: "membership_ambiguous", authenticated: true };
  }

  const record = records[0];
  const organization = one(record.organizations);
  const department = one(record.departments);

  if (!organization?.is_active) {
    return { ok: false, code: "organization_inactive", authenticated: true };
  }
  if (!isEmployeeRole(record.role)) {
    return { ok: false, code: "invalid_role", authenticated: true };
  }

  return {
    ok: true,
    context: {
      user: { id: user.id, email: user.email ?? null },
      membership: {
        id: record.id,
        displayName: record.display_name,
        role: record.role,
        departmentId: record.department_id,
        departmentName: department?.name ?? null,
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
    },
  };
}
