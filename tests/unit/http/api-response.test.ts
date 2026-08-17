import { describe, expect, it } from "vitest";

import {
  apiAccessError,
  apiSuccess,
  parseBoundedJson,
} from "@/lib/http/api-response";

describe("request API response hardening", () => {
  it("correlates success and error responses without caching", () => {
    for (const response of [
      apiSuccess({ ok: true }),
      apiAccessError(
        { ok: false, code: "membership_required", authenticated: true },
        "Forbidden",
      ),
    ]) {
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it("distinguishes internal access failures from permission denials", async () => {
    const response = apiAccessError(
      { ok: false, code: "internal_error", authenticated: true },
      "Forbidden",
    );
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "internal_error" },
    });
  });

  it("rejects oversized JSON before returning parsed data", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "x".repeat(100) }),
    });
    const result = await parseBoundedJson(request, 32);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
  });
});
