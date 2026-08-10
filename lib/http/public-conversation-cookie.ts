import { createHash, randomBytes } from "node:crypto";

export const conversationCookieName = (conversationId: string) =>
  `sd_conversation_${conversationId}`;

export function createOpaqueSecret() {
  return randomBytes(32).toString("base64url");
}

export function digestSecret(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function conversationCookieOptions(maxAge = 60 * 60 * 24) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
