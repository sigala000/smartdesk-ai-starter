import { describe, expect, it } from "vitest";

import {
  APPLICATION_ERROR_CODES,
  type ApplicationError,
} from "@/lib/core/errors";
import { failure, type Result, success } from "@/lib/core/result";

describe("result helpers", () => {
  it("preserves and narrows a successful value", () => {
    const result: Result<{ id: string }, ApplicationError> = success({
      id: "request-id",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe("request-id");
    }
  });

  it("preserves and narrows a failure", () => {
    const error: ApplicationError = {
      code: "validation_error",
      message: "Check the submitted fields.",
      fieldErrors: { location: ["Location is required."] },
    };
    const result: Result<string, ApplicationError> = failure(error);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual(error);
    }
  });

  it("contains every architecture-defined error category", () => {
    expect(APPLICATION_ERROR_CODES).toEqual([
      "validation_error",
      "unauthenticated",
      "forbidden",
      "not_found",
      "conflict",
      "rate_limited",
      "external_service_error",
      "internal_error",
    ]);
  });
});
