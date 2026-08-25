import "server-only";

import { z } from "zod";

const tokenSchema = z.object({ access_token: z.string().min(20).max(8192) });
const debugTokenSchema = z.object({
  data: z.object({
    app_id: z.string(),
    is_valid: z.literal(true),
    scopes: z.array(z.string()).max(100),
    expires_at: z.number().int().nonnegative().optional(),
  }),
});
const wabaSchema = z.object({
  id: z.string().regex(/^\d{5,32}$/),
  name: z.string().max(160).optional(),
});
const phoneSchema = z.object({
  id: z.string().regex(/^\d{5,32}$/),
  display_phone_number: z.string().max(32).optional(),
  verified_name: z.string().max(160).optional(),
  quality_rating: z.enum(["GREEN", "YELLOW", "RED", "UNKNOWN"]).optional(),
});
const phoneListSchema = z.object({ data: z.array(phoneSchema).max(100) });
const requiredScopes = [
  "whatsapp_business_management",
  "whatsapp_business_messaging",
] as const;

export type EmbeddedSignupResult = Readonly<{
  accessToken: string;
  waba: z.infer<typeof wabaSchema>;
  phone: z.infer<typeof phoneSchema>;
}>;

export class MetaEmbeddedSignupClient {
  constructor(
    private readonly config: Readonly<{
      graphApiVersion: string;
      appId: string;
      appSecret: string;
      timeoutMs: number;
    }>,
    private readonly request: typeof fetch = fetch,
  ) {}

  private async fetchJson(url: string, init: RequestInit, timeoutCode: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.request(url, {
        ...init,
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          response.status === 401 || response.status === 403
            ? "meta_authentication"
            : timeoutCode,
        );
      return (await response.json()) as unknown;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("meta_"))
        throw error;
      throw new Error("meta_unavailable");
    } finally {
      clearTimeout(timeout);
    }
  }

  async complete(
    input: Readonly<{
      code: string;
      wabaId: string;
      phoneNumberId: string;
      redirectUri: string;
    }>,
  ): Promise<EmbeddedSignupResult> {
    const tokenUrl = new URL(
      `https://graph.facebook.com/${this.config.graphApiVersion}/oauth/access_token`,
    );
    tokenUrl.searchParams.set("client_id", this.config.appId);
    tokenUrl.searchParams.set("client_secret", this.config.appSecret);
    tokenUrl.searchParams.set("code", input.code);
    tokenUrl.searchParams.set("redirect_uri", input.redirectUri);
    const token = tokenSchema.parse(
      await this.fetchJson(
        tokenUrl.toString(),
        { method: "GET" },
        "meta_token_exchange_failed",
      ),
    );
    const headers = { Authorization: `Bearer ${token.access_token}` };
    const debugUrl = new URL(
      `https://graph.facebook.com/${this.config.graphApiVersion}/debug_token`,
    );
    debugUrl.searchParams.set("input_token", token.access_token);
    const [debugValue, wabaValue, phonesValue] = await Promise.all([
      this.fetchJson(
        debugUrl.toString(),
        {
          headers: {
            Authorization: `Bearer ${this.config.appId}|${this.config.appSecret}`,
          },
        },
        "meta_token_validation_failed",
      ),
      this.fetchJson(
        `https://graph.facebook.com/${this.config.graphApiVersion}/${input.wabaId}?fields=id,name`,
        { headers },
        "meta_asset_lookup_failed",
      ),
      this.fetchJson(
        `https://graph.facebook.com/${this.config.graphApiVersion}/${input.wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&limit=100`,
        { headers },
        "meta_asset_lookup_failed",
      ),
    ]);
    const debug = debugTokenSchema.parse(debugValue).data;
    if (
      debug.app_id !== this.config.appId ||
      requiredScopes.some((scope) => !debug.scopes.includes(scope))
    )
      throw new Error("meta_permission_mismatch");
    const waba = wabaSchema.parse(wabaValue);
    const phones = phoneListSchema.parse(phonesValue).data;
    const phone = phones.find(
      (candidate) => candidate.id === input.phoneNumberId,
    );
    if (waba.id !== input.wabaId || !phone)
      throw new Error("meta_asset_mismatch");
    const subscribed = z
      .object({ success: z.literal(true) })
      .safeParse(
        await this.fetchJson(
          `https://graph.facebook.com/${this.config.graphApiVersion}/${waba.id}/subscribed_apps`,
          { method: "POST", headers },
          "meta_subscription_failed",
        ),
      );
    if (!subscribed.success) throw new Error("meta_subscription_failed");
    return { accessToken: token.access_token, waba, phone };
  }

  async unsubscribe(wabaId: string, accessToken: string) {
    const response = await this.fetchJson(
      `https://graph.facebook.com/${this.config.graphApiVersion}/${wabaId}/subscribed_apps`,
      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
      "meta_unsubscribe_failed",
    );
    return z.object({ success: z.literal(true) }).safeParse(response).success;
  }
}
