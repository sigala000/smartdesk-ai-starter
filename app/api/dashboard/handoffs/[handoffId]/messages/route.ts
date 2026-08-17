import { z } from "zod";
import {
  apiAccessError,
  apiError,
  apiHandoffError,
  apiSuccess,
  apiValidation,
  parseBoundedJson,
} from "@/lib/http/api-response";
import { handoffMessageSchema } from "@/lib/schemas/handoff-api";
import { createHandoffRuntime } from "@/lib/services/handoff-runtime";
type C = { params: Promise<{ handoffId: string }> };
export async function POST(request: Request, c: C) {
  const id = z.uuid().safeParse((await c.params).handoffId);
  if (!id.success) return apiValidation(id.error);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return apiError("validation_error", "JSON is required.", 400);
  const body = await parseBoundedJson(request);
  if (!body.ok) return body.response;
  const input = handoffMessageSchema.safeParse(body.value);
  if (!input.success) return apiValidation(input.error);
  const runtime = await createHandoffRuntime();
  if (!runtime.access.ok)
    return apiAccessError(runtime.access, "You are not authorized to reply.");
  const result = await runtime.service.message(
    runtime.access.context,
    id.data,
    input.data,
  );
  return result.ok
    ? apiSuccess({ message: result.value }, 201)
    : apiHandoffError(result.error);
}
