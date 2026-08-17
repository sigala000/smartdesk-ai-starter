import { z } from "zod";
import {
  apiAccessError,
  apiHandoffError,
  apiSuccess,
  apiValidation,
} from "@/lib/http/api-response";
import { createHandoffRuntime } from "@/lib/services/handoff-runtime";
type C = { params: Promise<{ handoffId: string }> };
export async function POST(_request: Request, c: C) {
  const id = z.uuid().safeParse((await c.params).handoffId);
  if (!id.success) return apiValidation(id.error);
  const runtime = await createHandoffRuntime();
  if (!runtime.access.ok)
    return apiAccessError(
      runtime.access,
      "You are not authorized to join handoffs.",
    );
  const result = await runtime.service.join(runtime.access.context, id.data);
  return result.ok
    ? apiSuccess({ handoff: result.value })
    : apiHandoffError(result.error);
}
