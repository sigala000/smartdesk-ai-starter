import {
  apiAccessError,
  apiHandoffError,
  apiSuccess,
  apiValidation,
} from "@/lib/http/api-response";
import { handoffListQuerySchema } from "@/lib/schemas/handoff-api";
import { createHandoffRuntime } from "@/lib/services/handoff-runtime";
export async function GET(request: Request) {
  const query = handoffListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) return apiValidation(query.error);
  const runtime = await createHandoffRuntime();
  if (!runtime.access.ok)
    return apiAccessError(
      runtime.access,
      "You are not authorized to view handoffs.",
    );
  const result = await runtime.service.list(runtime.access.context, query.data);
  return result.ok
    ? apiSuccess({ handoffs: result.value })
    : apiHandoffError(result.error);
}
