import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  verifyWebhookToken,
  verifyWhatsAppSignature,
} from "@/lib/meta/whatsapp-signature";

describe("WhatsApp webhook authentication", () => {
  it("accepts only the exact raw-body HMAC", () => {
    const body = new TextEncoder().encode('{"message":"hello"}');
    const secret = "meta-test-app-secret-123456";
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyWhatsAppSignature(body, `sha256=${signature}`, secret)).toBe(
      true,
    );
    expect(
      verifyWhatsAppSignature(
        new TextEncoder().encode('{"message":"changed"}'),
        `sha256=${signature}`,
        secret,
      ),
    ).toBe(false);
  });

  it.each([null, "sha1=abcd", "sha256=xyz", `sha256=${"a".repeat(62)}`])(
    "rejects malformed signatures",
    (signature) => {
      expect(
        verifyWhatsAppSignature(new Uint8Array([1]), signature, "secret"),
      ).toBe(false);
    },
  );

  it("compares verification tokens without accepting prefixes", () => {
    expect(verifyWebhookToken("correct-token", "correct-token")).toBe(true);
    expect(verifyWebhookToken("correct", "correct-token")).toBe(false);
  });
});
