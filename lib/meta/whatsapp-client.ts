import "server-only";

import { z } from "zod";

const responseSchema = z.object({
  messages: z
    .array(z.object({ id: z.string().min(3).max(256) }))
    .min(1)
    .max(1),
});

export type MetaSendResult =
  | Readonly<{ ok: true; providerMessageId: string }>
  | Readonly<{
      ok: false;
      code:
        | "meta_timeout"
        | "meta_authentication"
        | "meta_billing_required"
        | "meta_rate_limited"
        | "meta_server_error"
        | "meta_rejected";
    }>;

export class MetaWhatsAppClient {
  constructor(
    private readonly config: Readonly<{
      graphApiVersion: string;
      accessToken: string;
      phoneNumberId: string;
      testRecipient?: string;
      allowedRecipients?: readonly string[];
      timeoutMs: number;
    }>,
    private readonly request: typeof fetch = fetch,
  ) {}

  async sendText(recipient: string, text: string): Promise<MetaSendResult> {
    const allowed =
      this.config.allowedRecipients ??
      (this.config.testRecipient ? [this.config.testRecipient] : null);
    if (allowed && !allowed.includes(recipient))
      return { ok: false, code: "meta_rejected" };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.request(
        `https://graph.facebook.com/${this.config.graphApiVersion}/${this.config.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: recipient,
            type: "text",
            text: { preview_url: false, body: text.slice(0, 4096) },
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        if (response.status === 402)
          return { ok: false, code: "meta_billing_required" };
        if (response.status === 401 || response.status === 403)
          return { ok: false, code: "meta_authentication" };
        if (response.status === 429)
          return { ok: false, code: "meta_rate_limited" };
        if (response.status >= 500)
          return { ok: false, code: "meta_server_error" };
        return { ok: false, code: "meta_rejected" };
      }
      const parsed = responseSchema.safeParse(await response.json());
      return parsed.success
        ? { ok: true, providerMessageId: parsed.data.messages[0].id }
        : { ok: false, code: "meta_rejected" };
    } catch {
      return { ok: false, code: "meta_timeout" };
    } finally {
      clearTimeout(timeout);
    }
  }
}
