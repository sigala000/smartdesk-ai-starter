import { spawn, spawnSync } from "node:child_process";

const container = "supabase_db_smartdesk-ai-starter";
function sql(statement) {
  const result = spawnSync(
    "docker",
    [
      "exec",
      container,
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
    { encoding: "utf8" },
  );
  if (result.status !== 0)
    throw new Error(result.stderr || "Handoff concurrency setup failed");
  return result.stdout.trim();
}

const organization = "e0000000-0000-4000-8000-000000000001";
const customer = "e1000000-0000-4000-8000-000000000001";
const conversation = "e2000000-0000-4000-8000-000000000001";
const managerUser = "e4000000-0000-4000-8000-000000000001";
const supportUser = "e4000000-0000-4000-8000-000000000002";
const department = "e5000000-0000-4000-8000-000000000001";
const managerMember = "e6000000-0000-4000-8000-000000000001";
const supportMember = "e6000000-0000-4000-8000-000000000002";
sql(
  `insert into public.organizations(id,name,slug,reference_prefix) values('${organization}','Concurrency tenant','handoff-concurrency','HC');insert into public.departments(id,organization_id,name) values('${department}','${organization}','Support');insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at) values('${managerUser}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','handoff-manager@example.test','',now(),now()),('${supportUser}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','handoff-support@example.test','',now(),now());insert into public.organization_members(id,organization_id,user_id,role,department_id,display_name) values('${managerMember}','${organization}','${managerUser}','manager','${department}','Manager'),('${supportMember}','${organization}','${supportUser}','support_officer','${department}','Support');insert into public.customers(id,organization_id,full_name) values('${customer}','${organization}','Concurrent Customer');insert into public.conversations(id,organization_id,customer_id) values('${conversation}','${organization}','${customer}');insert into public.public_conversation_access(conversation_id,organization_id,token_digest,expires_at) values('${conversation}','${organization}',repeat('e',64),now()+interval '1 hour');`,
);

try {
  const calls = Array.from(
    { length: 12 },
    (_, index) =>
      new Promise((resolve, reject) => {
        const key = `e3000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
        const child = spawn("docker", [
          "exec",
          container,
          "psql",
          "-U",
          "postgres",
          "-d",
          "postgres",
          "-Atc",
          `select id from public.request_public_handoff('${conversation}',repeat('e',64),'${key}','Concurrent customer request','explicit_human_request','normal');`,
        ]);
        let output = "";
        let error = "";
        child.stdout.on("data", (chunk) => (output += chunk));
        child.stderr.on("data", (chunk) => (error += chunk));
        child.on("error", reject);
        child.on("close", (code) =>
          code === 0
            ? resolve(output.trim())
            : reject(new Error(error || `psql exited ${code}`)),
        );
      }),
  );
  const ids = await Promise.all(calls);
  if (new Set(ids).size !== 1)
    throw new Error("Concurrent requests created different open handoffs");
  if (
    sql(
      `select count(*) from public.human_handoffs where conversation_id='${conversation}' and status='queued';`,
    ) !== "1"
  )
    throw new Error("Concurrent requests did not leave one queued handoff");
  const handoff = ids[0];
  sql(
    `update public.human_handoffs set status='assigned',assigned_member_id='${supportMember}',assigned_at=now() where id='${handoff}';`,
  );
  const join = (userId) =>
    new Promise((resolve) => {
      const child = spawn("docker", [
        "exec",
        container,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-Atc",
        `begin;set local role authenticated;select set_config('request.jwt.claim.sub','${userId}',true);select id from public.join_handoff('${handoff}');commit;`,
      ]);
      child.on("close", (code) => resolve(code));
    });
  const joinResults = await Promise.all([join(supportUser), join(managerUser)]);
  if (joinResults.filter((code) => code === 0).length !== 1)
    throw new Error("Exactly one simultaneous handoff acceptance must succeed");
  if (
    sql(
      `select count(*) from public.audit_events where entity_id='${handoff}' and action='handoff.activated';`,
    ) !== "1"
  )
    throw new Error("Simultaneous acceptance did not produce one activation");
  console.log(
    "Concurrent handoff creation and acceptance passed (one handoff and one owner).",
  );
} finally {
  sql(
    `set session_replication_role=replica;delete from public.audit_events where organization_id='${organization}';delete from public.human_handoffs where organization_id='${organization}';delete from public.public_conversation_access where organization_id='${organization}';delete from public.conversations where organization_id='${organization}';delete from public.customers where organization_id='${organization}';delete from public.organization_members where organization_id='${organization}';delete from public.departments where organization_id='${organization}';delete from public.organizations where id='${organization}';delete from auth.users where id in ('${managerUser}','${supportUser}');set session_replication_role=origin;`,
  );
}
