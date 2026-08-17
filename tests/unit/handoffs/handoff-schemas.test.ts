import { describe, expect, it } from "vitest";
import {
  handoffMessageSchema,
  handoffResolveSchema,
  requestHandoffSchema,
} from "@/lib/schemas/handoff-api";
describe("handoff schemas", () => {
  it("rejects browser-controlled priority", () => {
    expect(
      requestHandoffSchema.safeParse({
        clientRequestId: "d6000000-0000-4000-8000-000000000001",
        reason: "Customer asked for help",
        priority: "urgent",
      }).success,
    ).toBe(false);
  });
  it("requires idempotency and bounded text", () => {
    expect(
      requestHandoffSchema.safeParse({
        clientRequestId: crypto.randomUUID(),
        reason: "Please connect me",
      }).success,
    ).toBe(true);
    expect(
      requestHandoffSchema.safeParse({ clientRequestId: "bad", reason: "x" })
        .success,
    ).toBe(false);
  });
  it("requires explicit resume decision", () =>
    expect(
      handoffResolveSchema.safeParse({ resolution: "Issue resolved" }).success,
    ).toBe(false));
  it("bounds employee messages", () =>
    expect(
      handoffMessageSchema.safeParse({
        clientMessageId: crypto.randomUUID(),
        message: "x".repeat(2001),
      }).success,
    ).toBe(false));
});
