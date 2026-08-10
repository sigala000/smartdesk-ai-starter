import "server-only";

import { cookies } from "next/headers";

import {
  publicSubjectDigest,
  requestClientAddress,
} from "@/lib/domain/public-rate-limit";
import {
  conversationCookieName,
  digestSecret,
} from "@/lib/http/public-conversation-cookie";

export async function publicConversationRequestContext(
  request: Request,
  conversationId: string,
) {
  const token = (await cookies()).get(
    conversationCookieName(conversationId),
  )?.value;
  return {
    tokenDigest: token ? digestSecret(token) : "",
    subjectDigest: publicSubjectDigest(
      `${requestClientAddress(request)}:${conversationId}`,
    ),
  };
}
