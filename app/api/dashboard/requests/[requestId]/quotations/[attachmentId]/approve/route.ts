import {
  apiAccessError,
  apiServiceError,
  apiSuccess,
  apiValidation,
} from "@/lib/http/api-response";
import { requestIdSchema } from "@/lib/schemas/request-api";
import { createRequestRuntime } from "@/lib/services/request-runtime";

type Context = {
  params: Promise<{ requestId: string; attachmentId: string }>;
};

export async function POST(_request: Request, context: Context) {
  const params = await context.params;
  const requestId = requestIdSchema.safeParse(params.requestId);
  const attachmentId = requestIdSchema.safeParse(params.attachmentId);
  if (!requestId.success) return apiValidation(requestId.error);
  if (!attachmentId.success) return apiValidation(attachmentId.error);
  const runtime = await createRequestRuntime();
  if (!runtime.access.ok)
    return apiAccessError(
      runtime.access,
      "Quotation approval is not permitted.",
    );
  const result = await runtime.service.approveQuotation(
    runtime.access.context,
    requestId.data,
    attachmentId.data,
  );
  return result.ok
    ? apiSuccess({ attachment: result.value })
    : apiServiceError(result.error);
}
