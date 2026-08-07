import { describe, expect, it, vi } from "vitest";

import { clearEmployeeSession } from "@/lib/auth/sign-out";

describe("employee sign out", () => {
  it("succeeds after global sign out", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    await expect(clearEmployeeSession(signOut)).resolves.toBe(true);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("falls back to clearing the local session", async () => {
    const signOut = vi
      .fn()
      .mockResolvedValueOnce({ error: new Error("provider unavailable") })
      .mockResolvedValueOnce({ error: null });
    await expect(clearEmployeeSession(signOut)).resolves.toBe(true);
    expect(signOut).toHaveBeenLastCalledWith({ scope: "local" });
  });

  it("does not report success when both attempts fail", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: new Error("failed") });
    await expect(clearEmployeeSession(signOut)).resolves.toBe(false);
    expect(signOut).toHaveBeenCalledTimes(2);
  });
});
