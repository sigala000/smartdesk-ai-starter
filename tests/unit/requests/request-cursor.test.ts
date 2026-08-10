import { describe, expect, it } from "vitest";

import {
  decodeRequestCursor,
  encodeRequestCursor,
} from "@/lib/domain/request-cursor";

describe("request cursors", () => {
  it("round trips a versioned stable position", () => {
    const value = {
      createdAt: "2026-08-07T10:00:00.000Z",
      id: "10000000-0000-4000-8000-000000000001",
    };
    expect(decodeRequestCursor(encodeRequestCursor(value))).toEqual({
      version: 1,
      ...value,
    });
  });

  it("rejects malformed and unsupported cursors", () => {
    expect(decodeRequestCursor("not-json")).toBeNull();
    const old = Buffer.from(
      JSON.stringify({
        version: 0,
        createdAt: "2026-08-07T10:00:00.000Z",
        id: "10000000-0000-4000-8000-000000000001",
      }),
    ).toString("base64url");
    expect(decodeRequestCursor(old)).toBeNull();
    expect(decodeRequestCursor("x".repeat(501))).toBeNull();
  });
});
