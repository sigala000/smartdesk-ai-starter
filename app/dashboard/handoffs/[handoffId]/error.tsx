"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="error-panel">
      <h1>Handoff unavailable</h1>
      <button onClick={reset}>Try again</button>
    </section>
  );
}
