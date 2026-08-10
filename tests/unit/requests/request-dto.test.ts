import { describe, expect, it } from "vitest";

import {
  toCustomerSafeRequest,
  type EmployeeRequestDetail,
} from "@/lib/dto/request-dto";

describe("request DTO separation", () => {
  it("constructs customer-safe data from an allowlist", () => {
    const detail = {
      referenceNumber: "BP-2026-000001",
      serviceName: "Painting",
      status: "new",
      updatedAt: "2026-08-07T10:00:00Z",
      customerPhone: "+237600000000",
      internalNotes: [{ content: "employee only" }],
      attachments: [{ storagePath: "secret" }],
    } as unknown as EmployeeRequestDetail;
    const safe = toCustomerSafeRequest(detail);
    expect(safe).toEqual({
      referenceNumber: "BP-2026-000001",
      serviceName: "Painting",
      status: "new",
      updatedAt: "2026-08-07T10:00:00Z",
    });
    expect(JSON.stringify(safe)).not.toContain("employee only");
    expect(JSON.stringify(safe)).not.toContain("+237");
    expect(JSON.stringify(safe)).not.toContain("secret");
  });
});
