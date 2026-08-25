import { createHash, randomBytes } from "node:crypto";

import { apiAccessError, apiError, apiSuccess } from "@/lib/http/api-response";
import { resolveEmployeeAccess } from "@/lib/auth/access-context";
import { can } from "@/lib/auth/permissions";
import { serverEnvironment } from "@/lib/config/env-server";
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
  const appId = serverEnvironment.NEXT_PUBLIC_META_APP_ID;
  const configId = serverEnvironment.NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID;
  const baseUrl = serverEnvironment.APP_BASE_URL;
  if (
    !appId ||
    appId !== serverEnvironment.META_APP_ID ||
    !configId ||
    !baseUrl
  )
    return apiError(
      "configuration_required",
      "WhatsApp onboarding is not configured yet.",
      503,
    );
  const requestOrigin = new URL(request.url).origin;
  if (new URL(baseUrl).origin !== requestOrigin)
    return apiError(
      "invalid_origin",
      "WhatsApp onboarding must start from the configured application address.",
      400,
    );
  const state = randomBytes(32).toString("base64url");
  const created = await createAdminClient()
    .from("meta_embedded_signup_attempts")
    .insert({
      organization_id: access.context.organization.id,
      requested_by_member_id: access.context.membership.id,
      state_digest: digest(state),
      expected_origin: requestOrigin,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
  if (created.error)
    return apiError(
      "internal_error",
      "WhatsApp onboarding could not be started.",
      500,
    );
  return apiSuccess({ state, appId, configurationId: configId });
}
