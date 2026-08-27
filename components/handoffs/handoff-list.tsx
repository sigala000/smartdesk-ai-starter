import Link from "next/link";

import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import type { HandoffSummary } from "@/lib/dto/handoff-dto";
export function HandoffList({
  handoffs,
}: {
  handoffs: readonly HandoffSummary[];
}) {
  if (!handoffs.length)
    return (
      <div className="empty-state">
        <span className="empty-state-icon">
          <DashboardIcon name="handoffs" size={42} />
        </span>
        <h2>No handoffs</h2>
        <p>
          No customer conversations currently need human attention. You&apos;re
          all caught up for now.
        </p>
      </div>
    );
  return (
    <div className="request-list">
      {handoffs.map((h) => (
        <article className="request-card" key={h.id}>
          <div>
            <p className="eyebrow">{h.priority} priority</p>
            <h2>{h.requestReference ?? "Customer conversation"}</h2>
            <p>{h.reason}</p>
            <p>
              Status: <strong>{h.status}</strong>
            </p>
          </div>
          <Link href={`/dashboard/handoffs/${h.id}`}>Open handoff</Link>
        </article>
      ))}
    </div>
  );
}
