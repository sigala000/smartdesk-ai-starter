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
    throw new Error(
      result.stderr || "Status verification concurrency setup failed",
    );
  return result.stdout.trim();
}

const customer = "fd000000-0000-4000-8000-000000000001";
const request = "fd000000-0000-4000-8000-000000000002";
const challenge = "fd000000-0000-4000-8000-000000000003";
const organization = "10000000-0000-4000-8000-000000000001";
sql(
  `insert into public.customers(id,organization_id,full_name,phone) values('${customer}','${organization}','Concurrent Status Customer','+237600000077') on conflict(id) do nothing;insert into public.requests(id,organization_id,customer_id,service_id,request_type,status,title,description,location,idempotency_key,confirmed_at) values('${request}','${organization}','${customer}','12000000-0000-4000-8000-000000000002','quotation','new','Concurrent status','Concurrent status verification','Douala','fd000000-0000-4000-8000-000000000004',now());insert into public.status_verification_challenges(id,organization_id,request_id,subject_digest,code_digest,max_attempts,expires_at,delivery_outcome) values('${challenge}','${organization}','${request}',repeat('a',64),repeat('b',64),5,now()+interval '10 minutes','accepted');`,
);

try {
  const verify = (tokenCharacter, traceId) =>
    new Promise((resolve, reject) => {
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
        `select success from public.verify_status_challenge('${challenge}',repeat('b',64),repeat('${tokenCharacter}',64),null,null,null,900,900,'${traceId}');`,
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
    });
  const results = await Promise.all([
    verify("c", "fd000000-0000-4000-8000-000000000005"),
    verify("d", "fd000000-0000-4000-8000-000000000006"),
  ]);
  if (results.filter((value) => value === "t").length !== 1)
    throw new Error("Exactly one simultaneous verification must succeed");
  if (
    sql(
      `select count(*) from public.status_verification_tokens where challenge_id='${challenge}';`,
    ) !== "1"
  )
    throw new Error("Simultaneous verification issued more than one token");
  console.log(
    "Concurrent status verification passed (one success and one token).",
  );
} finally {
  sql(
    `set session_replication_role=replica;delete from public.status_verification_events where challenge_id='${challenge}';delete from public.status_verification_tokens where challenge_id='${challenge}';delete from public.status_verification_challenges where id='${challenge}';delete from public.request_status_history where request_id='${request}';delete from public.requests where id='${request}';delete from public.customers where id='${customer}';set session_replication_role=origin;`,
  );
}
