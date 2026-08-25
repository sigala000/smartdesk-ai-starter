import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.env.NODE_ENV === "production")
  throw new Error("WhatsApp test-account setup refuses NODE_ENV=production");

let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (process.env.WHATSAPP_TARGET === "local") {
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
  url = values.get("API_URL");
  serviceKey = values.get("SERVICE_ROLE_KEY");
  if (!url?.startsWith("http://127.0.0.1:"))
    throw new Error("Local WhatsApp setup requires local Supabase");
}
const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
const businessAccountId = process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID;
const recipients = [
  ...new Set(
    [
      ...(process.env.META_WHATSAPP_TEST_RECIPIENTS?.split(",") ?? []),
      process.env.META_WHATSAPP_TEST_RECIPIENT,
    ]
      .filter(Boolean)
      .map((value) => value.trim().replace(/^\+/, "")),
  ),
];
if (
  !url ||
  !serviceKey ||
  !phoneNumberId ||
  !businessAccountId ||
  recipients.length === 0
)
  throw new Error(
    "Supabase URL/service key and Meta phone-number/WABA IDs are required",
  );
if (!/^\d{5,32}$/.test(phoneNumberId) || !/^\d{5,32}$/.test(businessAccountId))
  throw new Error("Meta test account IDs are invalid");
if (
  recipients.length > 20 ||
  recipients.some((value) => !/^\d{6,20}$/.test(value))
)
  throw new Error("Meta test recipients are invalid");

const client = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const organization = await client
  .from("organizations")
  .select("id")
  .eq("slug", "buildpro-cameroon")
  .eq("is_active", true)
  .single();
if (organization.error) throw new Error("BuildPro organization is unavailable");
const configured = await client
  .from("whatsapp_accounts")
  .upsert(
    {
      organization_id: organization.data.id,
      phone_number_id: phoneNumberId,
      whatsapp_business_account_id: businessAccountId,
      is_test: true,
      mode: "developer_test",
      connection_status: "connected",
      graph_api_version: process.env.META_GRAPH_API_VERSION ?? null,
      is_active: true,
    },
    { onConflict: "phone_number_id" },
  )
  .select("id")
  .single();
if (configured.error) throw new Error("WhatsApp test account setup failed");
const allowed = await client.from("whatsapp_developer_test_recipients").upsert(
  recipients.map((waId) => ({
    organization_id: organization.data.id,
    whatsapp_account_id: configured.data.id,
    wa_id: waId,
    is_active: true,
  })),
  { onConflict: "whatsapp_account_id,wa_id" },
);
if (allowed.error) throw new Error("WhatsApp test recipient setup failed");
console.log(
  `BuildPro WhatsApp test account mapping configured (${process.env.WHATSAPP_TARGET === "local" ? "local" : "hosted"})`,
);
