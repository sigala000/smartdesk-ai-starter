"use client";

import Link from "next/link";

export default function RequestError({
  reset,
}: Readonly<{ reset: () => void }>) {
  return (
    <section>
      <p className="eyebrow">Request detail</p>
      <h1>Request unavailable</h1>
      <div className="error-panel">
        <p>We could not load this request.</p>
        <button onClick={reset}>Try again</button>{" "}
        <Link href="/dashboard/requests">Return to requests</Link>
      </div>
    </section>
  );
}
