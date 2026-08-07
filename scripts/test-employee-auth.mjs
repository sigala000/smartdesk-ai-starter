import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const testEmail = "phase-2-employee@example.test";
const testPassword = "Local-test-password-42!";
const buildProOrganizationId = "10000000-0000-4000-8000-000000000001";
const otherOrganizationId = "60000000-0000-4000-8000-000000000001";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function localSupabaseEnvironment() {
  const output = execFileSync(
    fileURLToPath(new URL("../node_modules/.bin/supabase", import.meta.url)),
    ["status", "-o", "env"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  const environment = new Map();
  for (const line of output.split("\n")) {
    const match = line.match(/^([A-Z_]+)=(?:"(.*)"|(.*))$/);
    if (match) environment.set(match[1], match[2] ?? match[3]);
  }

  const url = environment.get("API_URL");
  const anonKey = environment.get("ANON_KEY");
  const serviceRoleKey = environment.get("SERVICE_ROLE_KEY");
  assert(
    url?.startsWith("http://127.0.0.1:"),
    "Auth test requires local Supabase",
  );
  assert(anonKey, "Local Supabase anon key is unavailable");
  assert(serviceRoleKey, "Local Supabase service role key is unavailable");
  return { url, anonKey, serviceRoleKey };
}

function databaseExec(sql) {
  execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_smartdesk-ai-starter",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { stdio: ["ignore", "ignore", "ignore"] },
  );
}

async function run() {
  const { url, anonKey, serviceRoleKey } = localSupabaseEnvironment();
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const employee = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let userId;

  try {
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = users?.users.find((user) => user.email === testEmail);
    if (existing) await admin.auth.admin.deleteUser(existing.id);

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true,
      });
    assert(
      !createError && created.user,
      "Test employee could not be provisioned",
    );
    userId = created.user.id;

    databaseExec(
      `insert into public.organizations(id,name,slug,reference_prefix) values ('${otherOrganizationId}','Phase 2 Other Tenant','phase-2-other-tenant','P2') on conflict (id) do nothing; insert into public.organization_members(organization_id,user_id,display_name,role) values ('${buildProOrganizationId}','${userId}','Phase 2 Employee','admin');`,
    );

    const { error: invalidError } = await employee.auth.signInWithPassword({
      email: testEmail,
      password: "wrong-password-value",
    });
    assert(invalidError, "Invalid password unexpectedly created a session");

    const { error: loginError } = await employee.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    assert(
      !loginError,
      `Valid employee credentials were rejected: ${loginError?.code ?? "unknown"}`,
    );

    const { data: verified, error: verifyError } =
      await employee.auth.getUser();
    assert(
      !verifyError && verified.user?.id === userId,
      "Auth user was not verified",
    );

    const { data: memberships, error: readError } = await employee
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId);
    assert(
      !readError && memberships?.length === 1,
      "Active membership was not resolved",
    );
    assert(
      memberships[0].organization_id === buildProOrganizationId &&
        memberships[0].role === "admin",
      "Membership organization or role was not database-derived",
    );

    const { data: organizations, error: organizationError } = await employee
      .from("organizations")
      .select("id");
    assert(
      !organizationError &&
        organizations?.length === 1 &&
        organizations[0].id === buildProOrganizationId,
      "Employee could read another tenant",
    );

    databaseExec(
      `update public.organization_members set is_active=false where user_id='${userId}' and organization_id='${buildProOrganizationId}';`,
    );

    const { data: deactivatedRows, error: deactivatedReadError } =
      await employee.from("organization_members").select("id");
    assert(
      !deactivatedReadError && deactivatedRows?.length === 0,
      "Deactivated employee retained membership access",
    );
    const { data: stillAuthenticated } = await employee.auth.getUser();
    assert(
      stillAuthenticated.user?.id === userId,
      "Deactivation test did not retain the Auth session",
    );

    const { error: logoutError } = await employee.auth.signOut();
    assert(!logoutError, "Employee logout failed");
    const { data: signedOut } = await employee.auth.getUser();
    assert(!signedOut.user, "Signed-out client retained an authenticated user");

    console.log("Employee Auth integration: 12 checks passed");
  } finally {
    databaseExec(
      `${userId ? `delete from public.organization_members where user_id='${userId}';` : ""} delete from public.organizations where id='${otherOrganizationId}';`,
    );
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
}

await run();
