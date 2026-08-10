export const requestStatuses = [
  "draft",
  "new",
  "awaiting_customer_information",
  "awaiting_assessment",
  "site_visit_proposed",
  "site_visit_scheduled",
  "assessment_completed",
  "quotation_preparing",
  "quotation_sent",
  "quotation_revision_requested",
  "quotation_accepted",
  "quotation_rejected",
  "scheduled",
  "in_progress",
  "awaiting_client_validation",
  "completed",
  "cancelled",
  "unsupported",
  "inactive",
  "closed",
] as const;

export type RequestStatus = (typeof requestStatuses)[number];

export const requestTypes = [
  "quotation",
  "site_visit",
  "service_question",
  "complaint",
  "support",
  "other",
] as const;

export type RequestType = (typeof requestTypes)[number];

export function isRequestType(value: string): value is RequestType {
  return requestTypes.some((type) => type === value);
}

export const requestPriorities = ["low", "normal", "high", "urgent"] as const;

export function isRequestStatus(value: string): value is RequestStatus {
  return requestStatuses.some((status) => status === value);
}

export function formatRequestStatus(status: RequestStatus): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
