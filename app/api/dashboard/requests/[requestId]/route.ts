import {
  apiAccessError,
  apiServiceError,
  apiSuccess,
  apiValidation,
} from "@/lib/http/api-response";
import { requestIdSchema } from "@/lib/schemas/request-api";
import { createRequestRuntime } from "@/lib/services/request-runtime";

type RouteContext = { params: Promise<{ requestId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const id = requestIdSchema.safeParse((await context.params).requestId);
  if (!id.success) return apiValidation(id.error);
  const runtime = await createRequestRuntime();
  if (!runtime.access.ok)
    return apiAccessError(
      runtime.access,
      "You are not authorized to view this request.",
    );
  const result = await runtime.service.detail(runtime.access.context, id.data);
  return result.ok ? apiSuccess(result.value) : apiServiceError(result.error);
}
