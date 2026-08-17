"use client";
import { useState, type FormEvent } from "react";
import type { CustomerRequestStatus } from "@/lib/dto/request-status-dto";
type Challenge = {
  challengeId: string;
  expiresAt: string;
  deliveryHint: string;
  developmentCode?: string;
};
async function json(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    request?: CustomerRequestStatus;
  } & Record<string, unknown>;
  if (!response.ok)
    throw new Error(
      payload.error?.message ?? "The operation could not be completed.",
    );
  return payload;
}
export function RequestStatusFlow({
  conversationId,
}: {
  conversationId?: string;
}) {
  const [reference, setReference] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [status, setStatus] = useState<CustomerRequestStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(work: () => Promise<void>) {
    setPending(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The operation failed.");
    } finally {
      setPending(false);
    }
  }
  function begin(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      const value = (await json("/api/request-status/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationSlug: "buildpro-cameroon",
          referenceNumber: reference,
          phone,
        }),
      })) as unknown as Challenge;
      setChallenge(value);
    });
  }
  function verify(e: FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    void run(async () => {
      const value = (await json("/api/request-status/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          code,
          ...(conversationId ? { conversationId } : {}),
        }),
      })) as { verificationToken: string };
      const result = await json(
        `/api/request-status/${encodeURIComponent(reference)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${value.verificationToken}` },
        },
      );
      setStatus(result.request ?? null);
    });
  }
  if (status)
    return (
      <div className="success-panel" role="status">
        <h2>{status.displayStatus}</h2>
        <dl>
          <dt>Reference</dt>
          <dd>{status.referenceNumber}</dd>
          <dt>Service</dt>
          <dd>{status.serviceName}</dd>
          <dt>Latest update</dt>
          <dd>{status.lastUpdate}</dd>
          <dt>Next action</dt>
          <dd>{status.nextAction}</dd>
        </dl>
        <button
          onClick={() => {
            setStatus(null);
            setChallenge(null);
            setCode("");
          }}
        >
          Check another request
        </button>
      </div>
    );
  return (
    <>
      {error && (
        <p className="error-panel" role="alert">
          {error}
        </p>
      )}
      {!challenge ? (
        <form className="status-form" onSubmit={begin}>
          <label htmlFor="reference">Request reference</label>
          <input
            id="reference"
            required
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            autoComplete="off"
            placeholder="BP-2026-000041"
          />
          <label htmlFor="phone">Confirmed contact number</label>
          <input
            id="phone"
            required
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            placeholder="+2376XXXXXXXX"
          />
          <button disabled={pending}>
            {pending ? "Requesting…" : "Send verification code"}
          </button>
        </form>
      ) : (
        <form className="status-form" onSubmit={verify}>
          <p>{challenge.deliveryHint}</p>
          {challenge.developmentCode && (
            <p className="notice-panel">
              Development code: <strong>{challenge.developmentCode}</strong>
            </p>
          )}
          <label htmlFor="code">Six-digit verification code</label>
          <input
            id="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button disabled={pending}>
            {pending ? "Verifying…" : "Verify and view status"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setChallenge(null);
              setCode("");
              setError(null);
            }}
          >
            Start again
          </button>
        </form>
      )}
    </>
  );
}
