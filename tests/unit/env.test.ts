import { describe, expect, it } from "vitest";

import {
  EnvironmentValidationError,
  parsePublicEnvironment,
  parseServerEnvironment,
  requireSupabasePublicConfig,
} from "@/lib/config/env-schema";

describe("environment validation", () => {
  it("accepts an empty Phase 0 environment", () => {
    expect(parseServerEnvironment({})).toEqual({});
  });

  it("normalizes empty optional values", () => {
    expect(
      parseServerEnvironment({
        APP_BASE_URL: "",
        OPENAI_API_KEY: "",
      }),
    ).toEqual({});
  });

  it("parses configured public and server values", () => {
    expect(
      parseServerEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-placeholder",
        SUPABASE_SERVICE_ROLE_KEY: "server-placeholder",
        APP_BASE_URL: "https://smartdesk.example",
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-placeholder",
      SUPABASE_SERVICE_ROLE_KEY: "server-placeholder",
      APP_BASE_URL: "https://smartdesk.example",
    });
  });

  it("exposes only allowlisted browser values", () => {
    const parsed = parsePublicEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-placeholder",
      OPENAI_API_KEY: "must-not-be-returned",
      SUPABASE_SERVICE_ROLE_KEY: "must-not-be-returned",
      UNRECOGNIZED_VALUE: "must-not-be-returned",
    });

    expect(parsed).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-placeholder",
    });
    expect(Object.keys(parsed)).not.toContain("OPENAI_API_KEY");
    expect(Object.keys(parsed)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(Object.keys(parsed)).not.toContain("UNRECOGNIZED_VALUE");
  });

  it("reports invalid variable names without revealing values", () => {
    const secretValue = "not-a-url-secret-value";

    expect(() => parseServerEnvironment({ APP_BASE_URL: secretValue })).toThrow(
      EnvironmentValidationError,
    );

    try {
      parseServerEnvironment({ APP_BASE_URL: secretValue });
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(EnvironmentValidationError);
      const validationError = error as EnvironmentValidationError;
      expect(validationError.variables).toEqual(["APP_BASE_URL"]);
      expect(validationError.message).toContain("APP_BASE_URL");
      expect(validationError.message).not.toContain(secretValue);
    }
  });

  it("requires both public Supabase values when authentication is used", () => {
    expect(() => requireSupabasePublicConfig({})).toThrow(
      EnvironmentValidationError,
    );
    expect(
      requireSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-placeholder",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      anonKey: "public-placeholder",
    });
  });
});
