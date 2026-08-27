import { EmbeddedSignupButton } from "@/components/whatsapp/embedded-signup-button";
import { DisconnectWhatsAppButton } from "@/components/whatsapp/disconnect-button";
import { requirePermission } from "@/lib/auth/require-access";
import { serverEnvironment } from "@/lib/config/env-server";
import { createAdminClient } from "@/lib/supabase/admin";

function maskPhone(value: string | null) {
  if (!value) return "Managed in Meta";
  const digits = value.replace(/\D/g, "");
  return digits.length > 4
    ? `+${digits.slice(0, 3)}••••${digits.slice(-3)}`
    : "••••";
}

export default async function WhatsAppSettingsPage() {
  const access = await requirePermission(
    "whatsapp:manage",
    "/dashboard/whatsapp",
  );
  const account = await createAdminClient()
    .from("whatsapp_accounts")
    .select(
      "id,display_name,display_phone_number,mode,connection_status,quality_rating,billing_status,last_health_check_at,last_error_code",
    )
    .eq("organization_id", access.organization.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const embeddedSignupConfigured = Boolean(
    serverEnvironment.NEXT_PUBLIC_META_APP_ID &&
    serverEnvironment.NEXT_PUBLIC_META_APP_ID ===
      serverEnvironment.META_APP_ID &&
    serverEnvironment.NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID &&
    serverEnvironment.APP_BASE_URL,
  );
  return (
    <section className="dashboard-stack" aria-labelledby="whatsapp-title">
      <div className="dashboard-card">
        <p className="eyebrow">Customer channels</p>
        <h1 id="whatsapp-title">WhatsApp connection</h1>
        <p className="lead">
          Your company authorizes its own Meta business and phone number.
          SmartDesk never asks for your Meta password, OTP, or payment card.
        </p>
      </div>
      <div className="dashboard-card">
        {account.data ? (
          <>
            <h2>{account.data.display_name ?? "Connected WhatsApp account"}</h2>
            <dl className="details-list">
              <div>
                <dt>Status</dt>
                <dd>{account.data.connection_status.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{maskPhone(account.data.display_phone_number)}</dd>
              </div>
              <div>
                <dt>Mode</dt>
                <dd>{account.data.mode.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt>Quality</dt>
                <dd>{account.data.quality_rating ?? "Not reported"}</dd>
              </div>
              <div>
                <dt>Meta billing</dt>
                <dd>{account.data.billing_status.replaceAll("_", " ")}</dd>
              </div>
            </dl>
            {account.data.last_error_code ? (
              <p className="form-error">
                Action required. Reconnect the account or review it in Meta
                Business Manager.
              </p>
            ) : null}
            {account.data.connection_status === "test_pending" ? (
              <p className="notice">
                Send a customer-initiated WhatsApp message to this number. The
                connection becomes active only after SmartDesk receives it and
                Meta accepts the reply.
              </p>
            ) : null}
            {account.data.billing_status === "action_required" ? (
              <p>
                <a
                  href="https://business.facebook.com/wa/manage/home/"
                  rel="noreferrer"
                  target="_blank"
                >
                  Complete billing in WhatsApp Manager
                </a>
                . Meta billing is separate from SmartDesk billing.
              </p>
            ) : null}
            {embeddedSignupConfigured &&
            [
              "connected",
              "active",
              "test_pending",
              "degraded",
              "billing_required",
            ].includes(account.data.connection_status) ? (
              <DisconnectWhatsAppButton />
            ) : embeddedSignupConfigured ? (
              <EmbeddedSignupButton />
            ) : (
              <p className="form-error" role="alert">
                Meta Embedded Signup is not configured by the SmartDesk operator
                yet. Your company account is working; WhatsApp connection will
                become available after the Meta configuration ID is installed.
              </p>
            )}
          </>
        ) : (
          <>
            <h2>No WhatsApp account connected</h2>
            <p>
              Meta will guide you to choose or register your company-owned
              number and authorize SmartDesk.
            </p>
          </>
        )}
        {!account.data && embeddedSignupConfigured ? (
          <EmbeddedSignupButton />
        ) : null}
        {!account.data && !embeddedSignupConfigured ? (
          <p className="form-error" role="alert">
            Meta Embedded Signup is not configured by the SmartDesk operator
            yet. Your company account is working; WhatsApp connection will
            become available after the Meta configuration ID is installed.
          </p>
        ) : null}
      </div>
      <div className="dashboard-card">
        <h2>How billing works</h2>
        <p>
          Meta bills your company directly for WhatsApp usage. SmartDesk does
          not receive or store your card details and does not share a Meta
          credit line.
        </p>
      </div>
    </section>
  );
}
