import { requirePermission } from "@/lib/auth/require-access";

export default async function OrganizationPage() {
  const access = await requirePermission(
    "organization:view",
    "/dashboard/organization",
  );

  return (
    <section aria-labelledby="organization-title" className="dashboard-card">
      <p className="eyebrow">Organization profile</p>
      <h1 id="organization-title">{access.organization.name}</h1>
      <p className="lead">
        This basic organization summary is visible only to authorized managers
        and administrators.
      </p>
      <dl className="details-list">
        <div>
          <dt>Organization identifier</dt>
          <dd>{access.organization.slug}</dd>
        </div>
        <div>
          <dt>Your access</dt>
          <dd>{access.membership.role.replaceAll("_", " ")}</dd>
        </div>
      </dl>
    </section>
  );
}
