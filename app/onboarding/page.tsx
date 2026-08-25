import { redirect } from "next/navigation";

import { OnboardingForm } from "./onboarding-form";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?status=session-required&next=%2Fonboarding");
  const memberships = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", data.user.id)
    .eq("is_active", true)
    .limit(1);
  if (memberships.data?.length) redirect("/dashboard/organization");
  const displayName =
    typeof data.user.user_metadata.full_name === "string"
      ? data.user.user_metadata.full_name
      : (data.user.email?.split("@")[0] ?? "Company owner");
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="onboarding-title">
        <p className="eyebrow">Workspace setup</p>
        <h1 id="onboarding-title">Tell us about your company</h1>
        <p className="lead">
          This creates an isolated workspace in onboarding mode. Customer
          channels activate only after setup.
        </p>
        <OnboardingForm displayName={displayName} />
      </section>
    </main>
  );
}
