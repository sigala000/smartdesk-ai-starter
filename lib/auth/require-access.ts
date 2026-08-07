import "server-only";

import { redirect } from "next/navigation";

import { resolveEmployeeAccess } from "@/lib/auth/access-context";
import { can, type Permission } from "@/lib/auth/permissions";
import { sanitizeInternalRedirect } from "@/lib/auth/login-schema";
import { createClient } from "@/lib/supabase/server";

export async function requireEmployeeAccess(returnTo = "/dashboard") {
  const supabase = await createClient();
  const access = await resolveEmployeeAccess(supabase);

  if (!access.ok) {
    if (!access.authenticated) {
      redirect(
        `/login?status=session-required&next=${encodeURIComponent(sanitizeInternalRedirect(returnTo))}`,
      );
    }
    redirect(`/unauthorized?reason=${access.code}`);
  }

  return access.context;
}

export async function requirePermission(
  permission: Permission,
  returnTo: string,
) {
  const context = await requireEmployeeAccess(returnTo);
  if (!can(context.membership.role, permission)) {
    redirect("/unauthorized?reason=forbidden");
  }
  return context;
}
