"use client";

type DashboardErrorProps = Readonly<{ reset: () => void }>;

export default function DashboardError({ reset }: DashboardErrorProps) {
  return (
    <main className="auth-page">
      <section aria-labelledby="error-title" className="auth-card">
        <p className="eyebrow">Something went wrong</p>
        <h1 id="error-title">The dashboard could not be loaded</h1>
        <p className="lead">
          Your information has not been changed. Try loading the dashboard
          again.
        </p>
        <button className="button button-primary" onClick={reset} type="button">
          Try again
        </button>
      </section>
    </main>
  );
}
