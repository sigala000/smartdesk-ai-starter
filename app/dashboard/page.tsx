import { requireEmployeeAccess } from "@/lib/auth/require-access";

export default async function DashboardPage() {
  const access = await requireEmployeeAccess("/dashboard");

  return (
    <section aria-labelledby="dashboard-title" className="dashboard-card">
      <p className="eyebrow">Employee dashboard</p>
      <h1 id="dashboard-title">Hello, {access.membership.displayName}</h1>
      <p className="lead">
        Your secure workspace for {access.organization.name} is ready. Request
        management will be introduced in Phase 3.
      </p>
      <dl className="details-list">
        <div>
          <dt>Organization</dt>
          <dd>{access.organization.name}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{access.membership.role.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt>Department</dt>
          <dd>{access.membership.departmentName ?? "Not assigned"}</dd>
        </div>
      </dl>
    </section>
  );
}
