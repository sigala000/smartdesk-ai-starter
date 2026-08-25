import { ResetForm } from "./reset-form";

export default function ResetPasswordPage() {
  return (
    <main className="auth-page">
      <section aria-labelledby="reset-title" className="auth-card">
        <p className="eyebrow">Account recovery</p>
        <h1 id="reset-title">Choose a new password</h1>
        <p className="lead">
          Recovery links are short-lived and can only establish your
          authenticated recovery session.
        </p>
        <ResetForm />
      </section>
    </main>
  );
}
