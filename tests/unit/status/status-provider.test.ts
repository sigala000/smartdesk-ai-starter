import { describe, expect, it } from "vitest";
import { createStatusVerificationProvider } from "@/lib/verification/provider-factory";
describe("status verification providers", () => {
  it("allows the mock only outside production", () => {
    expect(
      createStatusVerificationProvider(
        { provider: "mock", exposeMockCode: true },
        "development",
      ).exposesCode,
    ).toBe(true);
    expect(() =>
      createStatusVerificationProvider(
        { provider: "mock", exposeMockCode: false },
        "production",
      ),
    ).toThrow("mock_status_provider_forbidden");
  });
  it("never simulates production delivery", async () =>
    expect(
      await createStatusVerificationProvider(
        { provider: "production", exposeMockCode: false },
        "production",
      ).sendCode({
        destinationE164: "+237600000001",
        code: "123456",
        expiresAt: new Date(),
        traceId: crypto.randomUUID(),
      }),
    ).toMatchObject({ ok: false, code: "provider_unavailable" }));
});
