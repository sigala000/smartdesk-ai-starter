import { z } from "zod";

type EnvironmentInput = Record<string, string | undefined>;

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().optional(),
);

const optionalBoolean = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
);

const optionalInteger = (minimum: number, maximum: number) =>
  z.preprocess(
    (value) =>
      value === "" || value === undefined ? undefined : Number(value),
    z.number().int().min(minimum).max(maximum).optional(),
  );

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
});

const serverEnvironmentSchema = publicEnvironmentSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENAI_MODEL: optionalString,
  OPENAI_ENABLED: optionalBoolean,
  OPENAI_REQUEST_TIMEOUT_MS: optionalInteger(1000, 60_000),
  OPENAI_MAX_OUTPUT_TOKENS: optionalInteger(64, 4096),
  OPENAI_MAX_TOOL_CALLS: optionalInteger(1, 8),
  OPENAI_HISTORY_MESSAGE_LIMIT: optionalInteger(2, 50),
  OPENAI_INPUT_CHARACTER_BUDGET: optionalInteger(2000, 50_000),
  OPENAI_MAX_TOKENS_PER_TURN: optionalInteger(128, 50_000),
  APP_BASE_URL: optionalUrl,
  PUBLIC_RATE_LIMIT_SECRET: optionalString,
  PUBLIC_CLIENT_IP_HEADER: z.enum(["cf-connecting-ip", "x-real-ip"]).optional(),
  ATTACHMENT_ALLOW_UNSCANNED: optionalBoolean,
  META_WHATSAPP_ENABLED: optionalBoolean,
  META_GRAPH_API_VERSION: optionalString,
  META_APP_ID: optionalString,
  META_APP_SECRET: optionalString,
  META_WHATSAPP_VERIFY_TOKEN: optionalString,
  META_WHATSAPP_ACCESS_TOKEN: optionalString,
  META_WHATSAPP_PHONE_NUMBER_ID: optionalString,
  META_WHATSAPP_BUSINESS_ACCOUNT_ID: optionalString,
  META_WHATSAPP_TEST_RECIPIENT: optionalString,
  META_WHATSAPP_REQUEST_TIMEOUT_MS: optionalInteger(1000, 30_000),
  META_WHATSAPP_MAX_WEBHOOK_BYTES: optionalInteger(1024, 1_048_576),
  STATUS_VERIFICATION_ENABLED: optionalBoolean,
  STATUS_VERIFICATION_PROVIDER: z.enum(["mock", "production"]).optional(),
  STATUS_VERIFICATION_MOCK_EXPOSE_CODE: optionalBoolean,
  STATUS_VERIFICATION_CODE_TTL_SECONDS: optionalInteger(60, 3600),
  STATUS_VERIFICATION_TOKEN_TTL_SECONDS: optionalInteger(60, 3600),
  STATUS_VERIFICATION_MAX_ATTEMPTS: optionalInteger(1, 10),
  STATUS_VERIFICATION_LOCKOUT_SECONDS: optionalInteger(60, 86400),
});

export type PublicEnvironment = z.output<typeof publicEnvironmentSchema>;
export type ServerEnvironment = z.output<typeof serverEnvironmentSchema>;

export type SupabasePublicConfig = Readonly<{
  url: string;
  anonKey: string;
}>;

export class EnvironmentValidationError extends Error {
  readonly variables: readonly string[];

  constructor(variables: readonly string[]) {
    const uniqueVariables = [...new Set(variables)];
    super(`Invalid environment variables: ${uniqueVariables.join(", ")}`);
    this.name = "EnvironmentValidationError";
    this.variables = uniqueVariables;
  }
}

function parseEnvironment<T>(schema: z.ZodType<T>, input: EnvironmentInput): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    const variables = result.error.issues.map((issue) =>
      issue.path.length > 0 ? issue.path.join(".") : "environment",
    );
    throw new EnvironmentValidationError(variables);
  }

  return result.data;
}

export function parsePublicEnvironment(
  input: EnvironmentInput,
): PublicEnvironment {
  return parseEnvironment(publicEnvironmentSchema, input);
}

export function parseServerEnvironment(
  input: EnvironmentInput,
): ServerEnvironment {
  return parseEnvironment(serverEnvironmentSchema, input);
}

