import {
  apiAccessError,
  apiAttachmentError,
  apiSuccess,
  apiValidation,
} from "@/lib/http/api-response";
import { publicConversationRequestContext } from "@/lib/http/public-conversation-request";
import { attachmentIdSchema } from "@/lib/schemas/attachment-api";
import {
  createEmployeeAttachmentRuntime,
  createPublicAttachmentRuntime,
} from "@/lib/services/attachment-runtime";

type Context = { params: Promise<{ attachmentId: string }> };

export async function POST(request: Request, context: Context) {
  const id = attachmentIdSchema.safeParse((await context.params).attachmentId);
  if (!id.success) return apiValidation(id.error);
  const conversationId = new URL(request.url).searchParams.get(
    "conversationId",
  );
  if (conversationId) {
    const access = await publicConversationRequestContext(
      request,
      conversationId,
    );
    const result = await createPublicAttachmentRuntime().complete(
      { kind: "customer", conversationId, ...access },
      id.data,
    );
    return result.ok
      ? apiSuccess({ attachment: result.value })
      : apiAttachmentError(result.error);
  }
  const runtime = await createEmployeeAttachmentRuntime();
  if (!runtime.access.ok)
    return apiAccessError(
      runtime.access,
      "You are not authorized to complete this upload.",
    );
  const result = await runtime.service.complete(
    { kind: "employee", context: runtime.access.context },
    id.data,
  );
  return result.ok
    ? apiSuccess({ attachment: result.value })
    : apiAttachmentError(result.error);
}
