import {
  apiError,
  apiPublicConversationError,
  apiSuccess,
  apiValidation,
  parseBoundedJson,
} from "@/lib/http/api-response";
import { publicConversationRequestContext } from "@/lib/http/public-conversation-request";
import {
  conversationIdSchema,
  editDraftSchema,
} from "@/lib/schemas/public-conversation-api";
import { createPublicConversationRuntime } from "@/lib/services/public-conversation-runtime";

type Context = { params: Promise<{ conversationId: string }> };

export async function PATCH(request: Request, context: Context) {
  const id = conversationIdSchema.safeParse(
    (await context.params).conversationId,
  );
  if (!id.success) return apiValidation(id.error);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return apiError("validation_error", "JSON is required.", 400);
  const body = await parseBoundedJson(request);
  if (!body.ok) return body.response;
  const input = editDraftSchema.safeParse(body.value);
  if (!input.success) return apiValidation(input.error);
  const access = await publicConversationRequestContext(request, id.data);
  const result = await createPublicConversationRuntime().edit(
    id.data,
    access.tokenDigest,
    input.data,
  );
  return result.ok
    ? apiSuccess({ conversation: result.value })
    : apiPublicConversationError(result.error);
}
