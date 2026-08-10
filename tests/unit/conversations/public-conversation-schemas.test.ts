import { describe, expect, it } from "vitest";

import {
  confirmRequestSchema,
  createConversationSchema,
  publicMessageSchema,
} from "@/lib/schemas/public-conversation-api";

describe("public conversation schemas", () => {
  it("accepts a bounded BuildPro creation request", () => {
    expect(
      createConversationSchema.safeParse({
        organizationSlug: "buildpro-cameroon",
        locale: "en",
      }).success,
    ).toBe(true);
  });

  it("rejects arbitrary actions and oversized answers", () => {
    expect(
      publicMessageSchema.safeParse({
        clientMessageId: crypto.randomUUID(),
        kind: "action",
        action: "run_sql",
      }).success,
    ).toBe(false);
    expect(
      publicMessageSchema.safeParse({
        clientMessageId: crypto.randomUUID(),
        kind: "answer",
        value: "x".repeat(2001),
      }).success,
    ).toBe(false);
  });

  it("accepts bounded natural-language messages and rejects extra scope", () => {
    expect(
      publicMessageSchema.safeParse({
        clientMessageId: crypto.randomUUID(),
        kind: "message",
        message: "I need to renovate my kitchen",
      }).success,
    ).toBe(true);
    expect(
      publicMessageSchema.safeParse({
        clientMessageId: crypto.randomUUID(),
        kind: "message",
        message: "Hello",
        organizationId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });

  it("confirmation accepts no resubmitted request fields", () => {
    expect(
      confirmRequestSchema.safeParse({
        confirmation: true,
        confirmationNonce: "a".repeat(43),
        idempotencyKey: crypto.randomUUID(),
      }).success,
    ).toBe(true);
    expect(
      confirmRequestSchema.safeParse({
        confirmation: true,
        confirmationNonce: "a".repeat(43),
        idempotencyKey: crypto.randomUUID(),
        location: "Injected",
      }).success,
    ).toBe(false);
  });
});
