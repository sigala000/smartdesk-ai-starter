import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="register-title">
        <p className="eyebrow">Company onboarding</p>
        <h1 id="register-title">Create your SmartDesk workspace</h1>
        <p className="lead">
          Start a secure company trial. You will configure services and connect
          WhatsApp after signing in.
        </p>
        <RegisterForm />
      </section>
    </main>
  );
}
