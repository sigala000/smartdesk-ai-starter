"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function acceptInvitation(formData: FormData) {
  const token = formData.get("token");
  if (typeof token !== "string" || token.length < 32 || token.length > 256)
    redirect("/unauthorized?reason=invitation_invalid");
  const supabase = await createClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user)
    redirect(
      `/login?status=session-required&next=${encodeURIComponent(`/invite/accept?token=${token}`)}`,
    );
  const result = await supabase.rpc("accept_organization_invitation", {
    p_token_digest: createHash("sha256").update(token).digest("hex"),
  });
  if (result.error) redirect("/unauthorized?reason=invitation_invalid");
  redirect("/dashboard");
}
