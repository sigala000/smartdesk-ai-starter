export const handoffStatuses = [
  "requested",
  "queued",
  "assigned",
  "active",
  "resolved",
  "cancelled",
] as const;
export type HandoffStatus = (typeof handoffStatuses)[number];

export const handoffPriorities = ["normal", "high", "urgent"] as const;
export type HandoffPriority = (typeof handoffPriorities)[number];

export type EscalationReason =
  | "explicit_human_request"
  | "safety_concern"
  | "suspected_fraud"
  | "payment_dispute"
  | "serious_complaint"
  | "unsupported_information";

export type EscalationDecision = Readonly<{
  reasonCode: EscalationReason;
  priority: HandoffPriority;
  reason: string;
}>;

const urgentSafety =
  /\b(?:fire|smoke|collapse|collapsed|collapsing|crack(?:ed|ing)|leaning wall|injur(?:y|ed)|hurt|trapped|unsafe|danger|threat|electrocut(?:ed|ion)?|electric shock|shocked|exposed wire|gas leak|gas smell|smell(?:s|ing)? (?:of )?gas)\b/i;
const fraud =
  /\b(?:fraud|scam|fake invoice|brib(?:e|ery)|stolen payment|impersonat(?:e|ed|ion|ing)|unauthori[sz]ed (?:charge|payment)|did(?: not|n't) authori[sz]e)\b/i;
const payment =
  /\b(?:payment dispute|charged twice|double charged|refund dispute|refund (?:refused|withheld|overdue)|wrong charge|billing dispute|paid but (?:no|nothing)|disputed invoice)\b/i;
const complaint =
  /\b(?:formal complaint|serious complaint|extremely angry|unacceptable (?:service|conduct)|report misconduct|negligence|gross misconduct|repeatedly ignored)\b/i;
const human =
  /\b(?:speak|talk|connect|transfer).{0,24}\b(?:human|person|employee|agent|officer|representative)\b|\b(?:human|employee) support\b/i;

export function classifyEscalation(message: string): EscalationDecision | null {
  if (urgentSafety.test(message))
    return {
      reasonCode: "safety_concern",
      priority: "urgent",
      reason: "Customer reported a possible immediate safety concern.",
    };
  if (fraud.test(message))
    return {
      reasonCode: "suspected_fraud",
      priority: "high",
      reason:
        "Customer reported suspected fraud or an unauthorized transaction.",
    };
  if (payment.test(message))
    return {
      reasonCode: "payment_dispute",
      priority: "high",
      reason: "Customer reported a payment dispute.",
    };
  if (complaint.test(message))
    return {
      reasonCode: "serious_complaint",
      priority: "high",
      reason: "Customer requested escalation of a serious complaint.",
    };
  if (human.test(message))
    return {
      reasonCode: "explicit_human_request",
      priority: "normal",
      reason: "Customer explicitly requested human support.",
    };
  return null;
}

export function canTransitionHandoff(from: HandoffStatus, to: HandoffStatus) {
  return (
    (from === "requested" && (to === "queued" || to === "cancelled")) ||
    (from === "queued" && (to === "assigned" || to === "cancelled")) ||
    (from === "assigned" &&
      (to === "assigned" || to === "active" || to === "cancelled")) ||
    (from === "active" && (to === "resolved" || to === "cancelled"))
  );
}
