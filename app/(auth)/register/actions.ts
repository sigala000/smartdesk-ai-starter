"use server";

import { redirect } from "next/navigation";

import { ownerRegistrationSchema } from "@/lib/schemas/organization-onboarding";
import { createClient } from "@/lib/supabase/server";

export type RegistrationState = Readonly<{ error?: string }>;

export async function registerOwner(
  _state: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const parsed = ownerRegistrationSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    captchaToken: formData.get("captchaToken") || undefined,
  });
  if (!parsed.success)
    return {
      error:
        "Enter a valid name, email, and password of at least 12 characters.",
    };
  const supabase = await createClient();
  const result = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      captchaToken: parsed.data.captchaToken,
    },
  });
  if (result.error)
    return {
      error:
        "Registration could not be completed. Sign in if this email already has an account.",
    };
  if (result.data.session) redirect("/onboarding");
  redirect("/login?status=check-email&next=%2Fonboarding");
}
