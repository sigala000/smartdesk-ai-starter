import { describe, expect, it } from "vitest";

import {
  canRoleTransition,
  canTransition,
  requestTransitions,
  transitionReasonRequired,
} from "@/lib/domain/request-transitions";
import { requestStatuses } from "@/lib/domain/requests";

describe("request transitions", () => {
  it("defines every canonical status", () => {
    expect(Object.keys(requestTransitions).sort()).toEqual(
      [...requestStatuses].sort(),
    );
  });

  it("accepts documented forward and branch transitions", () => {
    expect(canTransition("new", "awaiting_assessment")).toBe(true);
    expect(canTransition("awaiting_customer_information", "new")).toBe(true);
    expect(
      canTransition("quotation_sent", "quotation_revision_requested"),
    ).toBe(true);
    expect(canTransition("awaiting_client_validation", "in_progress")).toBe(
      true,
    );
  });

  it("rejects skips and terminal-state changes", () => {
    expect(canTransition("new", "completed")).toBe(false);
    expect(canTransition("closed", "new")).toBe(false);
    expect(canTransition("cancelled", "closed")).toBe(false);
  });

  it("requires a cancellation reason", () => {
    expect(transitionReasonRequired("cancelled")).toBe(true);
    expect(transitionReasonRequired("closed")).toBe(false);
  });

  it("limits transitions to the employee role workflow", () => {
    expect(
      canRoleTransition("commercial_officer", "new", "awaiting_assessment"),
    ).toBe(true);
    expect(canRoleTransition("technical_officer", "new", "cancelled")).toBe(
      false,
    );
    expect(
      canRoleTransition(
        "project_manager",
        "in_progress",
        "awaiting_client_validation",
      ),
    ).toBe(false);
    expect(canRoleTransition("viewer", "new", "awaiting_assessment")).toBe(
      false,
    );
    expect(
      canRoleTransition(
        "technical_officer",
        "awaiting_assessment",
        "assessment_completed",
        "quotation",
      ),
    ).toBe(false);
    expect(
      canRoleTransition(
        "project_manager",
        "scheduled",
        "in_progress",
        "quotation",
      ),
    ).toBe(false);
    expect(
      canRoleTransition(
        "support_officer",
        "new",
        "awaiting_customer_information",
        "quotation",
      ),
    ).toBe(false);
    expect(
      canRoleTransition(
        "support_officer",
        "new",
        "awaiting_customer_information",
        "support",
      ),
    ).toBe(true);
  });

  it("fails closed for transitions whose evidence model is not in Phase 3", () => {
    expect(
      canRoleTransition(
        "manager",
        "awaiting_assessment",
        "site_visit_proposed",
        "quotation",
      ),
    ).toBe(false);
    expect(
      canRoleTransition(
        "manager",
        "quotation_sent",
        "quotation_accepted",
        "quotation",
      ),
    ).toBe(false);
    expect(
      canRoleTransition(
        "admin",
        "awaiting_client_validation",
        "completed",
        "quotation",
      ),
    ).toBe(false);
  });
});
