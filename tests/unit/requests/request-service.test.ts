import { describe, expect, it, vi } from "vitest";

import type { EmployeeAccessContext } from "@/lib/auth/access-records";
import type { EmployeeRequestDetail } from "@/lib/dto/request-dto";
import type { RequestRepository } from "@/lib/repositories/request-repository";
import { RequestService } from "@/lib/services/request-service";

const access: EmployeeAccessContext = {
  user: { id: "user", email: "employee@example.test" },
  organization: { id: "organization", name: "BuildPro", slug: "buildpro" },
  membership: {
    id: "member",
    displayName: "Employee",
    role: "manager",
    departmentId: null,
    departmentName: null,
  },
};

function repository(status: EmployeeRequestDetail["status"] = "new") {
  const detail = { status } as EmployeeRequestDetail;
  return {
    options: vi.fn(),
    list: vi.fn(),
    assign: vi.fn(),
    addNote: vi.fn(),
    requestInformation: vi.fn(),
    findDetail: vi.fn().mockResolvedValue({ ok: true, value: detail }),
    transition: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        id: "request",
        status: "awaiting_assessment",
        updatedAt: "now",
      },
    }),
  } satisfies RequestRepository;
}

describe("request service", () => {
  it("returns a typed conflict before repository mutation for an invalid transition", async () => {
    const adapter = repository();
    const result = await new RequestService(adapter).transition(
      access,
      "request",
      {
        newStatus: "completed",
        reason: null,
        expectedUpdatedAt: "2026-08-07T10:00:00Z",
      },
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "conflict",
        message: "That status transition is not allowed.",
      },
    });
    expect(adapter.transition).not.toHaveBeenCalled();
  });

  it("requires a cancellation reason before mutation", async () => {
    const adapter = repository();
    const result = await new RequestService(adapter).transition(
      access,
      "request",
      {
        newStatus: "cancelled",
        reason: null,
        expectedUpdatedAt: "2026-08-07T10:00:00Z",
      },
    );
    expect(result.ok).toBe(false);
    expect(adapter.transition).not.toHaveBeenCalled();
  });

  it("rejects evidence-dependent transitions before repository mutation", async () => {
    const adapter = repository("awaiting_assessment");
    const result = await new RequestService(adapter).transition(
      access,
      "request",
      {
        newStatus: "site_visit_proposed",
        reason: "Visit needed",
        expectedUpdatedAt: "2026-08-07T10:00:00Z",
      },
    );
    expect(result.ok).toBe(false);
    expect(adapter.transition).not.toHaveBeenCalled();
  });

  it("denies viewer access without calling the repository", async () => {
    const adapter = repository();
    const result = await new RequestService(adapter).detail(
      { ...access, membership: { ...access.membership, role: "viewer" } },
      "request",
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "forbidden",
        message: "You are not authorized to perform this action.",
      },
    });
    expect(adapter.findDetail).not.toHaveBeenCalled();
  });
});
