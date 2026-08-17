import type { RequestStatus, RequestType } from "@/lib/domain/requests";
import type { AttachmentMimeType } from "@/lib/domain/attachments";

export type RequestListItem = Readonly<{
  id: string;
  referenceNumber: string;
  title: string;
  requestType: RequestType;
  priority: string;
  status: RequestStatus;
  customerName: string;
  serviceName: string;
  departmentName: string | null;
  assignedMemberName: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type RequestListResult = Readonly<{
  items: readonly RequestListItem[];
  nextCursor: string | null;
}>;

export type RequestStatusHistoryItem = Readonly<{
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedByName: string | null;
  changedByType: string;
  reason: string | null;
  source: string;
  createdAt: string;
}>;

export type AssignmentHistoryItem = Readonly<{
  id: string;
  departmentName: string | null;
  memberName: string | null;
  assignedByName: string | null;
  reason: string | null;
  assignedAt: string;
  unassignedAt: string | null;
}>;

export type InternalNoteItem = Readonly<{
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
}>;

export type EmployeeRequestDetail = RequestListItem &
  Readonly<{
    description: string | null;
    location: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    conversationId: string | null;
    messages: readonly Readonly<{
      id: string;
      senderType: "customer" | "assistant" | "employee";
      senderName: string | null;
      content: string;
      createdAt: string;
    }>[];
    attachments: readonly Readonly<{
      id: string;
      filename: string;
      mimeType: AttachmentMimeType;
      sizeBytes: number;
      createdAt: string;
      documentKind: "general" | "quotation";
      approvedAt: string | null;
    }>[];
    statusHistory: readonly RequestStatusHistoryItem[];
    assignmentHistory: readonly AssignmentHistoryItem[];
    internalNotes: readonly InternalNoteItem[];
    departments: readonly Readonly<{ id: string; name: string }>[];
    assignableMembers: readonly Readonly<{
      id: string;
      displayName: string;
      departmentId: string | null;
    }>[];
  }>;

export type CustomerSafeRequestData = Readonly<{
  referenceNumber: string;
  serviceName: string;
  status: RequestStatus;
  updatedAt: string;
}>;

export function toCustomerSafeRequest(
  detail: EmployeeRequestDetail,
): CustomerSafeRequestData {
  return {
    referenceNumber: detail.referenceNumber,
    serviceName: detail.serviceName,
    status: detail.status,
    updatedAt: detail.updatedAt,
  };
}
