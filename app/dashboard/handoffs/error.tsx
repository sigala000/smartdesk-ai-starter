"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="error-panel">
      <h1>Handoff queue unavailable</h1>
      <p>Refresh the queue and try again.</p>
      <button onClick={reset}>Try again</button>
    </section>
  );
}
