"use server";

import { redirect } from "next/navigation";

import { clearEmployeeSession } from "@/lib/auth/sign-out";
import { createClient } from "@/lib/supabase/server";

export async function logout() {
  const supabase = await createClient();
  const cleared = await clearEmployeeSession((options) =>
    supabase.auth.signOut(options),
  );
  if (!cleared) redirect("/unauthorized?reason=sign_out_failed");
  redirect("/login?status=signed-out");
}
