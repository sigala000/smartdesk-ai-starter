import { describe, expect, it, vi } from "vitest";

import { createFacebookSdkCallback } from "@/lib/meta/facebook-sdk-callback";

describe("Facebook SDK callback adapter", () => {
  it("gives Meta a synchronous function while continuing async work", async () => {
    const handler = vi.fn(async (_value: string) => undefined);
    const onError = vi.fn();
    const callback = createFacebookSdkCallback(handler, onError);

    expect(callback.constructor.name).toBe("Function");
    expect(callback("authorization-code")).toBeUndefined();
    await vi.waitFor(() =>
      expect(handler).toHaveBeenCalledWith("authorization-code"),
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports asynchronous completion failures", async () => {
    const failure = new Error("completion_failed");
    const onError = vi.fn();
    const callback = createFacebookSdkCallback(
      async () => Promise.reject(failure),
      onError,
    );

    callback("authorization-code");
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(failure));
  });
});
