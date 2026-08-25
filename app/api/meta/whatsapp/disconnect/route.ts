import { apiAccessError, apiError, apiSuccess } from "@/lib/http/api-response";
import { resolveEmployeeAccess } from "@/lib/auth/access-context";
import { can } from "@/lib/auth/permissions";
import {
  requireMetaCredentialEncryptionConfig,
  requireMetaPlatformConfig,
} from "@/lib/config/env-schema";
import { serverEnvironment } from "@/lib/config/env-server";
import { decryptCredential } from "@/lib/crypto/credential-envelope";
import { MetaEmbeddedSignupClient } from "@/lib/meta/embedded-signup-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const access = await resolveEmployeeAccess(await createClient());
  if (!access.ok)
    return apiAccessError(access, "Company administrator access is required.");
  if (!can(access.context.membership.role, "whatsapp:manage"))
    return apiError(
      "forbidden",
      "Company administrator access is required.",
      403,
    );
  const admin = createAdminClient();
  const account = await admin
    .from("whatsapp_accounts")
    .select("id,whatsapp_business_account_id,mode")
    .eq("organization_id", access.context.organization.id)
    .in("connection_status", [
      "connected",
      "test_pending",
      "active",
      "degraded",
      "billing_required",
      "suspended",
    ])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!account.data)
    return apiError(
      "not_found",
      "No connected WhatsApp account was found.",
      404,
    );
  if (account.data.mode === "production") {
    const credential = await admin
      .from("whatsapp_credential_envelopes")
      .select("key_version,ciphertext,initialization_vector,authentication_tag")
      .eq("organization_id", access.context.organization.id)
      .eq("whatsapp_account_id", account.data.id)
      .maybeSingle();
    const encryption = requireMetaCredentialEncryptionConfig(serverEnvironment);
    if (!credential.data || !encryption)
      return apiError(
        "configuration_required",
        "The account cannot be disconnected safely. Contact support.",
        503,
      );
    try {
      const token = decryptCredential(
        {
          keyVersion: credential.data.key_version,
          ciphertext: credential.data.ciphertext,
          initializationVector: credential.data.initialization_vector,
          authenticationTag: credential.data.authentication_tag,
        },
        access.context.organization.id,
        account.data.id,
        encryption,
      );
      const success = await new MetaEmbeddedSignupClient(
        requireMetaPlatformConfig(serverEnvironment),
      ).unsubscribe(account.data.whatsapp_business_account_id, token);
      if (!success) throw new Error("unsubscribe_failed");
    } catch {
      return apiError(
        "provider_error",
        "Meta did not confirm the disconnect. No local connection was removed.",
        502,
      );
    }
  }
  await admin
    .from("whatsapp_accounts")
    .update({
      connection_status: "disconnected",
      is_active: false,
      disconnected_at: new Date().toISOString(),
    })
    .eq("organization_id", access.context.organization.id)
    .eq("id", account.data.id);
  await admin
    .from("whatsapp_credential_envelopes")
    .delete()
    .eq("organization_id", access.context.organization.id)
    .eq("whatsapp_account_id", account.data.id);
  return apiSuccess({ connection: { status: "disconnected" } });
}
