import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MetaWhatsAppClient } from "@/lib/meta/whatsapp-client";

const config = {
  graphApiVersion: "v99.0",
  accessToken: "server-secret-token",
  phoneNumberId: "12345678901",
  testRecipient: "237600000001",
  timeoutMs: 1000,
};

describe("Meta WhatsApp client", () => {
  it("uses the fixed Graph endpoint and test-recipient allowlist", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.out.1" }] }), {
        status: 200,
      }),
    );
    const client = new MetaWhatsAppClient(config, request);
    await expect(client.sendText("237600000001", "Hello")).resolves.toEqual({
      ok: true,
      providerMessageId: "wamid.out.1",
    });
    expect(request.mock.calls[0][0]).toBe(
      "https://graph.facebook.com/v99.0/12345678901/messages",
    );
    const options = request.mock.calls[0][1];
    expect(options?.headers).toMatchObject({
      Authorization: "Bearer server-secret-token",
    });
    await expect(client.sendText("237600000099", "No")).resolves.toMatchObject({
      ok: false,
      code: "meta_rejected",
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("supports several explicitly authorized developer-test recipients", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.out.2" }] }), {
        status: 200,
      }),
    );
    const client = new MetaWhatsAppClient(
      {
        ...config,
        testRecipient: undefined,
        allowedRecipients: ["237600000001", "237600000002"],
      },
      request,
    );
    await expect(
      client.sendText("237600000002", "Hello friend"),
    ).resolves.toMatchObject({ ok: true });
    await expect(client.sendText("237600000003", "Denied")).resolves.toEqual({
      ok: false,
      code: "meta_rejected",
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("normalizes provider failures without exposing response bodies", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("sensitive provider response", { status: 401 }),
      );
    await expect(
      new MetaWhatsAppClient(config, request).sendText("237600000001", "Hello"),
    ).resolves.toEqual({ ok: false, code: "meta_authentication" });
  });

  it("classifies rate limits, server failures, and ambiguous timeouts", async () => {
    const billing = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 402 }));
    await expect(
      new MetaWhatsAppClient(config, billing).sendText("237600000001", "Hello"),
    ).resolves.toEqual({ ok: false, code: "meta_billing_required" });

    const limited = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 429 }));
    await expect(
      new MetaWhatsAppClient(config, limited).sendText("237600000001", "Hello"),
    ).resolves.toEqual({ ok: false, code: "meta_rate_limited" });

    const unavailable = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    await expect(
      new MetaWhatsAppClient(config, unavailable).sendText(
        "237600000001",
        "Hello",
      ),
    ).resolves.toEqual({ ok: false, code: "meta_server_error" });

    const timedOut = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("network detail"));
    await expect(
      new MetaWhatsAppClient(config, timedOut).sendText(
        "237600000001",
        "Hello",
      ),
    ).resolves.toEqual({ ok: false, code: "meta_timeout" });
  });
});
