import { describe, expect, it } from "vitest";

import { loginSchema, sanitizeInternalRedirect } from "@/lib/auth/login-schema";

describe("login input", () => {
  it("normalizes a valid employee email", () => {
    expect(
      loginSchema.parse({
        email: " Employee@Example.com ",
        password: "correct horse battery staple",
      }).email,
    ).toBe("employee@example.com");
  });

  it("rejects malformed or unbounded credentials", () => {
    expect(
      loginSchema.safeParse({ email: "invalid", password: "" }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({
        email: "employee@example.com",
        password: "x".repeat(1025),
      }).success,
    ).toBe(false);
  });

  it("allows only internal return paths", () => {
    expect(
      sanitizeInternalRedirect("/dashboard/organization?tab=profile"),
    ).toBe("/dashboard/organization?tab=profile");
    for (const unsafe of [
      "https://attacker.example",
      "//attacker.example",
      "/%2f%2fattacker.example",
      "/\\attacker.example",
      "%not-valid",
    ]) {
      expect(sanitizeInternalRedirect(unsafe)).toBe("/dashboard");
    }
  });
});
