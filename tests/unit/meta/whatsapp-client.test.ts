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
});
