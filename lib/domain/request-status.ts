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

export function customerStatusCopy(status: RequestStatus) {
  const groups: Record<RequestStatus, readonly [string, string, string]> = {
    draft: [
      "Draft",
      "Your request has not been submitted.",
      "Complete and confirm the request.",
    ],
    new: [
      "Received",
      "BuildPro has received your request.",
      "The team will review it.",
    ],
    awaiting_customer_information: [
      "Information required",
      "BuildPro needs more information from you.",
      "Reply to the latest company question.",
    ],
    awaiting_assessment: [
      "Under assessment",
      "Your request is being assessed.",
      "BuildPro will contact you if more information is needed.",
    ],
    site_visit_proposed: [
      "Site visit proposed",
      "A site visit has been proposed.",
      "Wait for the company to confirm the arrangements.",
    ],
    site_visit_scheduled: [
      "Site visit scheduled",
      "A site visit has been scheduled.",
      "Follow the confirmed arrangements from BuildPro.",
    ],
    assessment_completed: [
      "Assessment completed",
      "The initial assessment is complete.",
      "The team will continue processing your request.",
    ],
    quotation_preparing: [
      "Quotation in preparation",
      "An authorized employee is preparing the quotation.",
      "No action is required unless BuildPro contacts you.",
    ],
    quotation_sent: [
      "Quotation available",
      "BuildPro has made a quotation available.",
      "Review the quotation through the approved company channel.",
    ],
    quotation_revision_requested: [
      "Quotation under revision",
      "A quotation revision has been requested.",
      "The team will provide an update.",
    ],
    quotation_accepted: [
      "Quotation accepted",
      "The quotation decision has been recorded.",
      "BuildPro will confirm the next approved step.",
    ],
    quotation_rejected: [
      "Quotation declined",
      "The quotation was declined.",
      "Contact BuildPro if you need further assistance.",
    ],
    scheduled: [
      "Work scheduled",
      "The request is scheduled.",
      "Follow the arrangements confirmed by BuildPro.",
    ],
    in_progress: [
      "In progress",
      "Work on the request is in progress.",
      "Contact BuildPro if you need assistance.",
    ],
    awaiting_client_validation: [
      "Awaiting your validation",
      "BuildPro is waiting for customer validation.",
      "Contact BuildPro to confirm completion or report an issue.",
    ],
    completed: [
      "Completed",
      "The request has been marked completed.",
      "Contact BuildPro if something remains unresolved.",
    ],
    cancelled: [
      "Cancelled",
      "The request has been cancelled.",
      "Contact BuildPro if you need to start a new request.",
    ],
    unsupported: [
      "Unable to proceed",
      "BuildPro cannot proceed with this request as submitted.",
      "Contact BuildPro for clarification or alternatives.",
    ],
    inactive: [
      "Inactive",
      "The request is currently inactive.",
      "Contact BuildPro to continue the request.",
    ],
    closed: [
      "Closed",
      "The request is closed.",
      "Contact BuildPro if you need further help.",
    ],
  };
  const [displayStatus, lastUpdate, nextAction] = groups[status];
  return { displayStatus, lastUpdate, nextAction };
}
