import type { HandoffPriority, HandoffStatus } from "@/lib/domain/handoffs";

export type HandoffSummary = Readonly<{
  id: string;
  conversationId: string;
  requestId: string | null;
  requestReference: string | null;
  status: HandoffStatus;
  priority: HandoffPriority;
  reason: string;
  assignedMemberId: string | null;
  assignedMemberName: string | null;
  requestedAt: string;
  updatedAt: string;
}>;

export type HandoffDetail = HandoffSummary &
  Readonly<{
    customerName: string | null;
    messages: readonly Readonly<{
      id: string;
      senderType: "customer" | "assistant" | "employee";
      content: string;
      createdAt: string;
    }>[];
  }>;
