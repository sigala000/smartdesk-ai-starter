import { z } from "zod";

const digits = z.string().regex(/^\d{5,32}$/);
const webhookAccountId = z.string().regex(/^\d{1,32}$/);
const providerId = z.string().min(3).max(256);
const statusSchema = z
  .object({
    id: providerId,
    status: z.enum(["sent", "delivered", "read", "failed"]),
    timestamp: z.string().regex(/^\d{1,12}$/),
    errors: z
      .array(z.object({ code: z.number().int() }).passthrough())
      .max(5)
      .optional(),
  })
  .passthrough();
const messageSchema = z
  .object({
    from: z.string().regex(/^\d{6,20}$/),
    id: providerId,
    timestamp: z.string().regex(/^\d{1,12}$/),
    type: z.string().min(1).max(40),
    text: z.object({ body: z.string().trim().min(1).max(2000) }).optional(),
  })
  .passthrough();
const valueSchema = z
  .object({
    messaging_product: z.literal("whatsapp"),
    metadata: z.object({
      display_phone_number: z.string().max(32).optional(),
      phone_number_id: digits,
    }),
    contacts: z
      .array(
        z.object({
          wa_id: z.string().regex(/^\d{6,20}$/),
          profile: z.object({ name: z.string().trim().max(160) }).optional(),
        }),
      )
      .max(20)
      .optional(),
    messages: z.array(messageSchema).max(20).optional(),
    statuses: z.array(statusSchema).max(50).optional(),
  })
  .passthrough();
export const whatsappWebhookSchema = z
  .object({
    object: z.literal("whatsapp_business_account"),
    entry: z
      .array(
        z
          .object({
            // Meta's dashboard signs synthetic webhook tests with WABA ID "0".
            // Trusted tenant resolution still requires the configured real ID.
            id: webhookAccountId,
            changes: z
              .array(
                z.object({ field: z.literal("messages"), value: valueSchema }),
              )
              .max(20),
          })
          .passthrough(),
      )
      .max(20),
  })
  .strict();

export type WhatsAppWebhook = z.infer<typeof whatsappWebhookSchema>;

export type WhatsAppWebhookEvent =
  | Readonly<{
      kind: "message";
      phoneNumberId: string;
      businessAccountId: string;
      waId: string;
      profileName: string | null;
      providerMessageId: string;
      timestamp: Date;
      messageType: string;
      text: string | null;
    }>
  | Readonly<{
      kind: "status";
      phoneNumberId: string;
      providerMessageId: string;
      status: "sent" | "delivered" | "read" | "failed";
      errorCode: string | null;
    }>;

export function flattenWhatsAppWebhook(
  webhook: WhatsAppWebhook,
): WhatsAppWebhookEvent[] {
  const events: WhatsAppWebhookEvent[] = [];
  for (const entry of webhook.entry)
    for (const change of entry.changes) {
      const value = change.value;
      const names = new Map(
        (value.contacts ?? []).map((contact) => [
          contact.wa_id,
          contact.profile?.name ?? null,
        ]),
      );
      for (const message of value.messages ?? [])
        events.push({
          kind: "message",
          phoneNumberId: value.metadata.phone_number_id,
          businessAccountId: entry.id,
          waId: message.from,
          profileName: names.get(message.from) ?? null,
          providerMessageId: message.id,
          timestamp: new Date(Number(message.timestamp) * 1000),
          messageType: message.type,
          text: message.type === "text" ? (message.text?.body ?? null) : null,
        });
      for (const status of value.statuses ?? [])
        events.push({
          kind: "status",
          phoneNumberId: value.metadata.phone_number_id,
          providerMessageId: status.id,
          status: status.status,
          errorCode: status.errors?.[0]?.code
            ? `meta_${status.errors[0].code}`
            : null,
        });
    }
  return events;
}
