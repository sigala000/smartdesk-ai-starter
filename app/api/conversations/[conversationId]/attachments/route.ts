import {
  apiAttachmentError,
  apiSuccess,
  apiValidation,
} from "@/lib/http/api-response";
import { publicConversationRequestContext } from "@/lib/http/public-conversation-request";
import { conversationIdSchema } from "@/lib/schemas/public-conversation-api";
import { createPublicAttachmentRuntime } from "@/lib/services/attachment-runtime";

type Context = { params: Promise<{ conversationId: string }> };

export async function GET(request: Request, context: Context) {
  const id = conversationIdSchema.safeParse(
    (await context.params).conversationId,
  );
  if (!id.success) return apiValidation(id.error);
  const requestContext = await publicConversationRequestContext(
    request,
    id.data,
  );
  const result = await createPublicAttachmentRuntime().listConversation({
    kind: "customer",
    conversationId: id.data,
    ...requestContext,
  });
  return result.ok
    ? apiSuccess({ attachments: result.value })
    : apiAttachmentError(result.error);
}
