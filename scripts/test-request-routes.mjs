import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const origin = "http://127.0.0.1:3103";
const password = "Request-route-password-42!";
const organizationId = "10000000-0000-4000-8000-000000000001";
const commercialDepartmentId = "11000000-0000-4000-8000-000000000001";
const technicalDepartmentId = "11000000-0000-4000-8000-000000000002";
const serviceId = "12000000-0000-4000-8000-000000000001";
const customerId = "71000000-0000-4000-8000-000000000001";
const secondCustomerId = "71000000-0000-4000-8000-000000000003";
const requestId = "72000000-0000-4000-8000-000000000001";
const secondRequestId = "72000000-0000-4000-8000-000000000003";
const foreignOrganizationId = "70000000-0000-4000-8000-000000000002";
const foreignCustomerId = "71000000-0000-4000-8000-000000000002";
const foreignServiceId = "73000000-0000-4000-8000-000000000002";
const foreignRequestId = "72000000-0000-4000-8000-000000000002";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function environment() {
  const output = execFileSync(
    fileURLToPath(new URL("../node_modules/.bin/supabase", import.meta.url)),
    ["status", "-o", "env"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  const values = new Map();
  for (const line of output.split("\n")) {
    const match = line.match(/^([A-Z_]+)=(?:"(.*)"|(.*))$/);
    if (match) values.set(match[1], match[2] ?? match[3]);
  }
  const url = values.get("API_URL");
  const anonKey = values.get("ANON_KEY");
  const serviceRoleKey = values.get("SERVICE_ROLE_KEY");
  assert(
    url?.startsWith("http://127.0.0.1:"),
    "Request route tests require local Supabase",
  );
  assert(anonKey && serviceRoleKey, "Local Supabase keys are unavailable");
  return { url, anonKey, serviceRoleKey };
}

function sql(statement) {
  return execFileSync(
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
      "-Atc",
      statement,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}

async function waitForApp(child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null)
      throw new Error("Next.js exited before request route tests started");
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Next.js did not become ready for request route tests");
}

async function signIn(url, anonKey, email) {
  let cookies = [];
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookies,
      setAll: (next) => {
        for (const cookie of next) {
          cookies = cookies.filter((item) => item.name !== cookie.name);
          cookies.push({ name: cookie.name, value: cookie.value });
        }
      },
    },
  });
  const result = await client.auth.signInWithPassword({ email, password });
  assert(!result.error, `Could not sign in ${email}`);
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function request(path, cookie, options = {}) {
  return fetch(`${origin}${path}`, {
    ...options,
    redirect: "manual",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
  });
}

