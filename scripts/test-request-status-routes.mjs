import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
const origin = "http://127.0.0.1:3108";
const organization = "10000000-0000-4000-8000-000000000001";
const customer = "fa000000-0000-4000-8000-000000000001";
const requestId = "fb000000-0000-4000-8000-000000000001";
let reference;
const phone = "+237600000088";
function cleanupFixture() {
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
      `set session_replication_role=replica;delete from public.status_verification_events where organization_id='${organization}';delete from public.status_verification_tokens where organization_id='${organization}' and request_id='${requestId}';delete from public.status_verification_challenges where organization_id='${organization}' and request_id='${requestId}';delete from public.request_status_history where request_id='${requestId}';delete from public.requests where id='${requestId}';delete from public.customers where id='${customer}';set session_replication_role=origin;`,
    ],
    { stdio: "ignore" },
  );
}
function assert(value, message) {
  if (!value) throw new Error(message);
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
  return {
    url: values.get("API_URL"),
    anon: values.get("ANON_KEY"),
    service: values.get("SERVICE_ROLE_KEY"),
  };
}
async function wait(child) {
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null)
      throw new Error("Next.js exited before status tests");
    try {
      if ((await fetch(`${origin}/status`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("Status test app did not start");
}
async function post(path, body) {
  return fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const env = environment();
assert(
  env.url && env.anon && env.service,
  "Local Supabase environment incomplete",
);
const admin = createClient(env.url, env.service, {
  auth: { persistSession: false },
});
cleanupFixture();
const insertedCustomer = await admin.from("customers").upsert({
  id: customer,
  organization_id: organization,
  full_name: "Status Route Customer",
  phone,
});
assert(!insertedCustomer.error, "Could not seed status customer");
const insertedRequest = await admin
  .from("requests")
  .upsert({
    id: requestId,
    organization_id: organization,
    customer_id: customer,
    service_id: "12000000-0000-4000-8000-000000000002",
    reference_number: null,
    request_type: "quotation",
    status: "awaiting_assessment",
    title: "Status route test",
    description: "Status route test description",
    location: "Yaounde",
    idempotency_key: "fc000000-0000-4000-8000-000000000001",
    confirmed_at: new Date().toISOString(),
  })
  .select("reference_number")
  .single();
assert(!insertedRequest.error, "Could not seed status request");
reference = insertedRequest.data.reference_number;
const app = spawn(
  process.execPath,
  [
    fileURLToPath(
      new URL("../node_modules/next/dist/bin/next", import.meta.url),
    ),
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3108",
  ],
  {
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: env.url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: env.anon,
      SUPABASE_SERVICE_ROLE_KEY: env.service,
      PUBLIC_RATE_LIMIT_SECRET: "phase-8-integration-secret-at-least-32-bytes",
      STATUS_VERIFICATION_ENABLED: "true",
      STATUS_VERIFICATION_PROVIDER: "mock",
      STATUS_VERIFICATION_MOCK_EXPOSE_CODE: "true",
    },
    stdio: ["ignore", "ignore", "ignore"],
  },
);
try {
  await wait(app);
  const page = await fetch(`${origin}/status`);
  assert(
    page.status === 200 && (await page.text()).includes("Check request status"),
    "Status page unavailable",
  );
  const valid = await post("/api/request-status/challenge", {
    organizationSlug: "buildpro-cameroon",
    referenceNumber: reference,
    phone,
  });
  const unknown = await post("/api/request-status/challenge", {
    organizationSlug: "buildpro-cameroon",
    referenceNumber: "BP-2026-999997",
    phone,
  });
  assert(
    valid.status === 202 && unknown.status === 202,
    "Challenge responses must be generic",
  );
  const validBody = await valid.json();
  const unknownBody = await unknown.json();
  assert(
    validBody.developmentCode && unknownBody.developmentCode === undefined,
    "Mock code leaked for synthetic challenge",
  );
  assert(
    Object.keys(validBody)
      .filter((k) => k !== "developmentCode")
      .sort()
      .join() === Object.keys(unknownBody).sort().join(),
    "Challenge shapes reveal existence",
  );
  const referenceOnly = await fetch(
    `${origin}/api/request-status/${reference}`,
  );
  assert(referenceOnly.status === 401, "Reference alone revealed status");
  const wrong = await post("/api/request-status/verify", {
    challengeId: validBody.challengeId,
    code: "000000",
  });
  assert(wrong.status === 401, "Wrong code was accepted");
  const verified = await post("/api/request-status/verify", {
    challengeId: validBody.challengeId,
    code: validBody.developmentCode,
  });
  assert(verified.status === 200, "Correct mock code failed");
  const verifiedBody = await verified.json();
  const status = await fetch(`${origin}/api/request-status/${reference}`, {
    headers: { Authorization: `Bearer ${verifiedBody.verificationToken}` },
  });
  assert(status.status === 200, "Verified token could not read status");
  const body = await status.json();
  assert(
    Object.keys(body.request).sort().join() ===
      [
        "displayStatus",
        "lastUpdate",
        "nextAction",
        "referenceNumber",
        "serviceName",
        "updatedAt",
      ]
        .sort()
        .join(),
    "Unsafe status fields returned",
  );
  assert(
    !JSON.stringify(body).match(/priority|employee|internal|phone|customer/i),
    "Sensitive status data leaked",
  );
  const replayed = await fetch(`${origin}/api/request-status/${reference}`, {
    headers: { Authorization: `Bearer ${verifiedBody.verificationToken}` },
  });
  assert(replayed.status === 401, "One-time token could be replayed");
  const malformed = await fetch(`${origin}/api/request-status/%E0%A4%A`, {
    headers: { Authorization: `Bearer ${verifiedBody.verificationToken}` },
  });
  assert(
    malformed.status >= 400 && malformed.status < 500,
    "Malformed reference caused a server error",
  );
  console.log("Request status E2E: 14 checks passed");
} finally {
  app.kill("SIGTERM");
  cleanupFixture();
}
