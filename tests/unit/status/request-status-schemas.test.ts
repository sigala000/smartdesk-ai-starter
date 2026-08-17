import { describe, expect, it } from "vitest";
import {
  statusChallengeSchema,
  statusTokenSchema,
  statusVerifySchema,
} from "@/lib/schemas/request-status-api";
describe("request status schemas", () => {
  it("accepts bounded public inputs", () =>
    expect(
      statusChallengeSchema.parse({
        organizationSlug: "buildpro-cameroon",
        referenceNumber: "bp-2026-000001",
        phone: "+237600000001",
      }).referenceNumber,
    ).toBe("BP-2026-000001"));
  it("rejects missing factors and scope injection", () =>
    expect(
      statusChallengeSchema.safeParse({
        organizationSlug: "buildpro-cameroon",
        referenceNumber: "BP-2026-000001",
        organizationId: crypto.randomUUID(),
      }).success,
    ).toBe(false));
  it("requires a six digit code and high entropy token", () => {
    expect(
      statusVerifySchema.safeParse({
        challengeId: crypto.randomUUID(),
        code: "123456",
      }).success,
    ).toBe(true);
    expect(
      statusVerifySchema.safeParse({
        challengeId: crypto.randomUUID(),
        code: "12345",
      }).success,
    ).toBe(false);
    expect(statusTokenSchema.safeParse("a".repeat(43)).success).toBe(true);
  });
});
