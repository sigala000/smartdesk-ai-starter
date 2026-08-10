import Link from "next/link";
import { redirect } from "next/navigation";

import { RequestFilters } from "@/components/requests/request-filters";
import { RequestList } from "@/components/requests/request-list";
import { requestListQuerySchema } from "@/lib/schemas/request-api";
import { createRequestRuntime } from "@/lib/services/request-runtime";

type PageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function RequestsPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const single = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
  const parsed = requestListQuerySchema.safeParse(single);
  const runtime = await createRequestRuntime();
  if (!runtime.access.ok) {
    if (!runtime.access.authenticated)
      redirect("/login?status=session-required&next=/dashboard/requests");
    redirect("/unauthorized?reason=forbidden");
  }
  if (!parsed.success) {
    return (
      <section>
        <p className="eyebrow">Request management</p>
        <h1>Requests</h1>
        <div className="error-panel">
          <h2>Invalid filters</h2>
          <p>Clear the filters and try again.</p>
          <Link href="/dashboard/requests">Clear filters</Link>
        </div>
      </section>
    );
  }
  const [requests, options] = await Promise.all([
    runtime.service.list(runtime.access.context, parsed.data),
    runtime.service.options(runtime.access.context),
  ]);
  if (!requests.ok || !options.ok) {
    return (
      <section>
        <p className="eyebrow">Request management</p>
        <h1>Requests</h1>
        <div className="error-panel">
          <h2>Requests unavailable</h2>
          <p>Refresh the page or try again later.</p>
          <Link href="/dashboard/requests">Try again</Link>
        </div>
      </section>
    );
  }
  const current = Object.fromEntries(
    Object.entries(single).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const next = requests.value.nextCursor
    ? new URLSearchParams({
        ...current,
        cursor: requests.value.nextCursor,
      }).toString()
    : null;
  return (
    <section>
      <header className="page-header">
        <div>
          <p className="eyebrow">Request management</p>
          <h1>Requests</h1>
          <p>
            Search, route, and process customer requests you are authorized to
            access.
          </p>
        </div>
      </header>
      <RequestFilters
        values={single as Record<string, string | undefined>}
        departments={options.value.departments}
        members={options.value.members}
      />
      <RequestList
        result={requests.value}
        nextHref={next ? `/dashboard/requests?${next}` : null}
      />
    </section>
  );
}
