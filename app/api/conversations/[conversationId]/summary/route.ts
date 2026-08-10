import {
  apiPublicConversationError,
  apiSuccess,
  apiValidation,
} from "@/lib/http/api-response";
import {
  createOpaqueSecret,
  digestSecret,
} from "@/lib/http/public-conversation-cookie";
import { publicConversationRequestContext } from "@/lib/http/public-conversation-request";
import { conversationIdSchema } from "@/lib/schemas/public-conversation-api";
import { createPublicConversationRuntime } from "@/lib/services/public-conversation-runtime";

type Context = { params: Promise<{ conversationId: string }> };

export async function POST(request: Request, context: Context) {
  const id = conversationIdSchema.safeParse(
    (await context.params).conversationId,
  );
  if (!id.success) return apiValidation(id.error);
  const nonce = createOpaqueSecret();
  const access = await publicConversationRequestContext(request, id.data);
  const result = await createPublicConversationRuntime().summary(
    id.data,
    access.tokenDigest,
    digestSecret(nonce),
    access.subjectDigest,
  );
  return result.ok
    ? apiSuccess({
        conversation: result.value.conversation,
        confirmationNonce: nonce,
        expiresAt: result.value.expiresAt,
      })
    : apiPublicConversationError(result.error);
}
