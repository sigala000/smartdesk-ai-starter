"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type ResetState = Readonly<{ error: string | null }>;

export async function resetPassword(
  _state: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 1024 ||
    password !== confirmation
  )
    return {
      error: "Use at least 12 characters and enter the same password twice.",
    };
  const supabase = await createClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user)
    return { error: "This recovery link is invalid or has expired." };
  const result = await supabase.auth.updateUser({ password });
  if (result.error)
    return {
      error: "The password could not be updated. Request a new recovery link.",
    };
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?status=password-reset");
}
