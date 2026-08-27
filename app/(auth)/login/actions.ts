"use server";

import { redirect } from "next/navigation";

import { resolveEmployeeAccess } from "@/lib/auth/access-context";
import {
  loginSchema,
  resolveMembershipRequiredRedirect,
  sanitizeInternalRedirect,
} from "@/lib/auth/login-schema";
import { clearEmployeeSession } from "@/lib/auth/sign-out";
import { createClient } from "@/lib/supabase/server";

export type LoginState = Readonly<{
  error: string | null;
  email: string;
}>;

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });

  if (!parsed.success) {
    const email = formData.get("email");
    return {
      error: "Enter a valid email address and password.",
      email: typeof email === "string" ? email.slice(0, 254) : "",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      error: "The email or password is incorrect.",
      email: parsed.data.email,
    };
  }

  const access = await resolveEmployeeAccess(supabase);
  if (!access.ok) {
    if (access.code === "membership_required") {
      redirect(resolveMembershipRequiredRedirect(parsed.data.next));
    }
    const cleared = await clearEmployeeSession((options) =>
      supabase.auth.signOut(options),
    );
    if (!cleared) redirect("/unauthorized?reason=sign_out_failed");
    redirect(`/unauthorized?reason=${access.code}`);
  }

  redirect(sanitizeInternalRedirect(parsed.data.next));
}
