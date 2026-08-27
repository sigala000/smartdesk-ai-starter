import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";

describe("content security policy", () => {
  it("allows only the Meta origins required by Embedded Signup", async () => {
    expect(nextConfig.headers).toBeTypeOf("function");
    const rules = await nextConfig.headers!();
    const policy = rules
      .flatMap((rule) => rule.headers)
      .find((header) => header.key === "Content-Security-Policy")?.value;

    expect(policy).toContain(
      "script-src 'self' 'unsafe-inline' https://connect.facebook.net",
    );
    expect(policy).toContain("https://graph.facebook.com");
    expect(policy).toContain(
      "frame-src https://www.facebook.com https://web.facebook.com",
    );
    expect(policy).not.toContain("script-src *");
    expect(policy).not.toContain("connect-src *");
  });
});
