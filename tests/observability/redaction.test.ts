import { describe, expect, it } from "vitest";

import { redactForLog } from "@/lib/observability/redaction";

describe("log redaction", () => {
  it("redacts sensitive fields recursively", () => {
    const value = redactForLog({
      traceId: "trace-safe",
      accessToken: "do-not-log",
      nested: { email: "customer@example.com", outcome: "fallback" },
    });
    expect(value).toEqual({
      traceId: "trace-safe",
      accessToken: "[REDACTED]",
      nested: { email: "[REDACTED]", outcome: "fallback" },
    });
  });

  it("redacts credential-shaped values even under safe keys", () => {
    expect(
      redactForLog({
        value: ["sk", "proj", "abcdefghijklmnopqrstuvwxyz"].join("-"),
      }),
    ).toEqual({ value: "[REDACTED_CREDENTIAL]" });
  });
});
