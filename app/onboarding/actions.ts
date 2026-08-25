"use server";

import { redirect } from "next/navigation";

import { organizationOnboardingSchema } from "@/lib/schemas/organization-onboarding";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = Readonly<{ error?: string }>;

export async function createOrganization(
  _state: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsed = organizationOnboardingSchema.safeParse({
    name: formData.get("name"),
    displayName: formData.get("displayName"),
    slug: formData.get("slug"),
    referencePrefix: formData.get("referencePrefix"),
  });
  if (!parsed.success)
    return {
      error:
        "Review the company name, workspace address, and reference prefix.",
    };
  const supabase = await createClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user)
    redirect("/login?status=session-required&next=%2Fonboarding");
  const result = await supabase.rpc("create_owner_organization", {
    p_display_name: parsed.data.displayName,
    p_name: parsed.data.name,
    p_reference_prefix: parsed.data.referencePrefix,
    p_slug: parsed.data.slug,
    p_trial_days: 14,
  });
  if (result.error)
    return {
      error:
        "That workspace address or reference prefix is unavailable. Choose another.",
    };
  redirect("/dashboard/organization");
}
