import { spawn, spawnSync } from "node:child_process";

const status = spawnSync("npx", ["supabase", "status", "--output", "json"], {
  encoding: "utf8",
  env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "true" },
});
if (status.status !== 0) {
  console.error("Reference concurrency test requires local Supabase.");
  process.exit(1);
}
const local = JSON.parse(status.stdout);
if (
  !["127.0.0.1", "localhost", "::1"].includes(new URL(local.DB_URL).hostname)
) {
  console.error(
    "Refusing to run concurrency test against a non-local database.",
  );
  process.exit(1);
}

const calls = Array.from(
  { length: 20 },
  () =>
    new Promise((resolve, reject) => {
      const child = spawn("docker", [
        "exec",
        "supabase_db_smartdesk-ai-starter",
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-Atc",
        "select private.next_request_reference('10000000-0000-4000-8000-000000000001', '2026-08-07T00:00:00Z');",
      ]);
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve(stdout.trim());
        else reject(new Error(stderr || `psql exited ${code}`));
      });
    }),
);

const references = await Promise.all(calls);
if (new Set(references).size !== references.length) {
  throw new Error("Concurrent reference allocation produced a collision.");
}
if (!references.every((reference) => /^BP-2026-\d{6}$/.test(reference))) {
  throw new Error(
    "Concurrent reference allocation produced an invalid format.",
  );
}
console.log(
  `Concurrent reference allocation passed (${references.length} unique references).`,
);
