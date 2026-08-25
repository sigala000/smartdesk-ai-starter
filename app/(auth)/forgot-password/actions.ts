"use server";

import { serverEnvironment } from "@/lib/config/env-server";
import { createClient } from "@/lib/supabase/server";

export type RecoveryState = Readonly<{ sent: boolean }>;

export async function requestPasswordRecovery(
  _state: RecoveryState,
  formData: FormData,
): Promise<RecoveryState> {
  const value = formData.get("email");
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) &&
    serverEnvironment.APP_BASE_URL
  ) {
    const origin = new URL(serverEnvironment.APP_BASE_URL).origin;
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });
  }
  return { sent: true };
}
