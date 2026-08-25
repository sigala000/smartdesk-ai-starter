import { createHash } from "node:crypto";

import {
  apiAccessError,
  apiError,
  apiSuccess,
  apiValidation,
  parseBoundedJson,
} from "@/lib/http/api-response";
import { resolveEmployeeAccess } from "@/lib/auth/access-context";
import { can } from "@/lib/auth/permissions";
import {
  requireMetaCredentialEncryptionConfig,
  requireMetaPlatformConfig,
} from "@/lib/config/env-schema";
import { serverEnvironment } from "@/lib/config/env-server";
import { encryptCredential } from "@/lib/crypto/credential-envelope";
import { MetaEmbeddedSignupClient } from "@/lib/meta/embedded-signup-client";
import { completeEmbeddedSignupSchema } from "@/lib/schemas/meta-embedded-signup";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function POST(request: Request) {
  const access = await resolveEmployeeAccess(await createClient());
  if (!access.ok)
    return apiAccessError(access, "Company administrator access is required.");
  if (!can(access.context.membership.role, "organization:manage"))
    return apiError(
      "forbidden",
      "Company administrator access is required.",
      403,
    );
  const body = await parseBoundedJson(request);
  if (!body.ok) return body.response;
  const parsed = completeEmbeddedSignupSchema.safeParse(body.value);
  if (!parsed.success) return apiValidation(parsed.error);
  const meta = requireMetaPlatformConfig(serverEnvironment);
  const encryption = requireMetaCredentialEncryptionConfig(serverEnvironment);
  if (!encryption || !serverEnvironment.APP_BASE_URL)
    return apiError(
      "configuration_required",
      "WhatsApp onboarding is not configured yet.",
      503,
    );
  const admin = createAdminClient();
  const attempt = await admin
    .from("meta_embedded_signup_attempts")
    .select("id,status,expires_at,expected_origin")
    .eq("organization_id", access.context.organization.id)
    .eq("requested_by_member_id", access.context.membership.id)
    .eq("state_digest", digest(parsed.data.state))
    .maybeSingle();
  if (
    !attempt.data ||
    attempt.data.status !== "pending" ||
    new Date(attempt.data.expires_at).getTime() <= Date.now() ||
    attempt.data.expected_origin !== new URL(request.url).origin
  )
    return apiError(
      "signup_state_invalid",
      "This WhatsApp connection attempt has expired. Start again.",
      409,
    );
  const claimed = await admin
    .from("meta_embedded_signup_attempts")
    .update({ status: "processing", consumed_at: new Date().toISOString() })
    .eq("id", attempt.data.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!claimed.data)
    return apiError(
      "signup_state_invalid",
      "This WhatsApp connection attempt has already been used.",
      409,
    );
  try {
    const provider = await new MetaEmbeddedSignupClient(meta).complete({
      code: parsed.data.code,
      wabaId: parsed.data.wabaId,
      phoneNumberId: parsed.data.phoneNumberId,
      redirectUri: `${new URL(serverEnvironment.APP_BASE_URL).origin}/dashboard/whatsapp`,
    });
    const [phoneCollision, wabaCollision] = await Promise.all([
      admin
        .from("whatsapp_accounts")
        .select("id,organization_id")
        .eq("phone_number_id", provider.phone.id)
        .maybeSingle(),
      admin
        .from("whatsapp_accounts")
        .select("id,organization_id")
        .eq("whatsapp_business_account_id", provider.waba.id)
        .neq("organization_id", access.context.organization.id)
        .limit(1)
        .maybeSingle(),
    ]);
    if (
      phoneCollision.data &&
      phoneCollision.data.organization_id !== access.context.organization.id
    )
      throw new Error("meta_asset_already_connected");
    if (wabaCollision.data) throw new Error("meta_asset_already_connected");
    const collision = phoneCollision;
    const accountWrite = await admin
      .from("whatsapp_accounts")
      .upsert(
        {
          ...(collision.data ? { id: collision.data.id } : {}),
          organization_id: access.context.organization.id,
          phone_number_id: provider.phone.id,
          whatsapp_business_account_id: provider.waba.id,
          display_phone_number: provider.phone.display_phone_number ?? null,
          display_name:
            provider.phone.verified_name ?? provider.waba.name ?? null,
          graph_api_version: meta.graphApiVersion,
          quality_rating: provider.phone.quality_rating ?? "UNKNOWN",
          mode: "production",
          is_test: false,
          is_active: true,
          connection_status: "test_pending",
          webhook_subscribed: true,
          last_health_check_at: new Date().toISOString(),
          connected_by_member_id: access.context.membership.id,
          connected_at: new Date().toISOString(),
          disconnected_at: null,
          last_error_code: null,
        },
        { onConflict: "phone_number_id" },
      )
      .select("id")
      .single();
    if (!accountWrite.data) throw new Error("account_persistence_failed");
    const envelope = encryptCredential(
      provider.accessToken,
      access.context.organization.id,
      accountWrite.data.id,
      encryption,
    );
    const credentialWrite = await admin
      .from("whatsapp_credential_envelopes")
      .upsert(
        {
          organization_id: access.context.organization.id,
          whatsapp_account_id: accountWrite.data.id,
          credential_kind: "cloud_api_access_token",
          key_version: envelope.keyVersion,
          ciphertext: envelope.ciphertext,
          initialization_vector: envelope.initializationVector,
          authentication_tag: envelope.authenticationTag,
          rotated_at: new Date().toISOString(),
        },
        { onConflict: "whatsapp_account_id,credential_kind" },
      );
    if (credentialWrite.error) throw new Error("credential_persistence_failed");
    await admin
      .from("meta_embedded_signup_attempts")
      .update({
        status: "completed",
        whatsapp_account_id: accountWrite.data.id,
      })
      .eq("id", attempt.data.id);
    return apiSuccess({
      connection: {
        status: "test_pending",
        displayPhoneNumber: provider.phone.display_phone_number ?? null,
        verifiedName: provider.phone.verified_name ?? null,
      },
    });
  } catch (error) {
    const code =
      error instanceof Error && /^meta_[a-z_]+$/.test(error.message)
        ? error.message
        : "connection_failed";
    await admin
      .from("meta_embedded_signup_attempts")
      .update({ status: "failed", last_error_code: code })
      .eq("id", attempt.data.id);
    return apiError(
      "connection_failed",
      "Meta could not complete the WhatsApp connection. Review the Meta account and try again.",
      502,
    );
  }
}
