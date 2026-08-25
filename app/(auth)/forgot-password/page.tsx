import Link from "next/link";

import { RecoveryForm } from "./recovery-form";

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page">
      <section aria-labelledby="recovery-title" className="auth-card">
        <p className="eyebrow">Account recovery</p>
        <h1 id="recovery-title">Reset your password</h1>
        <p className="lead">
          Enter your work email. The response is intentionally the same whether
          or not an account exists.
        </p>
        <RecoveryForm />
        <p className="auth-support-link">
          <Link href="/login">Return to sign in</Link>
        </p>
      </section>
    </main>
  );
}
