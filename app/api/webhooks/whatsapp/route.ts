import { randomUUID } from "node:crypto";

import {
  verifyWebhookToken,
  verifyWhatsAppSignature,
} from "@/lib/meta/whatsapp-signature";
import {
  flattenWhatsAppWebhook,
  whatsappWebhookSchema,
} from "@/lib/schemas/whatsapp-webhook";
import { createWhatsAppRuntime } from "@/lib/services/whatsapp-runtime";

export const runtime = "nodejs";

const plain = (body: string, status: number) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

type WhatsAppRuntime = NonNullable<ReturnType<typeof createWhatsAppRuntime>>;

export function createWhatsAppWebhookHandlers(
  runtimeFactory: () => WhatsAppRuntime | null = createWhatsAppRuntime,
) {
  async function GET(request: Request) {
    const runtime = runtimeFactory();
    if (!runtime) return plain("Unavailable", 503);
    const query = new URL(request.url).searchParams;
    const mode = query.get("hub.mode");
    const token = query.get("hub.verify_token");
    const challenge = query.get("hub.challenge");
    if (
      mode !== "subscribe" ||
      !token ||
      token.length > 512 ||
      !challenge ||
      challenge.length > 512
    )
      return plain("Invalid verification request", 400);
    return verifyWebhookToken(token, runtime.config.verifyToken)
      ? plain(challenge, 200)
      : plain("Verification denied", 403);
  }

  async function POST(request: Request) {
    const traceId = randomUUID();
    const runtime = runtimeFactory();
    if (!runtime) return plain("Unavailable", 503);
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > runtime.config.maxWebhookBytes)
      return plain("Payload too large", 413);
    const body = new Uint8Array(await request.arrayBuffer());
    if (body.byteLength > runtime.config.maxWebhookBytes)
      return plain("Payload too large", 413);
    if (
      !verifyWhatsAppSignature(
        body,
        request.headers.get("x-hub-signature-256"),
        runtime.config.appSecret,
      )
    )
      return plain("Invalid signature", 401);
    let decoded: unknown;
    try {
      decoded = JSON.parse(new TextDecoder().decode(body)) as unknown;
    } catch {
      return plain("Invalid payload", 400);
    }
    const parsed = whatsappWebhookSchema.safeParse(decoded);
    if (!parsed.success) return plain("Invalid payload", 400);
    const events = flattenWhatsAppWebhook(parsed.data);
    for (const event of events) {
      const result = await runtime.service.handle(event, randomUUID());
      if (!result.accepted) {
        console.error("whatsapp_webhook_processing_failed", { traceId });
        return plain("Retry", 500);
      }
    }
    console.info("whatsapp_webhook_processed", {
      traceId,
      eventCount: events.length,
    });
    return plain("EVENT_RECEIVED", 200);
  }

  return { GET, POST };
}

const handlers = createWhatsAppWebhookHandlers();
export const GET = handlers.GET;
export const POST = handlers.POST;
