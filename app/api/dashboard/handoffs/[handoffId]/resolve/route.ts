import { z } from "zod";
import {
  apiAccessError,
  apiError,
  apiHandoffError,
  apiSuccess,
  apiValidation,
  parseBoundedJson,
} from "@/lib/http/api-response";
import { handoffResolveSchema } from "@/lib/schemas/handoff-api";
import { createHandoffRuntime } from "@/lib/services/handoff-runtime";
type C = { params: Promise<{ handoffId: string }> };
export async function POST(request: Request, c: C) {
  const id = z.uuid().safeParse((await c.params).handoffId);
  if (!id.success) return apiValidation(id.error);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return apiError("validation_error", "JSON is required.", 400);
  const body = await parseBoundedJson(request);
  if (!body.ok) return body.response;
  const input = handoffResolveSchema.safeParse(body.value);
  if (!input.success) return apiValidation(input.error);
  const runtime = await createHandoffRuntime();
  if (!runtime.access.ok)
    return apiAccessError(
      runtime.access,
      "You are not authorized to resolve handoffs.",
    );
  const result = await runtime.service.resolve(
    runtime.access.context,
    id.data,
    input.data,
  );
  return result.ok
    ? apiSuccess({ handoff: result.value })
    : apiHandoffError(result.error);
}