export function requireSupabasePublicConfig(
  environment: PublicEnvironment | ServerEnvironment,
): SupabasePublicConfig {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = environment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const missing = [
    url ? null : "NEXT_PUBLIC_SUPABASE_URL",
    anonKey ? null : "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter((variable): variable is string => variable !== null);

  if (missing.length > 0 || !url || !anonKey) {
    throw new EnvironmentValidationError(missing);
  }

  return {
    url,
    anonKey,
  };
}

export function requireOpenAIConfig(environment: ServerEnvironment) {
  if (!environment.OPENAI_ENABLED) return null;
  const missing = [
    environment.OPENAI_API_KEY ? null : "OPENAI_API_KEY",
    environment.OPENAI_MODEL ? null : "OPENAI_MODEL",
  ].filter((value): value is string => value !== null);
  if (
    missing.length > 0 ||
    !environment.OPENAI_API_KEY ||
    !environment.OPENAI_MODEL
  )
    throw new EnvironmentValidationError(missing);
  return {
    apiKey: environment.OPENAI_API_KEY,
    model: environment.OPENAI_MODEL,
    timeoutMs: environment.OPENAI_REQUEST_TIMEOUT_MS ?? 15_000,
    maxOutputTokens: environment.OPENAI_MAX_OUTPUT_TOKENS ?? 600,
    maxToolCalls: environment.OPENAI_MAX_TOOL_CALLS ?? 4,
    historyMessages: environment.OPENAI_HISTORY_MESSAGE_LIMIT ?? 16,
    inputCharacters: environment.OPENAI_INPUT_CHARACTER_BUDGET ?? 12_000,
    maxTokensPerTurn: environment.OPENAI_MAX_TOKENS_PER_TURN ?? 8_000,
  };
}

export function requireStatusVerificationConfig(
  environment: ServerEnvironment,
  nodeEnvironment = process.env.NODE_ENV,
) {
  if (!environment.STATUS_VERIFICATION_ENABLED) return null;
  const provider = environment.STATUS_VERIFICATION_PROVIDER;
  if (!provider)
    throw new EnvironmentValidationError(["STATUS_VERIFICATION_PROVIDER"]);
  if (
    nodeEnvironment === "production" &&
    (provider === "mock" || environment.STATUS_VERIFICATION_MOCK_EXPOSE_CODE)
  )
    throw new EnvironmentValidationError([
      provider === "mock"
        ? "STATUS_VERIFICATION_PROVIDER"
        : "STATUS_VERIFICATION_MOCK_EXPOSE_CODE",
    ]);
  const secret = environment.PUBLIC_RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32)
    throw new EnvironmentValidationError(["PUBLIC_RATE_LIMIT_SECRET"]);
  return {
    provider,
    exposeMockCode:
      provider === "mock" &&
      environment.STATUS_VERIFICATION_MOCK_EXPOSE_CODE === true,
    secret,
    codeTtlSeconds: environment.STATUS_VERIFICATION_CODE_TTL_SECONDS ?? 600,
    tokenTtlSeconds: environment.STATUS_VERIFICATION_TOKEN_TTL_SECONDS ?? 900,
    maxAttempts: environment.STATUS_VERIFICATION_MAX_ATTEMPTS ?? 5,
    lockoutSeconds: environment.STATUS_VERIFICATION_LOCKOUT_SECONDS ?? 900,
  };
}

export function requireWhatsAppConfig(environment: ServerEnvironment) {
  if (!environment.META_WHATSAPP_ENABLED) return null;
  const required = [
    "META_GRAPH_API_VERSION",
    "META_APP_ID",
    "META_APP_SECRET",
    "META_WHATSAPP_VERIFY_TOKEN",
    "META_WHATSAPP_ACCESS_TOKEN",
    "META_WHATSAPP_PHONE_NUMBER_ID",
    "META_WHATSAPP_BUSINESS_ACCOUNT_ID",
    "META_WHATSAPP_TEST_RECIPIENT",
  ] as const;
  const missing = required.filter((name) => !environment[name]);
  if (missing.length) throw new EnvironmentValidationError(missing);
  const version = environment.META_GRAPH_API_VERSION!;
  const phoneNumberId = environment.META_WHATSAPP_PHONE_NUMBER_ID!;
  const businessAccountId = environment.META_WHATSAPP_BUSINESS_ACCOUNT_ID!;
  const recipient = environment.META_WHATSAPP_TEST_RECIPIENT!;
  if (!/^v\d{1,2}\.\d$/.test(version))
    throw new EnvironmentValidationError(["META_GRAPH_API_VERSION"]);
  if (!/^\d{5,32}$/.test(phoneNumberId))
    throw new EnvironmentValidationError(["META_WHATSAPP_PHONE_NUMBER_ID"]);
  if (!/^\d{5,32}$/.test(businessAccountId))
    throw new EnvironmentValidationError(["META_WHATSAPP_BUSINESS_ACCOUNT_ID"]);
  if (!/^\+\d{6,20}$/.test(recipient))
    throw new EnvironmentValidationError(["META_WHATSAPP_TEST_RECIPIENT"]);
  if (environment.META_APP_SECRET!.length < 16)
    throw new EnvironmentValidationError(["META_APP_SECRET"]);
  if (environment.META_WHATSAPP_VERIFY_TOKEN!.length < 32)
    throw new EnvironmentValidationError(["META_WHATSAPP_VERIFY_TOKEN"]);
  return {
    graphApiVersion: version,
    appId: environment.META_APP_ID!,
    appSecret: environment.META_APP_SECRET!,
    verifyToken: environment.META_WHATSAPP_VERIFY_TOKEN!,
    accessToken: environment.META_WHATSAPP_ACCESS_TOKEN!,
    phoneNumberId,
    businessAccountId,
    testRecipient: recipient.slice(1),
    timeoutMs: environment.META_WHATSAPP_REQUEST_TIMEOUT_MS ?? 10_000,
    maxWebhookBytes: environment.META_WHATSAPP_MAX_WEBHOOK_BYTES ?? 262_144,
  };
}
