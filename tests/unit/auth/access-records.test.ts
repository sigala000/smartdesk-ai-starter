import { describe, expect, it } from "vitest";

import {
  resolveAccessRecords,
  type MembershipRecord,
} from "@/lib/auth/access-records";

const user = { id: "user-1", email: "employee@example.test" };
const membership: MembershipRecord = {
  id: "member-1",
  display_name: "BuildPro Employee",
  role: "admin",
  department_id: "department-1",
  organizations: {
    id: "organization-1",
    name: "BuildPro Cameroon",
    slug: "buildpro-cameroon",
    is_active: true,
  },
  departments: { id: "department-1", name: "Commercial Department" },
};

describe("employee access resolution", () => {
  it("builds context from one active, valid membership", () => {
    const result = resolveAccessRecords(user, [membership]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.organization.name).toBe("BuildPro Cameroon");
      expect(result.context.membership.role).toBe("admin");
      expect(result.context.membership.departmentName).toBe(
        "Commercial Department",
      );
    }
  });

  it("fails closed for no membership or multiple memberships", () => {
    expect(resolveAccessRecords(user, [])).toMatchObject({
      ok: false,
      code: "membership_required",
    });
    expect(resolveAccessRecords(user, [membership, membership])).toMatchObject({
      ok: false,
      code: "membership_ambiguous",
    });
  });

  it("fails closed for inactive organizations and unknown roles", () => {
    expect(
      resolveAccessRecords(user, [
        {
          ...membership,
          organizations: { ...membership.organizations, is_active: false },
        },
      ]),
    ).toMatchObject({ ok: false, code: "organization_inactive" });
    expect(
      resolveAccessRecords(user, [{ ...membership, role: "owner" }]),
    ).toMatchObject({ ok: false, code: "invalid_role" });
  });
});
