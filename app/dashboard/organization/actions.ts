"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/require-access";
import { serverEnvironment } from "@/lib/config/env-server";
import { createAdminClient } from "@/lib/supabase/admin";

const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const clean = (value: FormDataEntryValue | null, maximum: number) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : "";
function finish(result: string): never {
  revalidatePath("/dashboard/organization");
  redirect(`/dashboard/organization?result=${encodeURIComponent(result)}`);
}

export async function addDepartment(formData: FormData) {
  const access = await requirePermission(
    "catalogue:manage",
    "/dashboard/organization",
  );
  const name = clean(formData.get("name"), 120);
  if (name.length < 2) finish("department_invalid");
  const created = await createAdminClient()
    .from("departments")
    .insert({ organization_id: access.organization.id, name, is_active: true });
  finish(created.error ? "department_failed" : "department_added");
}

export async function addService(formData: FormData) {
  const access = await requirePermission(
    "catalogue:manage",
    "/dashboard/organization",
  );
  const name = clean(formData.get("name"), 160);
  const departmentId = clean(formData.get("departmentId"), 36);
  if (name.length < 2 || !/^[0-9a-f-]{36}$/i.test(departmentId))
    finish("service_invalid");
  const department = await createAdminClient()
    .from("departments")
    .select("id")
    .eq("organization_id", access.organization.id)
    .eq("id", departmentId)
    .eq("is_active", true)
    .maybeSingle();
  if (!department.data) finish("service_department_invalid");
  const created = await createAdminClient().from("services").insert({
    organization_id: access.organization.id,
    department_id: departmentId,
    name,
    is_active: true,
  });
  finish(created.error ? "service_failed" : "service_added");
}

export async function inviteEmployee(formData: FormData) {
  const access = await requirePermission(
    "members:manage",
    "/dashboard/organization",
  );
  const email = clean(formData.get("email"), 254).toLowerCase();
  const role = clean(formData.get("role"), 40);
  if (
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
    ![
      "admin",
      "manager",
      "commercial_officer",
      "technical_officer",
      "project_manager",
      "support_officer",
      "viewer",
    ].includes(role)
  )
    finish("invitation_invalid");
  if (email === access.user.email?.toLowerCase()) finish("invitation_self");
  const token = randomBytes(32).toString("base64url");
  const admin = createAdminClient();
  const [subscription, memberCount] = await Promise.all([
    admin
      .from("organization_subscriptions")
      .select("seat_limit")
      .eq("organization_id", access.organization.id)
      .maybeSingle(),
    admin
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", access.organization.id)
      .eq("is_active", true),
  ]);
  if (
    subscription.data?.seat_limit &&
    (memberCount.count ?? 0) >= subscription.data.seat_limit
  )
    finish("seat_limit_reached");
  const invitation = await admin
    .from("organization_invitations")
    .insert({
      organization_id: access.organization.id,
      email,
      role,
      token_digest: digest(token),
      invited_by_member_id: access.membership.id,
      expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    })
    .select("id")
    .single();
  if (!invitation.data) finish("invitation_failed");
  const invitationId = invitation.data.id;
  await admin.from("audit_events").insert({
    organization_id: access.organization.id,
    actor_member_id: access.membership.id,
    action: "organization.invitation_created",
    entity_type: "organization_invitation",
    entity_id: invitationId,
    metadata: { role },
  });
  const base = serverEnvironment.APP_BASE_URL;
  if (!base) finish("invitation_delivery_failed");
  const invitationRedirect = `${new URL(base).origin}/invite/accept?token=${encodeURIComponent(token)}`;
  const delivery = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: invitationRedirect,
  });
  if (delivery.error) {
    await admin
      .from("organization_invitations")
      .update({ status: "revoked" })
      .eq("id", invitationId);
    finish("invitation_delivery_failed");
  }
  finish("invitation_sent");
}

export async function updateOrganizationProfile(formData: FormData) {
  const access = await requirePermission(
    "organization:manage",
    "/dashboard/organization",
  );
  const email = clean(formData.get("contactEmail"), 254).toLowerCase();
  const phone = clean(formData.get("contactPhone"), 32);
  const website = clean(formData.get("websiteUrl"), 300);
  const industry = clean(formData.get("industry"), 120);
  const address = clean(formData.get("businessAddress"), 500);
  const country = clean(formData.get("countryCode"), 2).toUpperCase();
  const language = clean(formData.get("defaultLanguage"), 2);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    finish("profile_invalid");
  if (website && (!website.startsWith("https://") || website.length > 300))
    finish("profile_invalid");
  if (country && !/^[A-Z]{2}$/.test(country)) finish("profile_invalid");
  if (!["en", "fr"].includes(language)) finish("profile_invalid");
  const admin = createAdminClient();
  const updated = await admin
    .from("organizations")
    .update({
      contact_email: email || null,
      contact_phone: phone || null,
      website_url: website || null,
      industry: industry || null,
      business_address: address || null,
      country_code: country || null,
      default_language: language,
    })
    .eq("id", access.organization.id)
    .select("id")
    .maybeSingle();
  if (!updated.data) finish("profile_failed");
  if (updated.data)
    await admin.from("audit_events").insert({
      organization_id: access.organization.id,
      actor_member_id: access.membership.id,
      action: "organization.profile_updated",
      entity_type: "organization",
      entity_id: access.organization.id,
      metadata: { default_language: language },
    });
  finish("profile_saved");
}

