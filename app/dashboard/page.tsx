import Link from "next/link";

import { requireEmployeeAccess } from "@/lib/auth/require-access";

export default async function DashboardPage() {
  const access = await requireEmployeeAccess("/dashboard");

  return (
    <section aria-labelledby="dashboard-title" className="dashboard-overview">
      <header className="overview-header">
        <div>
          <p className="eyebrow">Operations overview</p>
          <h1 id="dashboard-title">
            Good day, {access.membership.displayName}
          </h1>
          <p>
            Review customer requests, respond to handoffs, and keep BuildPro
            work moving from one secure workspace.
          </p>
        </div>
        <Link className="button button-primary" href="/dashboard/requests">
          View all requests
        </Link>
      </header>
      <div className="overview-grid">
        <Link className="overview-card accent-blue" href="/dashboard/requests">
          <span className="overview-icon" aria-hidden="true">
            ↗
          </span>
          <div>
            <p>Request management</p>
            <strong>Open the request queue</strong>
          </div>
          <span>Search, assign and update customer work.</span>
        </Link>
        <Link className="overview-card accent-lilac" href="/dashboard/handoffs">
          <span className="overview-icon" aria-hidden="true">
            ◎
          </span>
          <div>
            <p>Customer care</p>
            <strong>Human handoff queue</strong>
          </div>
          <span>Join conversations that need an employee.</span>
        </Link>
        <Link
          className="overview-card accent-sand"
          href="/dashboard/organization"
        >
          <span className="overview-icon" aria-hidden="true">
            ◇
          </span>
          <div>
            <p>Workspace</p>
            <strong>{access.organization.name}</strong>
          </div>
          <span>
            {access.membership.departmentName ?? "Organization-wide access"}
          </span>
        </Link>
      </div>
      <section className="getting-started-card">
        <div>
          <p className="eyebrow">Your account</p>
          <h2>Ready to help customers</h2>
        </div>
        <dl className="details-list compact">
          <div>
            <dt>Role</dt>
            <dd>{access.membership.role.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{access.membership.departmentName ?? "Not assigned"}</dd>
          </div>
          <div>
            <dt>Security</dt>
            <dd>Active membership</dd>
          </div>
        </dl>
      </section>
    </section>
  );
}
