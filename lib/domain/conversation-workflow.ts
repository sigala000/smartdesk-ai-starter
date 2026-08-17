import type { PublicDraft } from "@/lib/dto/public-conversation-dto";

export const publicActions = [
  "request_quotation",
  "request_site_visit",
  "ask_about_services",
  "check_request_status",
  "report_problem",
  "speak_to_employee",
] as const;
export type PublicAction = (typeof publicActions)[number];

export const editableFields = [
  "service",
  "customer_name",
  "phone",
  "description",
  "location",
  "email",
  "preferred_start_date",
  "budget",
] as const;
export type EditableField = (typeof editableFields)[number];

export type WorkflowUpdate = Readonly<{
  values: Partial<PublicDraft>;
  reply: string;
}>;

export const openingMessage =
  "Hello, I’m BuildPro Cameroon’s virtual assistant. I can guide you through a request one question at a time.";

export function promptForStage(stage: PublicDraft["stage"]): string {
  const prompts: Record<PublicDraft["stage"], string> = {
    choose_action: "What would you like help with?",
    choose_service: "Which BuildPro service do you need?",
    collect_name: "What is your full name?",
    collect_phone: "What contact number should BuildPro use?",
    confirm_phone: "Please confirm that this contact number belongs to you.",
    collect_description: "Please briefly describe the work you need.",
    collect_location: "Where is the project located?",
    collect_email:
      "What is your email address? You may skip this optional question.",
    collect_start:
      "When would you prefer the work to start? You may skip this optional question.",
    collect_budget:
      "What budget range do you have in XAF? You may skip this optional question.",
    review: "Please review your request summary before confirming.",
    edit_menu: "Which field would you like to edit?",
    confirmed: "Your request has been submitted.",
    cancelled: "This draft has been cancelled.",
  };
  return prompts[stage];
}

export function applyAction(action: PublicAction): WorkflowUpdate {
  if (action === "request_quotation")
    return {
      values: {
        intent: action,
        requestType: "quotation",
        stage: "choose_service",
      },
      reply: promptForStage("choose_service"),
    };
  if (action === "request_site_visit")
    return {
      values: {
        intent: action,
        requestType: "site_visit",
        stage: "choose_service",
      },
      reply: promptForStage("choose_service"),
    };
  if (action === "report_problem")
    return {
      values: {
        intent: action,
        requestType: "support",
        stage: "choose_service",
      },
      reply: promptForStage("choose_service"),
    };
  if (action === "ask_about_services")
    return {
      values: { intent: action, stage: "choose_action" },
      reply:
        "These are BuildPro’s currently available services. Choose Request a quotation when you are ready.",
    };
  if (action === "check_request_status")
    return {
      values: { intent: action, stage: "choose_action" },
      reply:
        "For your privacy, verify your confirmed contact number on the secure request status page. A reference alone never reveals request information.",
    };
  return {
    values: { intent: action, stage: "choose_action" },
    reply:
      "I can record your request, but I cannot claim that an employee has joined. Please choose a request option or contact BuildPro directly.",
  };
}

export function nextRequiredStage(draft: PublicDraft): PublicDraft["stage"] {
  if (!draft.serviceId) return "choose_service";
  if (!draft.customerName) return "collect_name";
  if (!draft.phone) return "collect_phone";
  if (!draft.phoneConfirmedAt) return "confirm_phone";
  if (!draft.description) return "collect_description";
  if (!draft.location) return "collect_location";
  if (draft.email === undefined) return "collect_email";
  if (draft.preferredStartDate === undefined) return "collect_start";
  if (draft.budgetMin === undefined || draft.budgetMax === undefined)
    return "collect_budget";
  return "review";
}

export function isComplete(draft: PublicDraft): boolean {
  return Boolean(
    draft.requestType &&
    draft.serviceId &&
    draft.customerName &&
    draft.phone &&
    draft.phoneConfirmedAt &&
    draft.description &&
    draft.location,
  );
}

export function normalizeCameroonPhone(value: string): string | null {
  const compact = value.replace(/[\s().-]/g, "");
  const normalized = compact.startsWith("00237")
    ? `+237${compact.slice(5)}`
    : compact.startsWith("237")
      ? `+${compact}`
      : compact.startsWith("6")
        ? `+237${compact}`
        : compact;
  return /^\+2376\d{8}$/.test(normalized) ? normalized : null;
}
