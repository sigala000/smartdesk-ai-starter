import { describe, expect, it } from "vitest";

import {
  organizationOnboardingSchema,
  ownerRegistrationSchema,
} from "@/lib/schemas/organization-onboarding";

describe("organization onboarding schemas", () => {
  it("normalizes a tenant slug and reference prefix", () => {
    expect(
      organizationOnboardingSchema.parse({
        name: "Example Company",
        displayName: "Ada Owner",
        slug: "Example Company Ltd",
        referencePrefix: " ex ",
      }),
    ).toMatchObject({ slug: "example-company-ltd", referencePrefix: "EX" });
  });
  it("requires a strong owner password and valid identifiers", () => {
    expect(
      ownerRegistrationSchema.safeParse({
        email: "owner@example.com",
        password: "short",
        fullName: "Ada Owner",
      }).success,
    ).toBe(false);
    expect(
      organizationOnboardingSchema.safeParse({
        name: "E",
        displayName: "A",
        slug: "--",
        referencePrefix: "$",
      }).success,
    ).toBe(false);
  });
});
