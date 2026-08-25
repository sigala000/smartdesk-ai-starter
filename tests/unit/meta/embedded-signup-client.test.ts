import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MetaEmbeddedSignupClient } from "@/lib/meta/embedded-signup-client";

const config = {
  graphApiVersion: "v26.0",
  appId: "123456",
  appSecret: "secret-at-least-sixteen",
  timeoutMs: 1000,
};

describe("Meta Embedded Signup client", () => {
  it("exchanges a code, validates selected assets, and subscribes the WABA", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "provider-access-token-long-enough" }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              app_id: "123456",
              is_valid: true,
              scopes: [
                "whatsapp_business_management",
                "whatsapp_business_messaging",
              ],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: "98765432101", name: "Example WABA" }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "12345678901",
                display_phone_number: "+237600000001",
                verified_name: "Example",
                quality_rating: "GREEN",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );
    const result = await new MetaEmbeddedSignupClient(config, request).complete(
      {
        code: "short-lived-code",
        wabaId: "98765432101",
        phoneNumberId: "12345678901",
        redirectUri: "https://smartdesk.example/dashboard/whatsapp",
      },
    );
    expect(result.phone.id).toBe("12345678901");
    expect(request).toHaveBeenCalledTimes(5);
    expect(String(request.mock.calls[4][0])).toBe(
      "https://graph.facebook.com/v26.0/98765432101/subscribed_apps",
    );
    expect(JSON.stringify(request.mock.calls)).not.toContain(
      "provider response body detail",
    );
  });

  it("fails closed when an asset returned by Meta differs from the selected asset", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "provider-access-token-long-enough" }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              app_id: "123456",
              is_valid: true,
              scopes: [
                "whatsapp_business_management",
                "whatsapp_business_messaging",
              ],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "98765432109" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: "12345678901" }] }), {
          status: 200,
        }),
      );
    await expect(
      new MetaEmbeddedSignupClient(config, request).complete({
        code: "short-lived-code",
        wabaId: "98765432101",
        phoneNumberId: "12345678901",
        redirectUri: "https://smartdesk.example/dashboard/whatsapp",
      }),
    ).rejects.toThrow("meta_asset_mismatch");
    expect(request).toHaveBeenCalledTimes(4);
  });

  it("rejects a token issued to another app or missing required WhatsApp scopes", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "provider-access-token-long-enough" }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              app_id: "other-app",
              is_valid: true,
              scopes: ["whatsapp_business_management"],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "98765432101" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: "12345678901" }] }), {
          status: 200,
        }),
      );
    await expect(
      new MetaEmbeddedSignupClient(config, request).complete({
        code: "short-lived-code",
        wabaId: "98765432101",
        phoneNumberId: "12345678901",
        redirectUri: "https://smartdesk.example/dashboard/whatsapp",
      }),
    ).rejects.toThrow("meta_permission_mismatch");
  });

  it("normalizes provider authentication failure without exposing its body", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("sensitive provider detail", { status: 401 }),
      );
    await expect(
      new MetaEmbeddedSignupClient(config, request).complete({
        code: "short-lived-code",
        wabaId: "98765432101",
        phoneNumberId: "12345678901",
        redirectUri: "https://smartdesk.example/dashboard/whatsapp",
      }),
    ).rejects.toThrow("meta_authentication");
  });
});
