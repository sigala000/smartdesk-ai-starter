import {
  apiAccessError,
  apiServiceError,
  apiSuccess,
  apiValidation,
} from "@/lib/http/api-response";
import { requestListQuerySchema } from "@/lib/schemas/request-api";
import { createRequestRuntime } from "@/lib/services/request-runtime";

export async function GET(request: Request) {
  const query = requestListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) return apiValidation(query.error);
  const runtime = await createRequestRuntime();
  if (!runtime.access.ok) {
    return apiAccessError(
      runtime.access,
      "You are not authorized to view requests.",
    );
  }
  const result = await runtime.service.list(runtime.access.context, query.data);
  return result.ok ? apiSuccess(result.value) : apiServiceError(result.error);
}
