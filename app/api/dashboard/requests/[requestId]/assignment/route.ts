import {
  apiAccessError,
  apiError,
  apiServiceError,
  apiSuccess,
  apiValidation,
  parseBoundedJson,
} from "@/lib/http/api-response";
import { assignmentSchema, requestIdSchema } from "@/lib/schemas/request-api";
import { createRequestRuntime } from "@/lib/services/request-runtime";

type RouteContext = { params: Promise<{ requestId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const id = requestIdSchema.safeParse((await context.params).requestId);
  if (!id.success) return apiValidation(id.error);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return apiError("validation_error", "JSON is required.", 400);
  const body = await parseBoundedJson(request);
  if (!body.ok) return body.response;
  const input = assignmentSchema.safeParse(body.value);
  if (!input.success) return apiValidation(input.error);
  const runtime = await createRequestRuntime();
  if (!runtime.access.ok)
    return apiAccessError(
      runtime.access,
      "You are not authorized to assign requests.",
    );
  const result = await runtime.service.assign(
    runtime.access.context,
    id.data,
    input.data,
  );
  return result.ok
    ? apiSuccess({ request: result.value })
    : apiServiceError(result.error);
}
