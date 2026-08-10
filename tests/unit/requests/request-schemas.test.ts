import { describe, expect, it } from "vitest";

import {
  assignmentSchema,
  internalNoteSchema,
  requestInformationSchema,
  requestListQuerySchema,
  statusTransitionSchema,
} from "@/lib/schemas/request-api";

const uuid = "10000000-0000-4000-8000-000000000001";

describe("request API schemas", () => {
  it("normalizes valid filters and bounds pagination", () => {
    expect(
      requestListQuerySchema.parse({ search: "  BuildPro ", limit: "50" }),
    ).toMatchObject({ search: "BuildPro", limit: 50 });
    expect(requestListQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(requestListQuerySchema.safeParse({ search: "x" }).success).toBe(
      false,
    );
    expect(
      requestListQuerySchema.safeParse({ search: "name),id.neq.null" }).success,
    ).toBe(false);
  });

  it("requires an assignment target", () => {
    expect(
      assignmentSchema.safeParse({
        departmentId: null,
        memberId: null,
        reason: null,
        expectedUpdatedAt: "2026-08-07T10:00:00Z",
      }).success,
    ).toBe(false);
    expect(
      assignmentSchema.safeParse({
        departmentId: uuid,
        memberId: null,
        reason: null,
        expectedUpdatedAt: "2026-08-07T10:00:00Z",
      }).success,
    ).toBe(true);
  });

  it("validates transition, note, and question limits", () => {
    expect(
      statusTransitionSchema.safeParse({
        newStatus: "completed",
        reason: null,
        expectedUpdatedAt: "bad",
      }).success,
    ).toBe(false);
    expect(internalNoteSchema.safeParse({ content: " " }).success).toBe(false);
    expect(
      requestInformationSchema.safeParse({
        question: "What is the size?",
        expectedUpdatedAt: "2026-08-07T10:00:00Z",
      }).success,
    ).toBe(true);
  });
});
