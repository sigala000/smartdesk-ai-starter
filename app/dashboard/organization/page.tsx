import {
  addDepartment,
  addService,
  completeOnboarding,
  inviteEmployee,
  revokeInvitation,
  setCatalogueState,
  setMemberRole,
  setMemberState,
  updateOrganizationProfile,
} from "./actions";

import { requirePermission } from "@/lib/auth/require-access";
import { can } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function OrganizationPage() {
  const access = await requirePermission(
    "organization:view",
    "/dashboard/organization",
  );
  const admin = createAdminClient();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [
    organization,
    departments,
    services,
    members,
    invitations,
    subscription,
    monthlyRequests,
    monthlyWhatsApp,
  ] = await Promise.all([
    admin
      .from("organizations")
      .select(
        "name,slug,reference_prefix,lifecycle_status,onboarding_completed_at,contact_email,contact_phone,website_url,industry,business_address,country_code,default_language",
      )
      .eq("id", access.organization.id)
      .single(),
    admin
      .from("departments")
      .select("id,name,is_active")
      .eq("organization_id", access.organization.id)
      .order("name"),
    admin
      .from("services")
      .select("id,name,is_active,department_id")
      .eq("organization_id", access.organization.id)
      .order("name"),
    admin
      .from("organization_members")
      .select("id,display_name,role,is_active")
      .eq("organization_id", access.organization.id)
      .order("display_name"),
    admin
      .from("organization_invitations")
      .select("id,email,role,status,expires_at")
      .eq("organization_id", access.organization.id)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("organization_subscriptions")
      .select(
        "status,trial_ends_at,feature_entitlements,plan_identifier,seat_limit,usage_limits,grace_ends_at",
      )
      .eq("organization_id", access.organization.id)
      .maybeSingle(),
    admin
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", access.organization.id)
      .gte("created_at", monthStart.toISOString()),
    admin
      .from("whatsapp_message_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", access.organization.id)
      .eq("direction", "outbound")
      .gte("created_at", monthStart.toISOString()),
  ]);
  const manage = can(access.membership.role, "organization:manage");
  const configured = Boolean(
    departments.data?.some((item) => item.is_active) &&
    services.data?.some((item) => item.is_active),
  );
  return (
    <section className="dashboard-stack" aria-labelledby="organization-title">
      <div className="dashboard-card">
        <p className="eyebrow">Organization profile</p>
        <h1 id="organization-title">{access.organization.name}</h1>
        <dl className="details-list">
          <div>
            <dt>Workspace</dt>
            <dd>{organization.data?.slug}</dd>
          </div>
          <div>
            <dt>Request prefix</dt>
            <dd>{organization.data?.reference_prefix}</dd>
          </div>
          <div>
            <dt>Setup status</dt>
            <dd>{organization.data?.lifecycle_status?.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt>SmartDesk plan</dt>
            <dd>
              {subscription.data?.status?.replaceAll("_", " ") ??
                "Not configured"}
            </dd>
          </div>
          <div>
            <dt>Plan identifier</dt>
            <dd>{subscription.data?.plan_identifier ?? "pilot"}</dd>
          </div>
          <div>
            <dt>Trial ends</dt>
            <dd>
              {subscription.data?.trial_ends_at
                ? new Date(subscription.data.trial_ends_at).toLocaleDateString()
                : "Not applicable"}
            </dd>
          </div>
          <div>
            <dt>Active seats</dt>
            <dd>
              {members.data?.filter((item) => item.is_active).length ?? 0}
              {subscription.data?.seat_limit
                ? ` of ${subscription.data.seat_limit}`
                : " (no configured limit)"}
            </dd>
          </div>
          <div>
            <dt>Requests this month</dt>
            <dd>{monthlyRequests.count ?? 0}</dd>
          </div>
          <div>
            <dt>WhatsApp replies this month</dt>
            <dd>{monthlyWhatsApp.count ?? 0}</dd>
          </div>
        </dl>
        {organization.data?.lifecycle_status === "onboarding" ? (
          <div className="notice">
            <strong>Finish setup</strong>
            <p>
              Add at least one department and service, invite employees if
              needed, then activate customer channels.
            </p>
            {manage && configured ? (
              <form action={completeOnboarding}>
                <button className="button-primary" type="submit">
                  Activate workspace
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>

      {manage ? (
        <div className="dashboard-card">
          <h2>Company profile</h2>
          <form action={updateOrganizationProfile} className="settings-form">
            <label htmlFor="contact-email">Business email</label>
            <input
              defaultValue={organization.data?.contact_email ?? ""}
              id="contact-email"
              name="contactEmail"
              type="email"
            />
            <label htmlFor="contact-phone">Business phone</label>
            <input
              defaultValue={organization.data?.contact_phone ?? ""}
              id="contact-phone"
              name="contactPhone"
              maxLength={32}
            />
            <label htmlFor="website-url">Website (HTTPS)</label>
            <input
              defaultValue={organization.data?.website_url ?? ""}
              id="website-url"
              name="websiteUrl"
              type="url"
            />
            <label htmlFor="industry">Industry</label>
            <input
              defaultValue={organization.data?.industry ?? ""}
              id="industry"
              name="industry"
              maxLength={120}
            />
            <label htmlFor="business-address">Business address</label>
            <textarea
              defaultValue={organization.data?.business_address ?? ""}
              id="business-address"
              name="businessAddress"
              maxLength={500}
            />
            <label htmlFor="country-code">Country code</label>
            <input
              defaultValue={organization.data?.country_code ?? ""}
              id="country-code"
              name="countryCode"
              maxLength={2}
              placeholder="CM"
            />
            <label htmlFor="default-language">Default language</label>
            <select
              defaultValue={organization.data?.default_language ?? "en"}
              id="default-language"
              name="defaultLanguage"
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
            </select>
            <button className="button-secondary" type="submit">
              Save profile
            </button>
          </form>
        </div>
      ) : null}

      <div className="dashboard-grid">
        <article className="dashboard-card">
          <h2>Departments</h2>
          <ul className="plain-list">
            {departments.data?.map((item) => (
              <li key={item.id}>
                {item.name}
                {item.is_active ? "" : " (inactive)"}
                {manage ? (
                  <form action={setCatalogueState}>
                    <input name="kind" type="hidden" value="department" />
                    <input name="id" type="hidden" value={item.id} />
                    <input
                      name="active"
                      type="hidden"
                      value={item.is_active ? "false" : "true"}
                    />
                    <button className="text-button" type="submit">
                      {item.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          {manage ? (
            <form action={addDepartment} className="inline-form">
              <label htmlFor="department-name">New department</label>
              <input
                id="department-name"
                name="name"
                required
                maxLength={120}
              />
              <button className="button-secondary" type="submit">
                Add
              </button>
            </form>
          ) : null}
        </article>
        <article className="dashboard-card">
          <h2>Services</h2>
          <ul className="plain-list">
            {services.data?.map((item) => (
              <li key={item.id}>
                {item.name}
                {item.is_active ? "" : " (inactive)"}
                {manage ? (
                  <form action={setCatalogueState}>
                    <input name="kind" type="hidden" value="service" />
                    <input name="id" type="hidden" value={item.id} />
                    <input
                      name="active"
                      type="hidden"
                      value={item.is_active ? "false" : "true"}
                    />
                    <button className="text-button" type="submit">
                      {item.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          {manage && departments.data?.length ? (
            <form action={addService} className="inline-form">
              <label htmlFor="service-name">New service</label>
              <input id="service-name" name="name" required maxLength={160} />
              <label htmlFor="service-department">Department</label>
              <select id="service-department" name="departmentId">
                {departments.data
                  .filter((item) => item.is_active)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
              <button className="button-secondary" type="submit">
                Add
              </button>
            </form>
          ) : null}
        </article>
      </div>

      <div className="dashboard-card">
        <h2>Employees</h2>
        <ul className="plain-list">
          {members.data?.map((item) => (
            <li key={item.id}>
              <span>
                {item.display_name} — {item.role.replaceAll("_", " ")}
                {item.is_active ? "" : " (deactivated)"}
              </span>
              {can(access.membership.role, "members:manage") &&
              item.id !== access.membership.id ? (
                <div className="row-actions">
                  <form action={setMemberRole}>
                    <input name="id" type="hidden" value={item.id} />
                    <select
                      aria-label={`Role for ${item.display_name}`}
                      defaultValue={item.role}
                      name="role"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="support_officer">Support officer</option>
                      <option value="commercial_officer">
                        Commercial officer
                      </option>
                      <option value="technical_officer">
                        Technical officer
                      </option>
                      <option value="project_manager">Project manager</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Administrator</option>
                    </select>
                    <button className="text-button" type="submit">
                      Update role
                    </button>
                  </form>
                  <form action={setMemberState}>
                    <input name="id" type="hidden" value={item.id} />
                    <input
                      name="active"
                      type="hidden"
                      value={item.is_active ? "false" : "true"}
                    />
                    <button className="text-button" type="submit">
                      {item.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {can(access.membership.role, "members:manage") ? (
          <form action={inviteEmployee} className="inline-form">
            <label htmlFor="invite-email">Employee email</label>
            <input id="invite-email" name="email" type="email" required />
            <label htmlFor="invite-role">Role</label>
            <select id="invite-role" name="role">
              <option value="viewer">Viewer</option>
              <option value="support_officer">Support officer</option>
              <option value="commercial_officer">Commercial officer</option>
              <option value="technical_officer">Technical officer</option>
              <option value="project_manager">Project manager</option>
              <option value="manager">Manager</option>
            </select>
            <button className="button-secondary" type="submit">
              Send invitation
            </button>
          </form>
        ) : null}
        {can(access.membership.role, "members:manage") ? (
          <>
            <h3>Invitations</h3>
            <ul className="plain-list">
              {invitations.data?.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.email} — {item.status} — expires{" "}
                    {new Date(item.expires_at).toLocaleDateString()}
                  </span>
                  {item.status === "pending" ? (
                    <form action={revokeInvitation}>
                      <input name="id" type="hidden" value={item.id} />
                      <button className="text-button" type="submit">
                        Revoke
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </section>
  );
}
