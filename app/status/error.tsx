"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="page-shell">
      <section className="error-panel">
        <h1>Status lookup unavailable</h1>
        <p>Please try again without sharing your verification code.</p>
        <button onClick={reset}>Try again</button>
      </section>
    </main>
  );
}
