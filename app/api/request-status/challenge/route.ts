import {
  apiError,
  apiSuccess,
  apiValidation,
  parseBoundedJson,
} from "@/lib/http/api-response";
import { statusChallengeSchema } from "@/lib/schemas/request-status-api";
import { requestClientAddress } from "@/lib/domain/public-rate-limit";
import { createRequestStatusRuntime } from "@/lib/services/request-status-runtime";
import { after } from "next/server";
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return apiError("validation_error", "JSON is required.", 400);
  const body = await parseBoundedJson(request, 4096);
  if (!body.ok) return body.response;
  const input = statusChallengeSchema.safeParse(body.value);
  if (!input.success) return apiValidation(input.error);
  try {
    const result = await createRequestStatusRuntime().challenge({
      ...input.data,
      ip: requestClientAddress(request),
    });
    if (!result.ok) {
      const response = apiError(result.code, result.message, 429);
      response.headers.set("Retry-After", "60");
      return response;
    }
    if (result.deliver) after(result.deliver);
    return apiSuccess(result.value, 202);
  } catch {
    return apiError(
      "service_unavailable",
      "Status verification is temporarily unavailable.",
      503,
    );
  }
}
