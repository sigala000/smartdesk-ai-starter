import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  resolveAccessRecords,
  type AccessResolution,
} from "@/lib/auth/access-records";
import type { Database } from "@/lib/supabase/database.types";

export type { EmployeeAccessContext } from "@/lib/auth/access-records";

export async function resolveEmployeeAccess(
  supabase: SupabaseClient<Database>,
): Promise<AccessResolution> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, code: "unauthenticated", authenticated: false };
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select(
      "id, display_name, role, department_id, organizations!inner(id, name, slug, is_active), departments(id, name)",
    )
    .eq("user_id", userData.user.id)
    .eq("is_active", true)
    .limit(2);

  if (error || !data) {
    return { ok: false, code: "internal_error", authenticated: true };
  }

  return resolveAccessRecords(userData.user, data);
}
