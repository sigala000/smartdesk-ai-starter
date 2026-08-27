import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const appOrigin = "http://127.0.0.1:3102";
const testEmail = "phase-2-routes@example.test";
const testPassword = "Route-test-password-42!";
const buildProOrganizationId = "10000000-0000-4000-8000-000000000001";

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
    "Route test requires local Supabase",
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

async function waitForApp(child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null)
      throw new Error("Next.js exited before route tests started");
    try {
      const response = await fetch(appOrigin);
      if (response.ok) return;
    } catch {
      // The development server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Next.js did not become ready for route tests");
}

function cookieHeader(cookies) {
  return cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
}

async function request(path, cookies = []) {
  return fetch(`${appOrigin}${path}`, {
    headers: cookies.length > 0 ? { cookie: cookieHeader(cookies) } : undefined,
    redirect: "manual",
  });
}

async function assertRedirect(response, expected) {
  if ([303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    assert(
      location?.includes(expected),
      `Unexpected redirect destination: ${location ?? "missing"}`,
    );
    return "";
  }

  const body = await response.text();
  assert(
    response.status === 200 && body.includes(expected),
    `Expected redirect, received ${response.status}`,
  );
  return body;
}

async function run() {
  const { url, anonKey, serviceRoleKey } = localSupabaseEnvironment();
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let userId;
  let app;

  try {
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = users?.users.find((user) => user.email === testEmail);
    if (existing) {
      databaseExec(
        `delete from public.organization_members where user_id='${existing.id}';`,
      );
      await admin.auth.admin.deleteUser(existing.id);
    }

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true,
      });
    assert(
      !createError && created.user,
      "Route-test employee could not be provisioned",
    );
    userId = created.user.id;

    app = spawn(
      process.execPath,
      [
        fileURLToPath(
          new URL("../node_modules/next/dist/bin/next", import.meta.url),
        ),
        "dev",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3102",
      ],
      {
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: url,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
        },
        stdio: ["ignore", "ignore", "ignore"],
      },
    );
    await waitForApp(app);

    const unauthenticated = await request("/dashboard");
    await assertRedirect(unauthenticated, "/login?status=session-required");

    let sessionCookies = [];
    const sessionClient = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => sessionCookies,
        setAll: (cookiesToSet) => {
          for (const cookie of cookiesToSet) {
            sessionCookies = sessionCookies.filter(
              ({ name }) => name !== cookie.name,
            );
            sessionCookies.push({ name: cookie.name, value: cookie.value });
          }
        },
      },
    });
    const { error: loginError } = await sessionClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    assert(!loginError && sessionCookies.length > 0, "Route-test login failed");

    const onboarding = await request(
      "/login?next=%2Fonboarding",
      sessionCookies,
    );
    await assertRedirect(onboarding, "/onboarding");
    const dashboardWithoutMembership = await request(
      "/login?next=%2Fdashboard",
      sessionCookies,
    );
    await assertRedirect(dashboardWithoutMembership, "/onboarding");

    databaseExec(
      `insert into public.organization_members(organization_id,user_id,display_name,role) values ('${buildProOrganizationId}','${userId}','Route Test Viewer','viewer');`,
    );

    const dashboard = await request("/dashboard", sessionCookies);
    assert(
      dashboard.status === 200,
      `Authorized dashboard returned ${dashboard.status}`,
    );
    assert(
      (await dashboard.text()).includes("Route Test Viewer"),
      "Dashboard omitted employee identity",
    );

    const forbidden = await request("/dashboard/organization", sessionCookies);
    const forbiddenBody = await assertRedirect(
      forbidden,
      "/unauthorized?reason=forbidden",
    );
    assert(
      !forbiddenBody.includes("This basic organization summary"),
      "Forbidden response rendered protected organization content",
    );

    const malformedCookies = sessionCookies.map(({ name }) => ({
      name,
      value: "malformed",
    }));
    const malformed = await request("/dashboard", malformedCookies);
    await assertRedirect(malformed, "/login?status=session-required");

    databaseExec(
      `update public.organization_members set is_active=false where user_id='${userId}' and organization_id='${buildProOrganizationId}';`,
    );
    const deactivated = await request("/dashboard", sessionCookies);
    await assertRedirect(
      deactivated,
      "/unauthorized?reason=membership_required",
    );

    console.log("Protected route integration: 11 checks passed");
  } finally {
    if (app && app.exitCode === null) {
      app.kill("SIGTERM");
      await new Promise((resolve) => app.once("exit", resolve));
    }
    if (userId) {
      databaseExec(
        `delete from public.organization_members where user_id='${userId}';`,
      );
      await admin.auth.admin.deleteUser(userId);
    }
  }
}

await run();
