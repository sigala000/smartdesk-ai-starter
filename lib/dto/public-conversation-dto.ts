import type { PublicAction } from "@/lib/domain/conversation-workflow";
import type { RequestType } from "@/lib/domain/requests";

export type PublicStage =
  | "choose_action"
  | "choose_service"
  | "collect_name"
  | "collect_phone"
  | "confirm_phone"
  | "collect_description"
  | "collect_location"
  | "collect_email"
  | "collect_start"
  | "collect_budget"
  | "review"
  | "edit_menu"
  | "confirmed"
  | "cancelled";

export type PublicDraft = {
  intent: PublicAction | null;
  requestType: Extract<
    RequestType,
    "quotation" | "site_visit" | "support"
  > | null;
  serviceId: string | null;
  serviceName: string | null;
  customerName: string | null;
  phone: string | null;
  phoneConfirmedAt: string | null;
  email: string | null | undefined;
  description: string | null;
  location: string | null;
  preferredStartDate: string | null | undefined;
  budgetMin: number | null | undefined;
  budgetMax: number | null | undefined;
  stage: PublicStage;
  version: number;
};

export type PublicConversationView = Readonly<{
  id: string;
  organizationName: string;
  state: string;
  handoffStatus?: "queued" | "assigned" | "active" | null;
  draft: PublicDraft;
  prompt: string;
  services: readonly Readonly<{
    id: string;
    name: string;
    description: string | null;
  }>[];
  messages: readonly Readonly<{
    id: string;
    senderType: "customer" | "assistant" | "employee";
    content: string;
    createdAt: string;
  }>[];
}>;
