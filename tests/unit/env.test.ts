import { describe, expect, it } from "vitest";

import {
  EnvironmentValidationError,
  parsePublicEnvironment,
  parseServerEnvironment,
  requireSupabasePublicConfig,
  requireOpenAIConfig,
  requireWhatsAppConfig,
  requireStatusVerificationConfig,
} from "@/lib/config/env-schema";

describe("environment validation", () => {
  it("accepts an empty Phase 0 environment", () => {
    expect(parseServerEnvironment({})).toEqual({});
  });

  it("validates the unscanned-attachment safety switch", () => {
    expect(
      parseServerEnvironment({ ATTACHMENT_ALLOW_UNSCANNED: "false" }),
    ).toMatchObject({ ATTACHMENT_ALLOW_UNSCANNED: false });
    expect(() =>
      parseServerEnvironment({ ATTACHMENT_ALLOW_UNSCANNED: "yes" }),
    ).toThrow(EnvironmentValidationError);
  });

  it("requires every server-only WhatsApp value only when enabled", () => {
    expect(requireWhatsAppConfig(parseServerEnvironment({}))).toBeNull();
    expect(() =>
      requireWhatsAppConfig(
        parseServerEnvironment({ META_WHATSAPP_ENABLED: "true" }),
      ),
    ).toThrow(EnvironmentValidationError);
    expect(
      requireWhatsAppConfig(
        parseServerEnvironment({
          META_WHATSAPP_ENABLED: "true",
          META_GRAPH_API_VERSION: "v99.0",
          META_APP_ID: "123456789",
          META_APP_SECRET: "app-secret-at-least-sixteen",
          META_WHATSAPP_VERIFY_TOKEN: "v".repeat(64),
          META_WHATSAPP_ACCESS_TOKEN: "temporary-test-token",
          META_WHATSAPP_PHONE_NUMBER_ID: "12345678901",
          META_WHATSAPP_BUSINESS_ACCOUNT_ID: "98765432101",
          META_WHATSAPP_TEST_RECIPIENT: "+237600000001",
        }),
      ),
    ).toMatchObject({
      graphApiVersion: "v99.0",
      phoneNumberId: "12345678901",
      testRecipients: ["237600000001"],
    });
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

  it("requires server-only OpenAI credentials only when AI is enabled", () => {
    expect(
      requireOpenAIConfig(parseServerEnvironment({ OPENAI_ENABLED: "false" })),
    ).toBeNull();
    expect(() =>
      requireOpenAIConfig(parseServerEnvironment({ OPENAI_ENABLED: "true" })),
    ).toThrow(EnvironmentValidationError);
    expect(
      requireOpenAIConfig(
        parseServerEnvironment({
          OPENAI_ENABLED: "true",
          OPENAI_API_KEY: "server-secret",
          OPENAI_MODEL: "gpt-5.6-sol",
          OPENAI_MAX_TOOL_CALLS: "3",
        }),
      ),
    ).toMatchObject({ model: "gpt-5.6-sol", maxToolCalls: 3 });
  });

  it("fails closed when the status mock is enabled in production", () => {
    const environment = parseServerEnvironment({
      STATUS_VERIFICATION_ENABLED: "true",
      STATUS_VERIFICATION_PROVIDER: "mock",
      PUBLIC_RATE_LIMIT_SECRET: "s".repeat(32),
    });
    expect(() =>
      requireStatusVerificationConfig(environment, "production"),
    ).toThrow(EnvironmentValidationError);
    expect(
      requireStatusVerificationConfig(environment, "development"),
    ).toMatchObject({ provider: "mock", maxAttempts: 5 });
  });
});
