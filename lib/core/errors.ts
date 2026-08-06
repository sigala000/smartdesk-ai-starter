export const APPLICATION_ERROR_CODES = [
  "validation_error",
  "unauthenticated",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "external_service_error",
  "internal_error",
] as const;

export type ApplicationErrorCode = (typeof APPLICATION_ERROR_CODES)[number];

export type FieldErrors = Readonly<Record<string, readonly string[]>>;

export type ApplicationError = Readonly<{
  code: ApplicationErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
  traceId?: string;
}>;
