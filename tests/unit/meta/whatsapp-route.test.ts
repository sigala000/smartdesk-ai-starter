import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const environment = {
  META_WHATSAPP_ENABLED: "true",
  META_GRAPH_API_VERSION: "v99.0",
  META_APP_ID: "123456789",
  META_APP_SECRET: "test-app-secret-never-exposed",
  META_WHATSAPP_VERIFY_TOKEN: "v".repeat(64),
  META_WHATSAPP_ACCESS_TOKEN: "test-access-token-never-exposed",
  META_WHATSAPP_PHONE_NUMBER_ID: "12345678901",
  META_WHATSAPP_BUSINESS_ACCOUNT_ID: "98765432101",
  META_WHATSAPP_TEST_RECIPIENT: "+237600000001",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
};

async function route() {
  Object.assign(process.env, environment);
  vi.resetModules();
  return import("@/app/api/webhooks/whatsapp/route");
}

afterEach(() => {
  for (const name of Object.keys(environment)) delete process.env[name];
  vi.resetModules();
});

describe("WhatsApp webhook route", () => {
  it("returns Meta's challenge only for the configured verify token", async () => {
    const { GET } = await route();
    const valid = await GET(
      new Request(
        `https://example.test/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${"v".repeat(64)}&hub.challenge=challenge-123`,
      ),
    );
    expect(valid.status).toBe(200);
    expect(await valid.text()).toBe("challenge-123");
    const invalid = await GET(
      new Request(
        "https://example.test/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge-123",
      ),
    );
    expect(invalid.status).toBe(403);
    expect(await invalid.text()).not.toContain(
      environment.META_WHATSAPP_VERIFY_TOKEN,
    );
  });

  it("rejects an invalid signature before parsing or database access", async () => {
    const { POST } = await route();
    const response = await POST(
      new Request("https://example.test/api/webhooks/whatsapp", {
        method: "POST",
        headers: { "x-hub-signature-256": `sha256=${"0".repeat(64)}` },
        body: "not-json",
      }),
    );
    expect(response.status).toBe(401);
    const body = await response.text();
    expect(body).not.toContain(environment.META_APP_SECRET);
    expect(body).not.toContain(environment.META_WHATSAPP_ACCESS_TOKEN);
  });

  it("passes a valid signed text event to the channel service", async () => {
    const { createWhatsAppWebhookHandlers } = await route();
    const handle = vi.fn(async () => ({ accepted: true as const }));
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "98765432101",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { phone_number_id: "12345678901" },
                contacts: [{ wa_id: "237600000001" }],
                messages: [
                  {
                    from: "237600000001",
                    id: "wamid.route.1",
                    timestamp: "1786356000",
                    type: "text",
                    text: { body: "Hello" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    const signature = createHmac("sha256", environment.META_APP_SECRET)
      .update(body)
      .digest("hex");
    const handlers = createWhatsAppWebhookHandlers(
      () =>
        ({
          config: {
            verifyToken: environment.META_WHATSAPP_VERIFY_TOKEN,
            appSecret: environment.META_APP_SECRET,
            maxWebhookBytes: 262144,
          },
          service: { handle },
        }) as unknown as NonNullable<
          ReturnType<
            typeof import("@/lib/services/whatsapp-runtime").createWhatsAppRuntime
          >
        >,
    );
    const response = await handlers.POST(
      new Request("https://example.test/api/webhooks/whatsapp", {
        method: "POST",
        headers: { "x-hub-signature-256": `sha256=${signature}` },
        body,
      }),
    );
    expect(response.status).toBe(200);
    expect(handle).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "message",
        phoneNumberId: "12345678901",
        waId: "237600000001",
        text: "Hello",
      }),
      expect.any(String),
    );
  });
});
