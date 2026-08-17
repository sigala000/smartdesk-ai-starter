import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const email = "admin@buildpro.local";
const password = "BuildPro-local-demo-42!";
const organizationId = "10000000-0000-4000-8000-000000000001";
const cli = fileURLToPath(
  new URL("../node_modules/.bin/supabase", import.meta.url),
);
const output = execFileSync(cli, ["status", "-o", "env"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
});
const values = new Map();
for (const line of output.split("\n")) {
  const match = line.match(/^([A-Z_]+)=(?:"(.*)"|(.*))$/);
  if (match) values.set(match[1], match[2] ?? match[3]);
}
const url = values.get("API_URL");
if (!url?.startsWith("http://127.0.0.1:"))
  throw new Error("Local Supabase is required.");
const admin = createClient(url, values.get("SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const listed = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listed.error) throw listed.error;
let user = listed.data.users.find((candidate) => candidate.email === email);
if (!user) {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) throw created.error;
  user = created.data.user;
} else {
  const updated = await admin.auth.admin.updateUserById(user.id, { password });
  if (updated.error) throw updated.error;
}
const membership = await admin.from("organization_members").upsert(
  {
    organization_id: organizationId,
    user_id: user.id,
    display_name: "BuildPro Local Administrator",
    role: "admin",
    is_active: true,
  },
  { onConflict: "organization_id,user_id" },
);
if (membership.error) throw membership.error;
console.log(`Local demo employee ready: ${email}`);
console.log(`Local-only password: ${password}`);
