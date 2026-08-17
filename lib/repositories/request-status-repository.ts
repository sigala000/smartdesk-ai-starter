import type { CustomerRequestStatus } from "@/lib/dto/request-status-dto";
export type StatusTarget = {
  organizationId: string;
  requestId: string;
  referenceNumber: string;
  phone: string;
  serviceName: string | null;
  status: string;
  updatedAt: string;
};
export type ChallengeRecord = {
  id: string;
  organizationId: string | null;
  requestId: string | null;
  expiresAt: string;
  created: boolean;
};
export interface RequestStatusRepository {
  findTarget(slug: string, reference: string): Promise<StatusTarget | null>;
  consumeRateLimit(
    organizationId: string | null,
    action: string,
    subjectDigest: string,
    limit: number,
    windowSeconds: number,
  ): Promise<boolean>;
  createChallenge(input: {
    id: string;
    organizationId: string | null;
    requestId: string | null;
    subjectDigest: string;
    codeDigest: string;
    expiresAt: string;
    maxAttempts: number;
    real: boolean;
    traceId: string;
  }): Promise<ChallengeRecord>;
  setDelivery(
    challengeId: string,
    accepted: boolean,
    traceId: string,
  ): Promise<void>;
  verify(input: {
    challengeId: string;
    codeDigest: string;
    tokenDigest: string;
    conversationTokenDigest: string | null;
    organizationId: string | null;
    conversationId: string | null;
    tokenTtlSeconds: number;
    lockoutSeconds: number;
    traceId: string;
  }): Promise<{ success: boolean; expiresAt: string | null }>;
  consumeStatus(
    tokenDigest: string,
    reference: string,
    traceId: string,
  ): Promise<CustomerRequestStatus | null>;
  consumeConversationStatus(
    organizationId: string,
    conversationId: string,
    reference: string,
    traceId: string,
  ): Promise<CustomerRequestStatus | null>;
}
