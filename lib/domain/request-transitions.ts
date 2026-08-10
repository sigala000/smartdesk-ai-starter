import type { EmployeeRole } from "@/lib/auth/roles";
import type { RequestStatus, RequestType } from "@/lib/domain/requests";

export const requestTransitions: Readonly<
  Record<RequestStatus, readonly RequestStatus[]>
> = {
  draft: ["new"],
  new: [
    "awaiting_customer_information",
    "awaiting_assessment",
    "cancelled",
    "unsupported",
  ],
  awaiting_customer_information: ["new", "inactive", "cancelled"],
  awaiting_assessment: [
    "site_visit_proposed",
    "assessment_completed",
    "awaiting_customer_information",
    "cancelled",
    "unsupported",
  ],
  site_visit_proposed: ["site_visit_scheduled", "cancelled"],
  site_visit_scheduled: ["assessment_completed", "cancelled"],
  assessment_completed: ["quotation_preparing", "cancelled"],
  quotation_preparing: ["quotation_sent", "cancelled"],
  quotation_sent: [
    "quotation_revision_requested",
    "quotation_accepted",
    "quotation_rejected",
    "cancelled",
  ],
  quotation_revision_requested: ["quotation_preparing", "cancelled"],
  quotation_accepted: ["scheduled", "cancelled"],
  quotation_rejected: ["closed"],
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["awaiting_client_validation", "cancelled"],
  awaiting_client_validation: ["completed", "in_progress", "cancelled"],
  completed: ["closed"],
  cancelled: [],
  unsupported: ["closed"],
  inactive: ["new", "cancelled"],
  closed: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return requestTransitions[from].includes(to);
}

export function transitionReasonRequired(to: RequestStatus): boolean {
  return to === "cancelled";
}

type TransitionPair = `${RequestStatus}->${RequestStatus}`;

const phaseThreeTransitions = new Set<TransitionPair>([
  "new->awaiting_customer_information",
  "new->awaiting_assessment",
  "new->unsupported",
  "new->cancelled",
  "awaiting_customer_information->new",
  "awaiting_customer_information->inactive",
  "awaiting_customer_information->cancelled",
  "awaiting_assessment->awaiting_customer_information",
  "awaiting_assessment->unsupported",
  "awaiting_assessment->cancelled",
  "unsupported->closed",
  "inactive->new",
  "inactive->cancelled",
]);

const commercialTransitions = phaseThreeTransitions;
const supportTransitions = new Set<TransitionPair>([
  "new->awaiting_customer_information",
  "new->cancelled",
  "awaiting_customer_information->new",
  "awaiting_customer_information->inactive",
  "awaiting_customer_information->cancelled",
  "awaiting_assessment->awaiting_customer_information",
  "awaiting_assessment->unsupported",
  "awaiting_assessment->cancelled",
  "unsupported->closed",
  "inactive->new",
  "inactive->cancelled",
]);

export function canRoleTransition(
  role: EmployeeRole,
  from: RequestStatus,
  to: RequestStatus,
  requestType?: RequestType,
): boolean {
  const pair: TransitionPair = `${from}->${to}`;
  if (!canTransition(from, to) || !phaseThreeTransitions.has(pair))
    return false;
  if (role === "admin" || role === "manager") return true;
  if (role === "commercial_officer") return commercialTransitions.has(pair);
  if (role === "support_officer") {
    return (
      (requestType === "support" || requestType === "complaint") &&
      supportTransitions.has(pair)
    );
  }
  return false;
}

export function transitionsForRole(
  role: EmployeeRole,
  from: RequestStatus,
  requestType?: RequestType,
): readonly RequestStatus[] {
  return requestTransitions[from].filter((to) =>
    canRoleTransition(role, from, to, requestType),
  );
}
