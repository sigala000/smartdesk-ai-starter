"use client";

export default function RequestsError({
  reset,
}: Readonly<{ reset: () => void }>) {
  return (
    <section>
      <p className="eyebrow">Request management</p>
      <h1>Requests unavailable</h1>
      <div className="error-panel">
        <p>We could not load the request queue.</p>
        <button onClick={reset}>Try again</button>
      </div>
    </section>
  );
}
