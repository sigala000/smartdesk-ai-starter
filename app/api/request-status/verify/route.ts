import {
  apiError,
  apiSuccess,
  apiValidation,
  parseBoundedJson,
} from "@/lib/http/api-response";
import { statusVerifySchema } from "@/lib/schemas/request-status-api";
import { requestClientAddress } from "@/lib/domain/public-rate-limit";
import { createRequestStatusRuntime } from "@/lib/services/request-status-runtime";
import { publicConversationRequestContext } from "@/lib/http/public-conversation-request";
import { SupabasePublicConversationRepository } from "@/lib/repositories/supabase-public-conversation-repository";
import { createAdminClient } from "@/lib/supabase/admin";
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return apiError("validation_error", "JSON is required.", 400);
  const body = await parseBoundedJson(request, 2048);
  if (!body.ok) return body.response;
  const input = statusVerifySchema.safeParse(body.value);
  if (!input.success) return apiValidation(input.error);
  try {
    let trustedConversation:
      { organizationId: string; conversationId: string } | undefined;
    if (input.data.conversationId) {
      const access = await publicConversationRequestContext(
        request,
        input.data.conversationId,
      );
      const context = await new SupabasePublicConversationRepository(
        createAdminClient(),
      ).agentContext(input.data.conversationId, access.tokenDigest);
      if (!context.ok)
        return apiError(
          "verification_failed",
          "The verification details are invalid or expired.",
          401,
        );
      trustedConversation = {
        organizationId: context.value.organizationId,
        conversationId: context.value.conversationId,
      };
    }
    const result = await createRequestStatusRuntime().verify({
      challengeId: input.data.challengeId,
      code: input.data.code,
      ip: requestClientAddress(request),
      ...trustedConversation,
    });
    if (!result.ok) {
      const status = result.code === "rate_limited" ? 429 : 401;
      const response = apiError(result.code, result.message, status);
      if (status === 429) response.headers.set("Retry-After", "60");
      return response;
    }
    return apiSuccess(result.value);
  } catch {
    return apiError(
      "service_unavailable",
      "Status verification is temporarily unavailable.",
      503,
    );
  }
}
