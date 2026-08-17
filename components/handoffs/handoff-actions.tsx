"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { HandoffDetail } from "@/lib/dto/handoff-dto";
async function send(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(
      payload.error?.message ?? "The handoff could not be updated.",
    );
}
export function HandoffActions({
  handoff,
  members,
  currentMemberId,
  canAssign,
  canOverride,
}: {
  handoff: HandoffDetail;
  members: readonly { id: string; displayName: string }[];
  currentMemberId: string;
  canAssign: boolean;
  canOverride: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function act(url: string, body?: unknown) {
    setPending(true);
    setError(null);
    try {
      await send(url, body);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="handoff-actions detail-card" aria-busy={pending}>
      <h2>Handoff controls</h2>
      {error && (
        <p className="error-panel" role="alert">
          {error}
        </p>
      )}
      {handoff.status === "queued" && canAssign && (
        <>
          <label>
            Assign employee
            <select defaultValue={currentMemberId} id="handoff-member">
              {members.map((m) => (
                <option value={m.id} key={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={pending}
            onClick={() => {
              const el = document.getElementById(
                "handoff-member",
              ) as HTMLSelectElement;
              void act(`/api/dashboard/handoffs/${handoff.id}/assignment`, {
                memberId: el.value,
              });
            }}
          >
            Assign
          </button>
        </>
      )}
      {handoff.status === "assigned" &&
        (handoff.assignedMemberId === currentMemberId || canOverride) && (
          <button
            disabled={pending}
            onClick={() =>
              void act(`/api/dashboard/handoffs/${handoff.id}/join`)
            }
          >
            Accept and join conversation
          </button>
        )}
      {handoff.status === "active" &&
        (handoff.assignedMemberId === currentMemberId || canOverride) && (
          <>
            <form
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                const value = message;
                setMessage("");
                void act(`/api/dashboard/handoffs/${handoff.id}/messages`, {
                  clientMessageId: crypto.randomUUID(),
                  message: value,
                });
              }}
            >
              <label>
                Reply to customer
                <textarea
                  required
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </label>
              <button disabled={pending || !message.trim()}>Send reply</button>
            </form>
            <button
              disabled={pending}
              onClick={() =>
                void act(`/api/dashboard/handoffs/${handoff.id}/resolve`, {
                  resolution: "Customer support handoff resolved.",
                  resumeAutomation: true,
                })
              }
            >
              Resolve and resume assistant
            </button>
            <button
              disabled={pending}
              onClick={() =>
                void act(`/api/dashboard/handoffs/${handoff.id}/resolve`, {
                  resolution:
                    "Customer support handoff resolved without automation.",
                  resumeAutomation: false,
                })
              }
            >
              Resolve without assistant
            </button>
          </>
        )}
    </section>
  );
}
