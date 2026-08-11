import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyWhatsAppSignature(
  rawBody: Uint8Array,
  signatureHeader: string | null,
  appSecret: string,
) {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const hex = signatureHeader.slice(7);
  if (!/^[a-f0-9]{64}$/i.test(hex)) return false;
  const supplied = Buffer.from(hex, "hex");
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

export function verifyWebhookToken(supplied: string, expected: string) {
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
