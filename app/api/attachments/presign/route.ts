import {
  apiAccessError,
  apiAttachmentError,
  apiSuccess,
  apiValidation,
  parseBoundedJson,
} from "@/lib/http/api-response";
import { publicConversationRequestContext } from "@/lib/http/public-conversation-request";
import { attachmentPresignSchema } from "@/lib/schemas/attachment-api";
import {
  createEmployeeAttachmentRuntime,
  createPublicAttachmentRuntime,
} from "@/lib/services/attachment-runtime";

export async function POST(request: Request) {
  const body = await parseBoundedJson(request);
  if (!body.ok) return body.response;
  const parsed = attachmentPresignSchema.safeParse(body.value);
  if (!parsed.success) return apiValidation(parsed.error);
  if (parsed.data.target.kind === "conversation") {
    const context = await publicConversationRequestContext(
      request,
      parsed.data.target.conversationId,
    );
    const result = await createPublicAttachmentRuntime().initiate(
      {
        kind: "customer",
        conversationId: parsed.data.target.conversationId,
        ...context,
      },
      parsed.data,
    );
    return result.ok
      ? apiSuccess(result.value, 201)
      : apiAttachmentError(result.error);
  }
  const runtime = await createEmployeeAttachmentRuntime();
  if (!runtime.access.ok)
    return apiAccessError(
      runtime.access,
      "You are not authorized to upload an attachment.",
    );
  const result = await runtime.service.initiate(
    { kind: "employee", context: runtime.access.context },
    parsed.data,
  );
  return result.ok
    ? apiSuccess(result.value, 201)
    : apiAttachmentError(result.error);
}
