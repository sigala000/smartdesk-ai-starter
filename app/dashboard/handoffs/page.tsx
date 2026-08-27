import Link from "next/link";
import { redirect } from "next/navigation";
import { HandoffList } from "@/components/handoffs/handoff-list";
import { handoffListQuerySchema } from "@/lib/schemas/handoff-api";
import { createHandoffRuntime } from "@/lib/services/handoff-runtime";
type P = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export default async function Page({ searchParams }: P) {
  const raw = await searchParams;
  const parsed = handoffListQuerySchema.safeParse({
    status: Array.isArray(raw.status) ? raw.status[0] : raw.status,
  });
  const runtime = await createHandoffRuntime();
  if (!runtime.access.ok) {
    if (!runtime.access.authenticated)
      redirect("/login?status=session-required&next=/dashboard/handoffs");
    redirect("/unauthorized?reason=forbidden");
  }
  if (!parsed.success)
    return (
      <section>
        <h1>Human handoffs</h1>
        <p className="error-panel">Invalid queue filter.</p>
      </section>
    );
  const result = await runtime.service.list(
    runtime.access.context,
    parsed.data,
  );
  const activeStatus = parsed.data.status ?? "open";
  return (
    <section>
      <header className="page-header">
        <div>
          <p className="eyebrow">Customer support</p>
          <h1>Human handoff queue</h1>
          <p>
            Assignment does not mean an employee has joined. Acceptance makes
            human ownership active.
          </p>
        </div>
      </header>
      <nav aria-label="Handoff filters" className="queue-filters">
        {(["open", "active", "resolved"] as const).map((status) => (
          <Link
            aria-current={activeStatus === status ? "page" : undefined}
            href={`/dashboard/handoffs?status=${status}`}
            key={status}
          >
            {status[0].toUpperCase() + status.slice(1)}
          </Link>
        ))}
      </nav>
      {result.ok ? (
        <HandoffList handoffs={result.value} />
      ) : (
        <p className="error-panel">
          The handoff queue is unavailable. Refresh and try again.
        </p>
      )}
    </section>
  );
}
