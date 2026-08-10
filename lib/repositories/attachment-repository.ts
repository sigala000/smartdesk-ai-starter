import type { SupabaseClient } from "@supabase/supabase-js";

import type { EmployeeAccessContext } from "@/lib/auth/access-records";
import type {
  AttachmentMimeType,
  AttachmentTarget,
} from "@/lib/domain/attachments";
import type { AttachmentDto } from "@/lib/dto/attachment-dto";
import type { Database } from "@/lib/supabase/database.types";

export type AttachmentAccess =
  | Readonly<{
      kind: "customer";
      conversationId: string;
      tokenDigest: string;
      subjectDigest: string;
    }>
  | Readonly<{
      kind: "employee";
      context: EmployeeAccessContext;
    }>;

export type AttachmentRecord = AttachmentDto &
  Readonly<{
    organizationId: string;
    conversationId: string | null;
    requestId: string | null;
    path: string;
    status: string;
    expiresAt: string | null;
    clientUploadId: string;
  }>;

export type AttachmentRepositoryResult<T> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; code: string }>;

export interface AttachmentRepository {
  consumeRateLimit(
    organizationId: string,
    subjectDigest: string,
  ): Promise<boolean>;
  authorizeConversation(
    conversationId: string,
    tokenDigest: string,
  ): Promise<AttachmentRepositoryResult<{ organizationId: string }>>;
  authorizeRequest(organizationId: string, requestId: string): Promise<boolean>;
  findByClientUpload(
    organizationId: string,
    clientUploadId: string,
  ): Promise<AttachmentRepositoryResult<AttachmentRecord | null>>;
  createPending(
    input: Readonly<{
      id: string;
      organizationId: string;
      target: AttachmentTarget;
      clientUploadId: string;
      filename: string;
      mimeType: AttachmentMimeType;
      sizeBytes: number;
      path: string;
      uploadedByMemberId: string | null;
      uploadedByType: "customer" | "employee";
      expiresAt: string;
    }>,
  ): Promise<AttachmentRepositoryResult<AttachmentRecord>>;
  signUpload(
    path: string,
  ): Promise<AttachmentRepositoryResult<{ path: string; token: string }>>;
  find(
    organizationId: string,
    attachmentId: string,
  ): Promise<AttachmentRepositoryResult<AttachmentRecord | null>>;
  beginValidation(
    organizationId: string,
    attachmentId: string,
  ): Promise<AttachmentRepositoryResult<AttachmentRecord>>;
  downloadObject(path: string): Promise<AttachmentRepositoryResult<Blob>>;
  activate(
    organizationId: string,
    attachmentId: string,
    actualSize: number,
    sha256: string,
  ): Promise<AttachmentRepositoryResult<AttachmentRecord>>;
  reject(
    organizationId: string,
    attachmentId: string,
    code: string,
  ): Promise<void>;
  listConversation(
    organizationId: string,
    conversationId: string,
  ): Promise<AttachmentRepositoryResult<readonly AttachmentDto[]>>;
  signDownload(
    path: string,
  ): Promise<AttachmentRepositoryResult<{ signedUrl: string }>>;
  invalidate(
    organizationId: string,
    attachmentId: string,
  ): Promise<AttachmentRepositoryResult<null>>;
  markDeletionPending(
    organizationId: string,
    attachmentId: string,
  ): Promise<void>;
  markDeleted(organizationId: string, attachmentId: string): Promise<void>;
  removeObject(path: string): Promise<boolean>;
}

export type AttachmentAuthorizationClient = SupabaseClient<Database>;
