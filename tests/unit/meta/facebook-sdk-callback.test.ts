import { describe, expect, it, vi } from "vitest";

import {
  createFacebookSdkCallback,
  createMetaAssetCollector,
} from "@/lib/meta/facebook-sdk-callback";

describe("Facebook SDK callback adapter", () => {
  it("gives Meta a synchronous function while continuing async work", async () => {
    const handler = vi.fn(async (value: string) => {
      void value;
    });
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

  it("waits for the phone assets when Meta sends them after login completes", async () => {
    const collector = createMetaAssetCollector();
    const pending = collector.wait(100);

    collector.record({ wabaId: "waba-1" });
    collector.record({ phoneNumberId: "phone-1" });

    await expect(pending).resolves.toEqual({
      wabaId: "waba-1",
      phoneNumberId: "phone-1",
    });
  });

  it("returns no assets when Meta never completes the session event", async () => {
    vi.useFakeTimers();
    const collector = createMetaAssetCollector();
    const pending = collector.wait(100);

    await vi.advanceTimersByTimeAsync(100);
    await expect(pending).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});
