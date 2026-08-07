import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (process.env.ALLOW_LOCAL_SAMPLE_DATA !== "true") {
  console.error(
    "Refusing to seed: set ALLOW_LOCAL_SAMPLE_DATA=true explicitly.",
  );
  process.exit(1);
}

const status = spawnSync("npx", ["supabase", "status", "--output", "json"], {
  encoding: "utf8",
  env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "true" },
});
if (status.status !== 0) {
  console.error("Refusing to seed: local Supabase is not running.");
  process.exit(1);
}
const local = JSON.parse(status.stdout);
const databaseUrl = new URL(local.DB_URL);
if (!["127.0.0.1", "localhost", "::1"].includes(databaseUrl.hostname)) {
  console.error("Refusing to seed: Supabase database is not local.");
  process.exit(1);
}

const sql = readFileSync(
  new URL("../supabase/seeds/development.sql", import.meta.url),
);
const result = spawnSync(
  "docker",
  [
    "exec",
    "-i",
    "supabase_db_smartdesk-ai-starter",
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
  ],
  { input: sql, stdio: ["pipe", "inherit", "inherit"] },
);
process.exit(result.status ?? 1);
