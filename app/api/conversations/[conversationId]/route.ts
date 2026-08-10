import {
  apiPublicConversationError,
  apiSuccess,
  apiValidation,
} from "@/lib/http/api-response";
import { publicConversationRequestContext } from "@/lib/http/public-conversation-request";
import { conversationIdSchema } from "@/lib/schemas/public-conversation-api";
import { createPublicConversationRuntime } from "@/lib/services/public-conversation-runtime";

type Context = { params: Promise<{ conversationId: string }> };

export async function GET(request: Request, context: Context) {
  const id = conversationIdSchema.safeParse(
    (await context.params).conversationId,
  );
  if (!id.success) return apiValidation(id.error);
  const access = await publicConversationRequestContext(request, id.data);
  const result = await createPublicConversationRuntime().view(
    id.data,
    access.tokenDigest,
  );
  return result.ok
    ? apiSuccess({ conversation: result.value })
    : apiPublicConversationError(result.error);
}
