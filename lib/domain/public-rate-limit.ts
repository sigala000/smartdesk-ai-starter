import { createHmac } from "node:crypto";

import { EnvironmentValidationError } from "@/lib/config/env-schema";
import { serverEnvironment } from "@/lib/config/env-server";

export function publicSubjectDigest(value: string): string {
  const secret = serverEnvironment.PUBLIC_RATE_LIMIT_SECRET;
  if (!secret)
    throw new EnvironmentValidationError(["PUBLIC_RATE_LIMIT_SECRET"]);
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function requestClientAddress(request: Request): string {
  const trustedHeader = serverEnvironment.PUBLIC_CLIENT_IP_HEADER;
  if (!trustedHeader && process.env.NODE_ENV === "production")
    throw new EnvironmentValidationError(["PUBLIC_CLIENT_IP_HEADER"]);
  return trustedHeader
    ? (request.headers.get(trustedHeader) ?? "unknown")
    : "unknown";
}
