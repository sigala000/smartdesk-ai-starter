import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";

type UnauthorizedPageProps = Readonly<{
  searchParams: Promise<{ reason?: string }>;
}>;

const accessMessages: Readonly<Record<string, string>> = {
  forbidden: "Your role does not allow access to that page.",
  membership_ambiguous:
    "More than one active organization is linked to this account. Ask an administrator to review your access.",
  organization_inactive:
    "Your organization is not currently available. Contact an administrator.",
  invalid_role:
    "Your employee role could not be verified. Contact an administrator.",
  internal_error: "Access could not be verified right now. Try again shortly.",
  membership_required:
    "This account does not have an active employee membership. Contact an administrator.",
  sign_out_failed:
    "Your session could not be cleared. Close this browser on a shared device and try signing out again.",
  unauthenticated: "Your session has expired. Sign in again to continue.",
};

export default async function UnauthorizedPage({
  searchParams,
}: UnauthorizedPageProps) {
  const { reason = "membership_required" } = await searchParams;
  const message = accessMessages[reason] ?? accessMessages.membership_required;

  return (
    <main className="auth-page">
      <section aria-labelledby="access-title" className="auth-card">
        <p className="eyebrow">Access unavailable</p>
        <h1 id="access-title">We could not open the dashboard</h1>
        <p className="lead">{message}</p>
        <div className="button-row">
          <Link className="button button-primary" href="/login">
            Return to sign in
          </Link>
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}
