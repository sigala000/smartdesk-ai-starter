import {
  publicSubjectDigest,
  requestClientAddress,
} from "@/lib/domain/public-rate-limit";
import {
  apiPublicConversationError,
  apiSuccess,
  apiValidation,
  parseBoundedJson,
} from "@/lib/http/api-response";
import {
  conversationCookieName,
  conversationCookieOptions,
  createOpaqueSecret,
  digestSecret,
} from "@/lib/http/public-conversation-cookie";
import { createConversationSchema } from "@/lib/schemas/public-conversation-api";
import { createPublicConversationRuntime } from "@/lib/services/public-conversation-runtime";

export async function POST(request: Request) {
  const body = await parseBoundedJson(request, 4096);
  if (!body.ok) return body.response;
  const input = createConversationSchema.safeParse(body.value);
  if (!input.success) return apiValidation(input.error);
  const token = createOpaqueSecret();
  const result = await createPublicConversationRuntime().create(
    input.data.organizationSlug,
    digestSecret(token),
    publicSubjectDigest(requestClientAddress(request)),
  );
  if (!result.ok) return apiPublicConversationError(result.error);
  const response = apiSuccess(
    {
      conversation: {
        id: result.value.id,
        organizationName: result.value.organizationName,
        state: "open",
        createdAt: result.value.createdAt,
      },
    },
    201,
  );
  response.cookies.set(
    conversationCookieName(result.value.id),
    token,
    conversationCookieOptions(),
  );
  return response;
}
