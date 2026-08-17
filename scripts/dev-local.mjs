import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(
  new URL("../node_modules/.bin/supabase", import.meta.url),
);
const status = execFileSync(cli, ["status", "-o", "env"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
});
const environment = Object.fromEntries(
  status
    .split("\n")
    .map((line) => line.match(/^([A-Z_]+)=(?:"(.*)"|(.*))$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2] ?? match[3]]),
);

if (!environment.API_URL?.startsWith("http://127.0.0.1:")) {
  throw new Error("Local Supabase is not running. Run npm run db:start first.");
}

const child = spawn(
  fileURLToPath(new URL("../node_modules/.bin/next", import.meta.url)),
  ["dev"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: environment.API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: environment.PUBLISHABLE_KEY,
      SUPABASE_SERVICE_ROLE_KEY: environment.SERVICE_ROLE_KEY,
      PUBLIC_RATE_LIMIT_SECRET: "local-development-rate-limit-secret-32-bytes",
      STATUS_VERIFICATION_ENABLED: "true",
      STATUS_VERIFICATION_PROVIDER: "mock",
      STATUS_VERIFICATION_MOCK_EXPOSE_CODE: "true",
      META_WHATSAPP_ENABLED:
        process.env.LOCAL_META_TEST === "true" ? "true" : "false",
    },
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 1));
