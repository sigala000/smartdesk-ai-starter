import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import type { ZodError } from "zod";

import type { RequestServiceError } from "@/lib/services/request-service";
import type { PublicConversationError } from "@/lib/services/public-conversation-service";
import type { AccessResolution } from "@/lib/auth/access-records";
import type { AttachmentError } from "@/lib/services/attachment-service";
import type { HandoffServiceError } from "@/lib/services/handoff-service";

const privateHeaders = { "Cache-Control": "private, no-store" };

function responseTraceId() {
  return randomUUID();
}

export function apiSuccess<T>(body: T, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { ...privateHeaders, "X-Request-Id": responseTraceId() },
  });
}

export function apiValidation(error: ZodError) {
  return apiError(
    "validation_error",
    "The submitted data is invalid.",
    400,
    error.flatten().fieldErrors,
  );
}

export function apiError(
  code: string,
  message: string,
  status: number,
  fieldErrors?: Record<string, string[] | undefined>,
) {
  const traceId = responseTraceId();
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(fieldErrors ? { fieldErrors } : {}),
        traceId,
      },
    },
    {
      status,
      headers: { ...privateHeaders, "X-Request-Id": traceId },
    },
  );
}

export function apiServiceError(error: RequestServiceError) {
  const status = {
    validation_error: 400,
    forbidden: 403,
    not_found: 404,
    conflict: 409,
    internal_error: 500,
  }[error.code];
  return apiError(error.code, error.message, status);
}

export function apiHandoffError(error: HandoffServiceError) {
  const status = {
    validation_error: 400,
    forbidden: 403,
    not_found: 404,
    conflict: 409,
    internal_error: 500,
  }[error.code];
  return apiError(error.code, error.message, status);
}

export function apiUnauthenticated() {
  return apiError("unauthenticated", "Authentication is required.", 401);
}

export function apiPublicConversationError(error: PublicConversationError) {
  const status = {
    validation_error: 400,
    not_found: 404,
    conflict: 409,
    rate_limited: 429,
    internal_error: 500,
  }[error.code];
  const response = apiError(error.code, error.message, status);
  if (status === 429) response.headers.set("Retry-After", "60");
  return response;
}

export function apiAccessError(
  access: Exclude<AccessResolution, { ok: true }>,
  forbiddenMessage: string,
) {
  if (!access.authenticated) return apiUnauthenticated();
  if (access.code === "internal_error") {
    return apiError(
      "internal_error",
      "The request could not be completed.",
      500,
    );
  }
  return apiError("forbidden", forbiddenMessage, 403);
}

export function apiAttachmentError(error: AttachmentError) {
  const status: Record<AttachmentError["code"], number> = {
    forbidden: 403,
    not_found: 404,
    conflict: 409,
    rate_limited: 429,
    invalid_file_type: 400,
    invalid_file_size: 400,
    invalid_file_content: 400,
    invalid_filename: 400,
    upload_expired: 410,
    attachment_not_ready: 409,
    scan_unavailable: 503,
    storage_unavailable: 503,
    internal_error: 500,
  };
  const response = apiError(error.code, error.message, status[error.code]);
  if (error.code === "rate_limited") response.headers.set("Retry-After", "60");
  return response;
}

export async function parseBoundedJson(
  request: Request,
  maximumBytes = 16_384,
) {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maximumBytes) {
    return {
      ok: false as const,
      response: apiError(
        "payload_too_large",
        "The request body is too large.",
        413,
      ),
    };
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    return {
      ok: false as const,
      response: apiError(
        "payload_too_large",
        "The request body is too large.",
        413,
      ),
    };
  }
  try {
    return { ok: true as const, value: JSON.parse(text) as unknown };
  } catch {
    return {
      ok: false as const,
      response: apiError("validation_error", "The JSON body is invalid.", 400),
    };
  }
}
