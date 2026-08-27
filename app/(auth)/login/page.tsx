import { redirect } from "next/navigation";
import Link from "next/link";

import { LoginForm } from "@/app/(auth)/login/login-form";
import { resolveEmployeeAccess } from "@/lib/auth/access-context";
import {
  resolveMembershipRequiredRedirect,
  sanitizeInternalRedirect,
} from "@/lib/auth/login-schema";
import { createClient } from "@/lib/supabase/server";

type LoginPageProps = Readonly<{
  searchParams: Promise<{ next?: string; status?: string }>;
}>;

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, status } = await searchParams;
  const supabase = await createClient();
  const access = await resolveEmployeeAccess(supabase);
  if (access.ok) redirect("/dashboard");
  if (access.authenticated) {
    if (access.code === "membership_required") {
      redirect(resolveMembershipRequiredRedirect(next));
    }
    redirect(`/unauthorized?reason=${access.code}`);
  }

  return (
    <main className="auth-page">
      <section aria-labelledby="login-title" className="auth-card">
        <p className="eyebrow">Employee portal</p>
        <h1 id="login-title">Welcome back</h1>
        <p className="lead">
          Sign in with the employee account provided by your organization.
        </p>
        {status === "session-required" ? (
          <p className="status-message" role="status">
            Sign in to continue. Your previous session may have expired.
          </p>
        ) : null}
        {status === "signed-out" ? (
          <p className="status-message" role="status">
            You have signed out securely.
          </p>
        ) : null}
        {status === "password-reset" ? (
          <p className="status-message" role="status">
            Your password was updated. Sign in with the new password.
          </p>
        ) : null}
        <LoginForm nextPath={sanitizeInternalRedirect(next)} />
        <p className="auth-support-link">
          <Link href="/forgot-password">Forgot your password?</Link>
        </p>
      </section>
    </main>
  );
}