async function run() {
  const { url, anonKey, serviceRoleKey } = environment();
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const createdUsers = [];
  let app;
  try {
    for (const [email, role, departmentId] of [
      ["phase-3-manager@example.test", "manager", commercialDepartmentId],
      [
        "phase-3-technical@example.test",
        "technical_officer",
        technicalDepartmentId,
      ],
      ["phase-3-viewer@example.test", "viewer", commercialDepartmentId],
    ]) {
      const existing = (
        await admin.auth.admin.listUsers({ perPage: 1000 })
      ).data.users.find((user) => user.email === email);
      if (existing) await admin.auth.admin.deleteUser(existing.id);
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      assert(!created.error && created.data.user, `Could not create ${email}`);
      createdUsers.push(created.data.user.id);
      sql(
        `insert into public.organization_members(organization_id,user_id,display_name,role,department_id) values ('${organizationId}','${created.data.user.id}','${role} route test','${role}','${departmentId}');`,
      );
    }
    const [managerId, technicalId] = createdUsers;
    const technicalMemberId = sql(
      `select id from public.organization_members where user_id='${technicalId}';`,
    );
    assert(
      sql(
        `select count(*) from public.organization_members where id=(select id from public.organization_members where user_id='${technicalId}') and organization_id='${organizationId}' and department_id='${technicalDepartmentId}' and role='technical_officer' and is_active;`,
      ) === "1",
      "Technical assignment target was not provisioned",
    );
    sql(`
      insert into public.organizations(id,name,slug,reference_prefix) values ('${foreignOrganizationId}','Foreign Route Tenant','foreign-route-tenant','FR');
      insert into public.services(id,organization_id,name) values ('${foreignServiceId}','${foreignOrganizationId}','Foreign service');
      insert into public.customers(id,organization_id,full_name,email) values ('${foreignCustomerId}','${foreignOrganizationId}','Foreign Customer','foreign@example.test');
      insert into public.customers(id,organization_id,full_name,email,phone) values ('${customerId}','${organizationId}','Route Customer','route.customer@example.test','+237600000099');
      insert into public.customers(id,organization_id,full_name,email) values ('${secondCustomerId}','${organizationId}','Second Route Customer','second.route@example.test');
      insert into public.requests(id,organization_id,customer_id,service_id,department_id,reference_number,request_type,status,title,description,location,idempotency_key,confirmed_at)
        values ('${requestId}','${organizationId}','${customerId}','${serviceId}','${commercialDepartmentId}',null,'quotation','new','Route request','Request integration fixture','Yaounde','72000000-0000-4000-8000-000000000011',now());
      insert into public.requests(id,organization_id,customer_id,service_id,department_id,reference_number,request_type,status,title,description,location,idempotency_key,confirmed_at,created_at)
        values ('${secondRequestId}','${organizationId}','${secondCustomerId}','${serviceId}','${commercialDepartmentId}',null,'support','new','Second Route request','Pagination fixture','Yaounde','72000000-0000-4000-8000-000000000013',now(),(select created_at from public.requests where id='${requestId}'));
      insert into public.requests(id,organization_id,customer_id,service_id,reference_number,request_type,status,title,description,location,idempotency_key,confirmed_at)
        values ('${foreignRequestId}','${foreignOrganizationId}','${foreignCustomerId}','${foreignServiceId}',null,'support','new','Foreign request','Foreign fixture','Douala','72000000-0000-4000-8000-000000000012',now());
    `);

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
        "3103",
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
    const managerCookie = await signIn(
      url,
      anonKey,
      "phase-3-manager@example.test",
    );
    const viewerCookie = await signIn(
      url,
      anonKey,
      "phase-3-viewer@example.test",
    );

    assert(
      (await request("/api/dashboard/requests", "")).status === 401,
      "Unauthenticated list was not rejected",
    );
    const list = await request(
      "/api/dashboard/requests?search=Route",
      managerCookie,
    );
    const listBody = await list.text();
    assert(
      list.status === 200 && listBody.includes(requestId),
      "Authorized search did not return own request",
    );
    assert(
      !listBody.includes(foreignRequestId) &&
        !listBody.includes("Foreign Customer"),
      "Cross-tenant search leaked a foreign request",
    );
    assert(
      (
        await request(
          "/api/dashboard/requests?search=name%29%2Cid.neq.null",
          managerCookie,
        )
      ).status === 400,
      "PostgREST filter control characters were accepted in search",
    );
    const firstPageResponse = await request(
      "/api/dashboard/requests?limit=1",
      managerCookie,
    );
    const firstPage = await firstPageResponse.json();
    assert(
      firstPageResponse.status === 200 &&
        firstPage.items.length === 1 &&
        firstPage.nextCursor,
      "First cursor page was invalid",
    );
    const secondPageResponse = await request(
      `/api/dashboard/requests?limit=1&cursor=${encodeURIComponent(firstPage.nextCursor)}`,
      managerCookie,
    );
    const secondPage = await secondPageResponse.json();
    assert(
      secondPageResponse.status === 200 &&
        secondPage.items.length === 1 &&
        secondPage.items[0].id !== firstPage.items[0].id,
      "Cursor pagination duplicated or skipped the equal-timestamp row",
    );
    for (const query of [
      `status=new&departmentId=${commercialDepartmentId}`,
      `serviceId=${serviceId}`,
    ]) {
      const filtered = await request(
        `/api/dashboard/requests?${query}`,
        managerCookie,
      );
      const filteredBody = await filtered.text();
      assert(
        filtered.status === 200 &&
          filteredBody.includes(requestId) &&
          !filteredBody.includes(foreignRequestId),
        `Scoped filter failed: ${query}`,
      );
    }
    const emptyPage = await request(
      "/dashboard/requests?status=closed",
      managerCookie,
    );
    assert(
      emptyPage.status === 200 &&
        (await emptyPage.text()).includes("No requests found"),
      "Filtered empty UI state was not rendered",
    );
    const invalidFilterPage = await request(
      "/dashboard/requests?search=x",
      managerCookie,
    );
    assert(
      invalidFilterPage.status === 200 &&
        (await invalidFilterPage.text()).includes("Invalid filters"),
      "Invalid-filter UI state was not rendered",
    );
    assert(
      (await request("/api/dashboard/requests?cursor=broken", managerCookie))
        .status === 400,
      "Malformed cursor was accepted",
    );
    const detail = await request(
      `/api/dashboard/requests/${requestId}`,
      managerCookie,
    );
    const detailBody = await detail.text();
    assert(
      detail.status === 200 && detailBody.includes("Route Customer"),
      "Authorized detail failed",
    );
    assert(
      !detailBody.includes("storage_path") &&
        !detailBody.includes("storage_bucket"),
      "Detail exposed storage metadata",
    );
    assert(
      (
        await request(
          `/api/dashboard/requests/${foreignRequestId}`,
          managerCookie,
        )
      ).status === 404,
      "Cross-tenant detail did not hide existence",
    );
    for (const [path, method, body] of [
      [
        "assignment",
        "PATCH",
        {
          departmentId: technicalDepartmentId,
          memberId: technicalMemberId,
          reason: null,
          expectedUpdatedAt: new Date().toISOString(),
        },
      ],
      [
        "status-transitions",
        "POST",
        {
          newStatus: "cancelled",
          reason: "Not proceeding",
          expectedUpdatedAt: new Date().toISOString(),
        },
      ],
      ["notes", "POST", { content: "Foreign note attempt" }],
      [
        "request-information",
        "POST",
        {
          question: "Foreign question",
          expectedUpdatedAt: new Date().toISOString(),
        },
      ],
    ]) {
      assert(
        (
          await request(
            `/api/dashboard/requests/${foreignRequestId}/${path}`,
            managerCookie,
            { method, body: JSON.stringify(body) },
          )
        ).status === 404,
        `Cross-tenant ${path} mutation did not hide existence`,
      );
    }
    assert(
      (await request("/api/dashboard/requests", viewerCookie)).status === 403,
      "Viewer request list was not denied",
    );

    const updatedAt = JSON.parse(detailBody).updatedAt;
    const assignment = await request(
      `/api/dashboard/requests/${requestId}/assignment`,
      managerCookie,
      {
        method: "PATCH",
        body: JSON.stringify({
          departmentId: technicalDepartmentId,
          memberId: technicalMemberId,
          reason: "Technical review",
          expectedUpdatedAt: updatedAt,
        }),
      },
    );
    const assignmentBody = await assignment.text();
    assert(
      assignment.status === 200,
      `Valid assignment returned ${assignment.status}: ${assignmentBody}`,
    );
    const assignedFilter = await request(
      `/api/dashboard/requests?assignedMemberId=${technicalMemberId}&departmentId=${technicalDepartmentId}`,
      managerCookie,
    );
    const assignedFilterBody = await assignedFilter.text();
    assert(
      assignedFilter.status === 200 &&
        assignedFilterBody.includes(requestId) &&
        !assignedFilterBody.includes(secondRequestId),
      "Combined assignee and department filters returned incorrect requests",
    );
    const afterAssignment = JSON.parse(
      await (
        await request(`/api/dashboard/requests/${requestId}`, managerCookie)
      ).text(),
    );
    const transition = await request(
      `/api/dashboard/requests/${requestId}/status-transitions`,
      managerCookie,
      {
        method: "POST",
        body: JSON.stringify({
          newStatus: "awaiting_assessment",
          reason: "Reviewed",
          expectedUpdatedAt: afterAssignment.updatedAt,
        }),
      },
    );
    assert(
      transition.status === 200,
      `Valid transition returned ${transition.status}`,
    );
    const afterTransition = JSON.parse(
      await (
        await request(`/api/dashboard/requests/${requestId}`, managerCookie)
      ).text(),
    );
    assert(
      (
        await request(
          `/api/dashboard/requests/${requestId}/status-transitions`,
          managerCookie,
          {
            method: "POST",
            body: JSON.stringify({
              newStatus: "completed",
              reason: null,
              expectedUpdatedAt: afterTransition.updatedAt,
            }),
          },
        )
      ).status === 409,
      "Invalid transition was not a typed conflict",
    );
    assert(
      (
        await request(
          `/api/dashboard/requests/${requestId}/notes`,
          managerCookie,
          {
            method: "POST",
            body: JSON.stringify({ content: "Employee-only route note" }),
          },
        )
      ).status === 201,
      "Internal note action failed",
    );
    assert(
      (
        await request(
          `/api/dashboard/requests/${requestId}/notes`,
          managerCookie,
          {
            method: "POST",
            body: JSON.stringify({ content: "x".repeat(20_000) }),
          },
        )
      ).status === 413,
      "Oversized mutation body was accepted",
    );
    assert(
      (
        await request(
          `/api/dashboard/requests/${requestId}/request-information`,
          managerCookie,
          {
            method: "POST",
            body: JSON.stringify({
              question: "What is the room size?",
              expectedUpdatedAt: afterTransition.updatedAt,
            }),
          },
        )
      ).status === 409,
      "Missing conversation did not return conflict",
    );
    assert(
      sql(
        `select count(*) from public.audit_events where entity_id='${requestId}' and action in ('request.assignment_changed','request.status_changed');`,
      ) === "2",
      "Assignment/status audit events are incomplete",
    );

    sql(
      `update public.organization_members set is_active=false where user_id='${managerId}';`,
    );
    assert(
      (await request("/api/dashboard/requests", managerCookie)).status === 403,
      "Deactivated member retained request API access",
    );
    console.log("Request route integration: 29 checks passed");
  } finally {
    if (app && app.exitCode === null) {
      app.kill("SIGTERM");
      await new Promise((resolve) => app.once("exit", resolve));
    }
    sql(`
      set session_replication_role = replica;
      delete from public.audit_events where entity_id in ('${requestId}','${foreignRequestId}');
      delete from public.internal_notes where request_id='${requestId}';
      delete from public.assignments where request_id='${requestId}';
      delete from public.request_status_history where request_id in ('${requestId}','${foreignRequestId}');
      delete from public.requests where id in ('${requestId}','${secondRequestId}','${foreignRequestId}');
      delete from public.customers where id in ('${customerId}','${secondCustomerId}','${foreignCustomerId}');
      delete from public.services where id='${foreignServiceId}';
      delete from public.organization_members where user_id in (${createdUsers.map((id) => `'${id}'`).join(",") || "null"});
      delete from public.organizations where id='${foreignOrganizationId}';
      set session_replication_role = origin;
    `);
    for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
  }
}

await run();
