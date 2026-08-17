import {
  apiError,
  apiPublicConversationError,
  apiSuccess,
  apiValidation,
  parseBoundedJson,
} from "@/lib/http/api-response";
import { classifyEscalation } from "@/lib/domain/handoffs";
import { publicConversationRequestContext } from "@/lib/http/public-conversation-request";
import { requestHandoffSchema } from "@/lib/schemas/handoff-api";
import { conversationIdSchema } from "@/lib/schemas/public-conversation-api";
import { createPublicConversationRuntime } from "@/lib/services/public-conversation-runtime";

type Context = { params: Promise<{ conversationId: string }> };

export async function POST(request: Request, context: Context) {
  const id = conversationIdSchema.safeParse(
    (await context.params).conversationId,
  );
  if (!id.success) return apiValidation(id.error);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return apiError("validation_error", "JSON is required.", 400);
  const body = await parseBoundedJson(request);
  if (!body.ok) return body.response;
  const input = requestHandoffSchema.safeParse(body.value);
  if (!input.success) return apiValidation(input.error);
  const access = await publicConversationRequestContext(request, id.data);
  const decision = classifyEscalation(input.data.reason) ?? {
    reasonCode: "explicit_human_request" as const,
    priority: "normal" as const,
    reason: "Customer explicitly requested human support.",
  };
  const result = await createPublicConversationRuntime().requestHandoff(
    id.data,
    access.tokenDigest,
    input.data.clientRequestId,
    decision,
  );
  return result.ok
    ? apiSuccess({ handoff: result.value }, 201)
    : apiPublicConversationError(result.error);
}
