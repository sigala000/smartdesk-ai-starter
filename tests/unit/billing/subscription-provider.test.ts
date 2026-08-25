import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  requireConfiguredBillingProvider,
  subscriptionWebhookSchema,
} from "@/lib/billing/subscription-provider";

describe("provider-neutral subscription billing boundary", () => {
  it("accepts only the approved provider-independent status projection", () => {
    expect(
      subscriptionWebhookSchema.safeParse({
        providerEventId: "event-12345",
        providerCustomerReference: "customer-1",
        status: "active",
        currentPeriodEndsAt: null,
      }).success,
    ).toBe(true);
    expect(
      subscriptionWebhookSchema.safeParse({
        providerEventId: "event-12345",
        providerCustomerReference: "customer-1",
        status: "paid_forever",
        currentPeriodEndsAt: null,
      }).success,
    ).toBe(false);
  });

  it("fails closed while no billing provider is approved", () => {
    expect(() => requireConfiguredBillingProvider()).toThrow(
      "smartdesk_billing_provider_not_configured",
    );
  });
});
