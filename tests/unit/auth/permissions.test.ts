import { describe, expect, it } from "vitest";

import { can, navigationForRole } from "@/lib/auth/permissions";
import { employeeRoles } from "@/lib/auth/roles";

describe("employee shell permissions", () => {
  it("allows every checked database role to enter the dashboard", () => {
    for (const role of employeeRoles) {
      expect(can(role, "dashboard:view")).toBe(true);
    }
  });

  it("limits organization navigation to managers and administrators", () => {
    expect(navigationForRole("admin").map((item) => item.href)).toContain(
      "/dashboard/organization",
    );
    expect(navigationForRole("manager").map((item) => item.href)).toContain(
      "/dashboard/organization",
    );
    expect(navigationForRole("viewer").map((item) => item.href)).toEqual([
      "/dashboard",
    ]);
  });

  it("denies viewer request access and exposes request navigation to operational roles", () => {
    expect(can("viewer", "requests:view")).toBe(false);
    expect(can("commercial_officer", "requests:view")).toBe(true);
    expect(
      navigationForRole("technical_officer").map((item) => item.href),
    ).toContain("/dashboard/requests");
    expect(navigationForRole("viewer").map((item) => item.href)).not.toContain(
      "/dashboard/requests",
    );
  });
});
