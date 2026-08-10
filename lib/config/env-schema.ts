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
  APP_BASE_URL: optionalUrl,
  PUBLIC_RATE_LIMIT_SECRET: optionalString,
  PUBLIC_CLIENT_IP_HEADER: z.enum(["cf-connecting-ip", "x-real-ip"]).optional(),
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
  };
}
