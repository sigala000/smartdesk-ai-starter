import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";

const tracked = execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean)
  .filter((file) => !file.endsWith("package-lock.json"));
const patterns = [
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key"],
  [/(?:^|[^A-Za-z0-9])sk-(?:proj-)?[A-Za-z0-9_-]{20,}/, "OpenAI key"],
  [/(?:^|[^A-Za-z0-9])EA[A-Za-z0-9]{30,}/, "Meta access token"],
];
const browserSecretNames =
  /(?:OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|META_APP_SECRET|META_WHATSAPP_ACCESS_TOKEN)/;
const jwtPattern =
  /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g;
const findings = [];
function containsPrivilegedJwt(content) {
  for (const token of content.match(jwtPattern) ?? []) {
    try {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
      );
      if (payload.role === "service_role") return true;
    } catch {
      // Malformed token-shaped values are covered by the credential patterns.
    }
  }
  return false;
}
for (const file of tracked) {
  if (!existsSync(file) || !statSync(file).isFile()) continue;
  const content = readFileSync(file, "utf8");
  for (const [pattern, label] of patterns)
    if (pattern.test(content)) findings.push(`${file}: possible ${label}`);
  if (containsPrivilegedJwt(content))
    findings.push(`${file}: possible privileged Supabase JWT`);
  if (
    (file.startsWith("components/") || /^app\/(?!api\/)/.test(file)) &&
    browserSecretNames.test(content)
  )
    findings.push(`${file}: server-only secret name in browser-capable source`);
}

for (const directory of [".next/static", "playwright-report", "test-results"]) {
  if (!existsSync(directory)) continue;
  const files = execFileSync("find", [directory, "-type", "f", "-print0"], {
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    for (const [pattern, label] of patterns)
      if (pattern.test(content)) findings.push(`${file}: possible ${label}`);
    if (containsPrivilegedJwt(content))
      findings.push(`${file}: possible privileged Supabase JWT`);
  }
}
if (findings.length) {
  console.error("Secret scan failed:\n" + findings.join("\n"));
  process.exit(1);
}
console.log(`Secret scan passed (${tracked.length} tracked files checked).`);
