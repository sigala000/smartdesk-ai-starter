import { createClient } from "@supabase/supabase-js";

if (process.env.NODE_ENV === "production")
  throw new Error("WhatsApp test-account setup refuses NODE_ENV=production");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
const businessAccountId = process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID;
if (!url || !serviceKey || !phoneNumberId || !businessAccountId)
  throw new Error(
    "Supabase URL/service key and Meta phone-number/WABA IDs are required",
  );
if (!/^\d{5,32}$/.test(phoneNumberId) || !/^\d{5,32}$/.test(businessAccountId))
  throw new Error("Meta test account IDs are invalid");

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
const configured = await client.from("whatsapp_accounts").upsert(
  {
    organization_id: organization.data.id,
    phone_number_id: phoneNumberId,
    whatsapp_business_account_id: businessAccountId,
    is_test: true,
    is_active: true,
  },
  { onConflict: "phone_number_id" },
);
if (configured.error) throw new Error("WhatsApp test account setup failed");
console.log("BuildPro WhatsApp test account mapping configured");
