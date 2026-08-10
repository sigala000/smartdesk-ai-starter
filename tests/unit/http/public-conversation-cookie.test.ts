import { describe, expect, it } from "vitest";

import {
  conversationCookieName,
  conversationCookieOptions,
  createOpaqueSecret,
  digestSecret,
} from "@/lib/http/public-conversation-cookie";

describe("public conversation token", () => {
  it("creates high-entropy opaque values and deterministic digests", () => {
    const token = createOpaqueSecret();
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(digestSecret(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(createOpaqueSecret()).not.toBe(token);
  });

  it("uses an HttpOnly same-site cookie", () => {
    expect(conversationCookieName("id")).toBe("sd_conversation_id");
    expect(conversationCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });
});
