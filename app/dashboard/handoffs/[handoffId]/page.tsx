import { notFound, redirect } from "next/navigation";
import { HandoffActions } from "@/components/handoffs/handoff-actions";
import { createHandoffRuntime } from "@/lib/services/handoff-runtime";
import { can } from "@/lib/auth/permissions";
import Link from "next/link";
type P = { params: Promise<{ handoffId: string }> };
export default async function Page({ params }: P) {
  const { handoffId } = await params;
  const runtime = await createHandoffRuntime();
  if (!runtime.access.ok) {
    if (!runtime.access.authenticated)
      redirect(
        `/login?status=session-required&next=/dashboard/handoffs/${handoffId}`,
      );
    redirect("/unauthorized?reason=forbidden");
  }
  const canAssign = can(
    runtime.access.context.membership.role,
    "handoffs:assign",
  );
  const [detail, members] = await Promise.all([
    runtime.service.detail(runtime.access.context, handoffId),
    canAssign
      ? runtime.service.members(runtime.access.context)
      : Promise.resolve({ ok: true as const, value: [] }),
  ]);
  if (!detail.ok) {
    if (detail.error.code === "not_found") notFound();
    return <p className="error-panel">This handoff is unavailable.</p>;
  }
  return (
    <section className="handoff-detail">
      <Link className="back-link" href="/dashboard/handoffs">
        ← Back to handoff queue
      </Link>
      <header className="page-header">
        <div>
          <p className="eyebrow">{detail.value.priority} priority</p>
          <h1>{detail.value.customerName ?? "Customer conversation"}</h1>
          <span className="status-chip">{detail.value.status}</span>
          <p>{detail.value.reason}</p>
        </div>
      </header>
      <div
        className="chat-transcript"
        role="log"
        tabIndex={0}
        aria-label="Customer conversation"
      >
        {detail.value.messages.map((m) => (
          <article className={`chat-message ${m.senderType}`} key={m.id}>
            <strong>{m.senderType}</strong>
            <p>{m.content}</p>
          </article>
        ))}
      </div>
      {members.ok && (
        <HandoffActions
          handoff={detail.value}
          members={members.value}
          currentMemberId={runtime.access.context.membership.id}
          canAssign={canAssign}
          canOverride={["admin", "manager"].includes(
            runtime.access.context.membership.role,
          )}
        />
      )}
    </section>
  );
}
