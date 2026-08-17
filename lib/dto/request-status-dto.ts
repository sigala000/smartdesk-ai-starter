import {
  customerStatusCopy,
  type RequestStatus,
} from "@/lib/domain/request-status";
export type CustomerRequestStatus = Readonly<{
  referenceNumber: string;
  serviceName: string;
  displayStatus: string;
  lastUpdate: string;
  nextAction: string;
  updatedAt: string;
}>;
export function toCustomerRequestStatus(row: {
  referenceNumber: string;
  serviceName: string | null;
  status: RequestStatus;
  updatedAt: string;
}): CustomerRequestStatus {
  return {
    referenceNumber: row.referenceNumber,
    serviceName: row.serviceName ?? "Service request",
    ...customerStatusCopy(row.status),
    updatedAt: row.updatedAt,
  };
}
