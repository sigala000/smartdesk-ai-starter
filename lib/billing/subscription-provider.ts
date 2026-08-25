import "server-only";

import { z } from "zod";

export const subscriptionWebhookSchema = z.object({
  providerEventId: z.string().min(8).max(256),
  providerCustomerReference: z.string().min(1).max(256),
  status: z.enum(["active", "past_due", "suspended", "cancelled"]),
  currentPeriodEndsAt: z.iso.datetime().nullable(),
});

export type SubscriptionWebhookEvent = z.infer<
  typeof subscriptionWebhookSchema
>;

/** Provider-neutral boundary. No implementation is enabled until the product
 * owner selects a processor and approves prices, currency, tax, and terms. */
export interface SubscriptionBillingProvider {
  verifyAndParseWebhook(
    rawBody: Uint8Array,
    signature: string,
  ): Promise<SubscriptionWebhookEvent>;
  createCustomerPortal?(
    providerCustomerReference: string,
    returnUrl: URL,
  ): Promise<URL>;
}

export function requireConfiguredBillingProvider(): never {
  throw new Error("smartdesk_billing_provider_not_configured");
}
