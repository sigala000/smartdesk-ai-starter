import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RequestActions } from "@/components/requests/request-actions";
import { RequestDetail } from "@/components/requests/request-detail";
import { can } from "@/lib/auth/permissions";
import { requestIdSchema } from "@/lib/schemas/request-api";
import { createRequestRuntime } from "@/lib/services/request-runtime";

type PageProps = Readonly<{ params: Promise<{ requestId: string }> }>;

export default async function RequestPage({ params }: PageProps) {
  const id = requestIdSchema.safeParse((await params).requestId);
  if (!id.success) notFound();
  const runtime = await createRequestRuntime();
  if (!runtime.access.ok) {
    if (!runtime.access.authenticated)
      redirect(
        `/login?status=session-required&next=${encodeURIComponent(`/dashboard/requests/${id.data}`)}`,
      );
    redirect("/unauthorized?reason=forbidden");
  }
  const result = await runtime.service.detail(runtime.access.context, id.data);
  if (!result.ok) {
    if (result.error.code === "not_found") notFound();
    if (result.error.code === "forbidden")
      redirect("/unauthorized?reason=forbidden");
    throw new Error("Request detail unavailable");
  }
  const role = runtime.access.context.membership.role;
  return (
    <section>
      <Link className="back-link" href="/dashboard/requests">
        ← Back to requests
      </Link>
      <header className="page-header">
        <div>
          <p className="eyebrow">{result.value.referenceNumber}</p>
          <h1>{result.value.title}</h1>
        </div>
      </header>
      <RequestDetail request={result.value} />
      <RequestActions
        request={result.value}
        role={role}
        canAssign={can(role, "requests:assign")}
        canTransition={can(role, "requests:status:update")}
        canAddNote={can(role, "requests:notes:create")}
        canRequestInformation={can(role, "requests:request_information")}
      />
    </section>
  );
}
