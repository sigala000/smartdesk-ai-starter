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

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
});

const serverEnvironmentSchema = publicEnvironmentSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENAI_MODEL: optionalString,
  APP_BASE_URL: optionalUrl,
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
