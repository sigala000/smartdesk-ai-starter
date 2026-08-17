import { defineConfig, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";

function localSupabaseServiceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY)
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  const status = execFileSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["exec", "supabase", "--", "status", "-o", "env"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  const key = status.match(/^SERVICE_ROLE_KEY="([^"]+)"$/m)?.[1];
  if (!key)
    throw new Error("Local Supabase service credential is unavailable.");
  return key;
}

const localTestEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
  SUPABASE_SERVICE_ROLE_KEY: localSupabaseServiceKey(),
  PUBLIC_RATE_LIMIT_SECRET:
    process.env.PUBLIC_RATE_LIMIT_SECRET ??
    "local-browser-only-rate-limit-secret-32-bytes",
};

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Public rate limits deliberately serialize the two viewport projects.
  workers: 1,
  reporter: "line",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    video: process.env.RECORD_DEMO ? "on" : "off",
  },
  webServer: {
    command: "npm run dev",
    env: localTestEnvironment,
    url: "http://127.0.0.1:3000",
    // Reusing a developer server can silently mix hosted and disposable-local
    // credentials. Always start the test-owned process with the supplied env.
    reuseExistingServer: Boolean(process.env.RECORD_DEMO),
    timeout: 120_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
