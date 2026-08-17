import { apiError, apiSuccess } from "@/lib/http/api-response";
import {
  statusReferenceSchema,
  statusTokenSchema,
} from "@/lib/schemas/request-status-api";
import { createRequestStatusRuntime } from "@/lib/services/request-status-runtime";
type C = { params: Promise<{ referenceNumber: string }> };
export async function GET(request: Request, context: C) {
  let decodedReference = "";
  try {
    decodedReference = decodeURIComponent(
      (await context.params).referenceNumber,
    );
  } catch {
    return apiError(
      "verification_failed",
      "The verification details are invalid or expired.",
      401,
    );
  }
  const reference = statusReferenceSchema.safeParse(decodedReference);
  const authorization = request.headers.get("authorization");
  const token = statusTokenSchema.safeParse(
    authorization?.startsWith("Bearer ") ? authorization.slice(7) : "",
  );
  if (!reference.success || !token.success)
    return apiError(
      "verification_failed",
      "The verification details are invalid or expired.",
      401,
    );
  try {
    const result = await createRequestStatusRuntime().status(
      reference.data,
      token.data,
    );
    return result.ok
      ? apiSuccess({ request: result.value })
      : apiError(result.code, result.message, 401);
  } catch {
    return apiError(
      "service_unavailable",
      "Status verification is temporarily unavailable.",
      503,
    );
  }
}
