import { describe, expect, it } from "vitest";
import {
  customerStatusCopy,
  requestStatuses,
} from "@/lib/domain/request-status";
import { toCustomerRequestStatus } from "@/lib/dto/request-status-dto";
describe("customer-safe request status", () => {
  it("maps every canonical status to bounded customer copy", () => {
    for (const status of requestStatuses) {
      const copy = customerStatusCopy(status);
      expect(copy.displayStatus.length).toBeGreaterThan(0);
      expect(copy.lastUpdate.length).toBeGreaterThan(0);
      expect(copy.nextAction.length).toBeGreaterThan(0);
    }
  });
  it("serializes only the allowlisted projection", () => {
    const value = toCustomerRequestStatus({
      referenceNumber: "BP-2026-000001",
      serviceName: "Painting",
      status: "new",
      updatedAt: "2026-08-11T00:00:00Z",
    });
    expect(Object.keys(value).sort()).toEqual(
      [
        "displayStatus",
        "lastUpdate",
        "nextAction",
        "referenceNumber",
        "serviceName",
        "updatedAt",
      ].sort(),
    );
    expect(JSON.stringify(value)).not.toContain("employee-secret");
  });
});
