import { describe, expect, it, vi } from "vitest";
import { RequestStatusService } from "@/lib/services/request-status-service";
import type { RequestStatusRepository } from "@/lib/repositories/request-status-repository";
function setup(match = true) {
  let saved: { id: string; codeDigest: string; real: boolean } | null = null;
  const repository: RequestStatusRepository = {
    findTarget: vi.fn(async () =>
      match
        ? {
            organizationId: "org",
            requestId: "request",
            referenceNumber: "BP-2026-000001",
            phone: "+237600000001",
            serviceName: "Painting",
            status: "new",
            updatedAt: new Date().toISOString(),
          }
        : null,
    ),
    consumeRateLimit: vi.fn(async () => true),
    createChallenge: vi.fn(async (input) => {
      saved = { id: input.id, codeDigest: input.codeDigest, real: input.real };
      return {
        id: input.id,
        organizationId: input.organizationId,
        requestId: input.requestId,
        expiresAt: input.expiresAt,
        created: true,
      };
    }),
    setDelivery: vi.fn(async () => undefined),
    verify: vi.fn(async () => ({
      success: true,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    })),
    consumeStatus: vi.fn(async () => null),
    consumeConversationStatus: vi.fn(async () => null),
  };
  const provider = {
    exposesCode: true,
    sendCode: vi.fn(async () => ({ ok: true as const })),
  };
  return {
    service: new RequestStatusService(repository, provider, {
      secret: "s".repeat(32),
      codeTtlSeconds: 600,
      tokenTtlSeconds: 900,
      maxAttempts: 5,
      lockoutSeconds: 900,
    }),
    repository,
    provider,
    getSaved: () => saved,
  };
}
describe("request status service", () => {
  it("delivers only for a matching factor and exposes mock code safely", async () => {
    const { service, provider, getSaved } = setup();
    const result = await service.challenge({
      organizationSlug: "buildpro-cameroon",
      referenceNumber: "BP-2026-000001",
      phone: "+237600000001",
      ip: "127.0.0.1",
    });
    expect(result.ok && result.value.developmentCode).toMatch(/^\d{6}$/);
    if (result.ok) await result.deliver?.();
    expect(provider.sendCode).toHaveBeenCalledOnce();
    expect(getSaved()).toMatchObject({ real: true });
  });
  it("returns the same challenge shape without delivery for an unknown request", async () => {
    const { service, provider } = setup(false);
    const result = await service.challenge({
      organizationSlug: "buildpro-cameroon",
      referenceNumber: "BP-2026-999999",
      phone: "+237600000001",
      ip: "127.0.0.1",
    });
    expect(result.ok).toBe(true);
    expect(provider.sendCode).not.toHaveBeenCalled();
    expect(result.ok && result.value).not.toHaveProperty("developmentCode");
  });
  it("applies public abuse limits before resolving a request target", async () => {
    const { service, repository } = setup();
    await service.challenge({
      organizationSlug: "buildpro-cameroon",
      referenceNumber: "BP-2026-000001",
      phone: "+237600000001",
      ip: "127.0.0.1",
    });
    const rateLimitOrder = vi.mocked(repository.consumeRateLimit).mock
      .invocationCallOrder;
    const lookupOrder = vi.mocked(repository.findTarget).mock
      .invocationCallOrder[0];
    expect(Math.max(...rateLimitOrder)).toBeLessThan(lookupOrder);
  });
  it("returns generic verification failures and bounded tokens", async () => {
    const { service, repository } = setup();
    vi.mocked(repository.verify).mockResolvedValueOnce({
      success: false,
      expiresAt: null,
    });
    expect(
      await service.verify({
        challengeId: crypto.randomUUID(),
        code: "000000",
        ip: "127.0.0.1",
      }),
    ).toMatchObject({ ok: false, code: "verification_failed" });
    vi.mocked(repository.verify).mockResolvedValueOnce({
      success: true,
      expiresAt: new Date().toISOString(),
    });
    const success = await service.verify({
      challengeId: crypto.randomUUID(),
      code: "123456",
      ip: "127.0.0.1",
    });
    expect(success.ok && success.value.verificationToken).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
  });
});
