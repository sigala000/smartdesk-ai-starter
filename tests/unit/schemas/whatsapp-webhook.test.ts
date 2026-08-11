import { describe, expect, it } from "vitest";

import {
  flattenWhatsAppWebhook,
  whatsappWebhookSchema,
} from "@/lib/schemas/whatsapp-webhook";

const fixture = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "98765432101",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "+15550000000",
              phone_number_id: "12345678901",
            },
            contacts: [{ wa_id: "237600000001", profile: { name: "Test" } }],
            messages: [
              {
                from: "237600000001",
                id: "wamid.test.1",
                timestamp: "1786356000",
                type: "text",
                text: { body: "I want a quotation" },
              },
            ],
          },
        },
      ],
    },
  ],
};

describe("WhatsApp webhook schema", () => {
  it("parses and flattens a bounded inbound text message", () => {
    const parsed = whatsappWebhookSchema.parse(fixture);
    expect(flattenWhatsAppWebhook(parsed)).toMatchObject([
      {
        kind: "message",
        phoneNumberId: "12345678901",
        businessAccountId: "98765432101",
        waId: "237600000001",
        text: "I want a quotation",
      },
    ]);
  });

  it("rejects forged object types and oversized text", () => {
    expect(
      whatsappWebhookSchema.safeParse({ ...fixture, object: "page" }).success,
    ).toBe(false);
    const oversized = structuredClone(fixture);
    oversized.entry[0].changes[0].value.messages[0].text.body = "x".repeat(
      2001,
    );
    expect(whatsappWebhookSchema.safeParse(oversized).success).toBe(false);
  });

  it("accepts Meta's signed synthetic dashboard WABA ID for a no-op test", () => {
    const dashboardTest = structuredClone(fixture);
    dashboardTest.entry[0].id = "0";

    expect(whatsappWebhookSchema.safeParse(dashboardTest).success).toBe(true);
  });
});