export async function completeOnboarding() {
  const access = await requirePermission(
    "organization:manage",
    "/dashboard/organization",
  );
  const admin = createAdminClient();
  const [departments, services] = await Promise.all([
    admin
      .from("departments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", access.organization.id)
      .eq("is_active", true),
    admin
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", access.organization.id)
      .eq("is_active", true),
  ]);
  if (!departments.count || !services.count) finish("setup_incomplete");
  const updated = await admin
    .from("organizations")
    .update({
      lifecycle_status: "active",
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", access.organization.id)
    .select("id")
    .maybeSingle();
  if (!updated.data) finish("activation_failed");
  if (updated.data)
    await admin.from("audit_events").insert({
      organization_id: access.organization.id,
      actor_member_id: access.membership.id,
      action: "organization.onboarding_completed",
      entity_type: "organization",
      entity_id: access.organization.id,
    });
  finish("workspace_activated");
}

export async function setCatalogueState(formData: FormData) {
  const access = await requirePermission(
    "catalogue:manage",
    "/dashboard/organization",
  );
  const kind = formData.get("kind");
  const id = clean(formData.get("id"), 36);
  const active = formData.get("active") === "true";
  if (
    !/^[0-9a-f-]{36}$/i.test(id) ||
    (kind !== "service" && kind !== "department")
  )
    finish("catalogue_invalid");
  const updated = await createAdminClient()
    .from(kind === "service" ? "services" : "departments")
    .update({ is_active: active })
    .eq("organization_id", access.organization.id)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  finish(updated.data ? "catalogue_updated" : "catalogue_failed");
}

export async function setMemberState(formData: FormData) {
  const access = await requirePermission(
    "members:manage",
    "/dashboard/organization",
  );
  const id = clean(formData.get("id"), 36);
  const active = formData.get("active") === "true";
  if (!/^[0-9a-f-]{36}$/i.test(id) || id === access.membership.id)
    finish("member_invalid");
  const admin = createAdminClient();
  const target = await admin
    .from("organization_members")
    .select("role,is_active")
    .eq("organization_id", access.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (!target.data) finish("member_invalid");
  const targetMember = target.data;
  if (!active && targetMember.role === "admin") {
    const activeAdmins = await admin
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", access.organization.id)
      .eq("role", "admin")
      .eq("is_active", true);
    if ((activeAdmins.count ?? 0) <= 1) finish("last_admin_required");
  }
  const updated = await admin
    .from("organization_members")
    .update({ is_active: active })
    .eq("organization_id", access.organization.id)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (!updated.data) finish("member_failed");
  if (updated.data)
    await admin.from("audit_events").insert({
      organization_id: access.organization.id,
      actor_member_id: access.membership.id,
      action: active
        ? "organization.member_activated"
        : "organization.member_deactivated",
      entity_type: "organization_member",
      entity_id: id,
    });
  finish(active ? "member_activated" : "member_deactivated");
}

export async function setMemberRole(formData: FormData) {
  const access = await requirePermission(
    "members:manage",
    "/dashboard/organization",
  );
  const id = clean(formData.get("id"), 36);
  const role = clean(formData.get("role"), 40);
  const roles = [
    "admin",
    "manager",
    "commercial_officer",
    "technical_officer",
    "project_manager",
    "support_officer",
    "viewer",
  ];
  if (
    !/^[0-9a-f-]{36}$/i.test(id) ||
    id === access.membership.id ||
    !roles.includes(role)
  )
    finish("member_invalid");
  const admin = createAdminClient();
  const target = await admin
    .from("organization_members")
    .select("role,is_active")
    .eq("organization_id", access.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (!target.data) finish("member_invalid");
  const targetMember = target.data;
  if (
    targetMember.role === "admin" &&
    role !== "admin" &&
    targetMember.is_active
  ) {
    const activeAdmins = await admin
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", access.organization.id)
      .eq("role", "admin")
      .eq("is_active", true);
    if ((activeAdmins.count ?? 0) <= 1) finish("last_admin_required");
  }
  const updated = await admin
    .from("organization_members")
    .update({ role })
    .eq("organization_id", access.organization.id)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (!updated.data) finish("member_failed");
  if (updated.data)
    await admin.from("audit_events").insert({
      organization_id: access.organization.id,
      actor_member_id: access.membership.id,
      action: "organization.member_role_updated",
      entity_type: "organization_member",
      entity_id: id,
      metadata: { previous_role: targetMember.role, role },
    });
  finish("member_role_updated");
}

export async function revokeInvitation(formData: FormData) {
  const access = await requirePermission(
    "members:manage",
    "/dashboard/organization",
  );
  const id = clean(formData.get("id"), 36);
  if (!/^[0-9a-f-]{36}$/i.test(id)) finish("invitation_invalid");
  const admin = createAdminClient();
  const updated = await admin
    .from("organization_invitations")
    .update({ status: "revoked" })
    .eq("organization_id", access.organization.id)
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!updated.data) finish("invitation_failed");
  if (updated.data)
    await admin.from("audit_events").insert({
      organization_id: access.organization.id,
      actor_member_id: access.membership.id,
      action: "organization.invitation_revoked",
      entity_type: "organization_invitation",
      entity_id: id,
    });
  finish("invitation_revoked");
}
