import { can } from "@/lib/auth/permissions";
import { failure, success, type Result } from "@/lib/core/result";
import {
  ATTACHMENT_DOWNLOAD_TTL_SECONDS,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_UPLOAD_TTL_SECONDS,
  attachmentSha256,
  createAttachmentIdentity,
  detectAttachmentMimeType,
  filenameMatchesMimeType,
  sanitizeAttachmentFilename,
  type AttachmentTarget,
} from "@/lib/domain/attachments";
import type {
  AttachmentDto,
  AttachmentUploadAuthorization,
} from "@/lib/dto/attachment-dto";
import type {
  AttachmentAccess,
  AttachmentRecord,
  AttachmentRepository,
} from "@/lib/repositories/attachment-repository";
import type { AttachmentPresignInput } from "@/lib/schemas/attachment-api";
import {
  NotConfiguredAttachmentScanner,
  type AttachmentScanner,
} from "@/lib/services/attachment-scanner";

export type AttachmentErrorCode =
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "invalid_file_type"
  | "invalid_file_size"
  | "invalid_file_content"
  | "invalid_filename"
  | "upload_expired"
  | "attachment_not_ready"
  | "scan_unavailable"
  | "storage_unavailable"
  | "internal_error";
export type AttachmentError = Readonly<{
  code: AttachmentErrorCode;
  message: string;
}>;

const messages: Record<AttachmentErrorCode, string> = {
  forbidden: "You are not authorized to access this attachment.",
  not_found: "Attachment not found.",
  conflict: "The attachment changed. Refresh and try again.",
  rate_limited: "Too many upload attempts. Please wait and try again.",
  invalid_file_type: "Choose a JPEG, PNG, or PDF file.",
  invalid_file_size: "Choose a file no larger than 10 MiB.",
  invalid_file_content: "The file content does not match its file type.",
  invalid_filename: "The filename is invalid.",
  upload_expired: "The upload expired. Choose the file and try again.",
  attachment_not_ready: "The attachment is not available.",
  scan_unavailable: "File safety scanning is temporarily unavailable.",
  storage_unavailable: "File storage is temporarily unavailable.",
  internal_error: "The attachment operation could not be completed.",
};
const error = (code: AttachmentErrorCode): AttachmentError => ({
  code,
  message: messages[code],
});

function dto(row: AttachmentRecord): AttachmentDto {
  return {
    id: row.id,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
  };
}

export class AttachmentService {
  constructor(
    private readonly repository: AttachmentRepository,
    private readonly scanner: AttachmentScanner = new NotConfiguredAttachmentScanner(),
    private readonly allowUnscanned = false,
  ) {}

  private async targetContext(
    access: AttachmentAccess,
    target: AttachmentTarget,
  ) {
    if (access.kind === "customer") {
      if (target.kind !== "conversation" || target.id !== access.conversationId)
        return failure(error("not_found"));
      const authorized = await this.repository.authorizeConversation(
        target.id,
        access.tokenDigest,
      );
      return authorized.ok
        ? success({
            organizationId: authorized.value.organizationId,
            memberId: null,
          })
        : failure(
            error(
              authorized.code === "internal_error"
                ? "internal_error"
                : "not_found",
            ),
          );
    }
    if (!can(access.context.membership.role, "attachments:create"))
      return failure(error("forbidden"));
    if (target.kind !== "request") return failure(error("forbidden"));
    const organizationId = access.context.organization.id;
    if (!(await this.repository.authorizeRequest(organizationId, target.id)))
      return failure(error("not_found"));
    return success({ organizationId, memberId: access.context.membership.id });
  }

  private async authorizeRecord(
    access: AttachmentAccess,
    attachmentId: string,
  ) {
    let organizationId: string;
    if (access.kind === "customer") {
      const authorized = await this.repository.authorizeConversation(
        access.conversationId,
        access.tokenDigest,
      );
      if (!authorized.ok)
        return failure(
          error(
            authorized.code === "internal_error"
              ? "internal_error"
              : "not_found",
          ),
        );
      organizationId = authorized.value.organizationId;
    } else organizationId = access.context.organization.id;
    const found = await this.repository.find(organizationId, attachmentId);
    if (!found.ok) return failure(error("internal_error"));
    if (!found.value) return failure(error("not_found"));
    const row = found.value;
    if (access.kind === "customer") {
      if (row.conversationId !== access.conversationId)
        return failure(error("not_found"));
    } else {
      if (
        !row.requestId ||
        !can(access.context.membership.role, "attachments:view") ||
        !(await this.repository.authorizeRequest(organizationId, row.requestId))
      )
        return failure(error("not_found"));
    }
    return success(row);
  }

  async initiate(
    access: AttachmentAccess,
    input: AttachmentPresignInput,
  ): Promise<Result<AttachmentUploadAuthorization, AttachmentError>> {
    const filename = sanitizeAttachmentFilename(input.filename);
    if (!filename) return failure(error("invalid_filename"));
    if (!filenameMatchesMimeType(filename, input.mimeType))
      return failure(error("invalid_file_type"));
    if (input.sizeBytes < 1 || input.sizeBytes > ATTACHMENT_MAX_BYTES)
      return failure(error("invalid_file_size"));
    const target: AttachmentTarget =
      input.target.kind === "conversation"
        ? { kind: "conversation", id: input.target.conversationId }
        : { kind: "request", id: input.target.requestId };
    const context = await this.targetContext(access, target);
    if (!context.ok) return context;
    if (
      !(await this.repository.consumeRateLimit(
        context.value.organizationId,
        access.kind === "customer"
          ? access.subjectDigest
          : attachmentSha256(
              new TextEncoder().encode(access.context.membership.id),
            ),
      ))
    )
      return failure(error("rate_limited"));
    const existing = await this.repository.findByClientUpload(
      context.value.organizationId,
      input.clientUploadId,
    );
    if (!existing.ok) return failure(error("internal_error"));
    let row = existing.value;
    if (row) {
      if (
        row.filename !== filename ||
        row.mimeType !== input.mimeType ||
        row.sizeBytes !== input.sizeBytes ||
        row.conversationId !==
          (target.kind === "conversation" ? target.id : null) ||
        row.requestId !== (target.kind === "request" ? target.id : null)
      )
        return failure(error("conflict"));
      if (
        row.status !== "pending" ||
        !row.expiresAt ||
        new Date(row.expiresAt) <= new Date()
      )
        return failure(error("upload_expired"));
    } else {
      const identity = createAttachmentIdentity(
        context.value.organizationId,
        target,
        input.mimeType,
      );
      const expiresAt = new Date(
        Date.now() + ATTACHMENT_UPLOAD_TTL_SECONDS * 1000,
      ).toISOString();
      const created = await this.repository.createPending({
        ...identity,
        organizationId: context.value.organizationId,
        target,
        clientUploadId: input.clientUploadId,
        filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        uploadedByMemberId: context.value.memberId,
        uploadedByType: access.kind,
        expiresAt,
      });
      if (!created.ok)
        return failure(
          error(created.code === "conflict" ? "conflict" : "internal_error"),
        );
      row = created.value;
    }
    const signed = await this.repository.signUpload(row.path);
    if (!signed.ok) return failure(error("storage_unavailable"));
    return success({
      attachment: dto(row),
      path: signed.value.path,
      token: signed.value.token,
      completionExpiresAt: row.expiresAt ?? new Date().toISOString(),
    });
  }

  async complete(
    access: AttachmentAccess,
    attachmentId: string,
  ): Promise<Result<AttachmentDto, AttachmentError>> {
    const authorized = await this.authorizeRecord(access, attachmentId);
    if (!authorized.ok) return authorized;
    if (authorized.value.status === "active")
      return success(dto(authorized.value));
    if (authorized.value.status !== "pending")
      return failure(error("attachment_not_ready"));
    if (
      !authorized.value.expiresAt ||
      new Date(authorized.value.expiresAt) <= new Date()
    ) {
      await this.repository.reject(
        authorized.value.organizationId,
        attachmentId,
        "upload_expired",
      );
      return failure(error("upload_expired"));
    }
    const validating = await this.repository.beginValidation(
      authorized.value.organizationId,
      attachmentId,
    );
    if (!validating.ok) return failure(error("conflict"));
    const object = await this.repository.downloadObject(validating.value.path);
    if (!object.ok) {
      await this.repository.markDeletionPending(
        validating.value.organizationId,
        attachmentId,
      );
      return failure(error("storage_unavailable"));
    }
    const bytes = new Uint8Array(await object.value.arrayBuffer());
    const detected = detectAttachmentMimeType(bytes);
    if (
      bytes.length < 1 ||
      bytes.length > ATTACHMENT_MAX_BYTES ||
      bytes.length !== validating.value.sizeBytes
    ) {
      await this.repository.reject(
        validating.value.organizationId,
        attachmentId,
        "invalid_file_size",
      );
      if (!(await this.repository.removeObject(validating.value.path)))
        await this.repository.markDeletionPending(
          validating.value.organizationId,
          attachmentId,
        );
      return failure(error("invalid_file_size"));
    }
    if (
      detected !== validating.value.mimeType ||
      (object.value.type && object.value.type !== validating.value.mimeType)
    ) {
      await this.repository.reject(
        validating.value.organizationId,
        attachmentId,
        "invalid_file_content",
      );
      if (!(await this.repository.removeObject(validating.value.path)))
        await this.repository.markDeletionPending(
          validating.value.organizationId,
          attachmentId,
        );
      return failure(error("invalid_file_content"));
    }
    const scan = await this.scanner.scan(bytes);
    if (scan.status === "not_scanned" && !this.allowUnscanned) {
      await this.repository.reject(
        validating.value.organizationId,
        attachmentId,
        "scan_unavailable",
      );
      if (!(await this.repository.removeObject(validating.value.path)))
        await this.repository.markDeletionPending(
          validating.value.organizationId,
          attachmentId,
        );
      return failure(error("scan_unavailable"));
    }
    if (scan.status === "infected" || scan.status === "failed") {
      await this.repository.reject(
        validating.value.organizationId,
        attachmentId,
        scan.status === "infected" ? "malware_detected" : "scan_failed",
      );
      if (!(await this.repository.removeObject(validating.value.path)))
        await this.repository.markDeletionPending(
          validating.value.organizationId,
          attachmentId,
        );
      return failure(error("invalid_file_content"));
    }
    const active = await this.repository.activate(
      validating.value.organizationId,
      attachmentId,
      bytes.length,
      attachmentSha256(bytes),
    );
    return active.ok
      ? success(dto(active.value))
      : failure(error("internal_error"));
  }

  async listConversation(
    access: Extract<AttachmentAccess, { kind: "customer" }>,
  ) {
    const authorized = await this.repository.authorizeConversation(
      access.conversationId,
      access.tokenDigest,
    );
    if (!authorized.ok)
      return failure(
        error(
          authorized.code === "internal_error" ? "internal_error" : "not_found",
        ),
      );
    const result = await this.repository.listConversation(
      authorized.value.organizationId,
      access.conversationId,
    );
    return result.ok ? success(result.value) : failure(error("internal_error"));
  }

  async download(access: AttachmentAccess, attachmentId: string) {
    const authorized = await this.authorizeRecord(access, attachmentId);
    if (!authorized.ok) return authorized;
    if (authorized.value.status !== "active")
      return failure(error("attachment_not_ready"));
    const signed = await this.repository.signDownload(authorized.value.path);
    return signed.ok
      ? success({
          url: signed.value.signedUrl,
          expiresIn: ATTACHMENT_DOWNLOAD_TTL_SECONDS,
        })
      : failure(error("storage_unavailable"));
  }

  async invalidate(access: AttachmentAccess, attachmentId: string) {
    const authorized = await this.authorizeRecord(access, attachmentId);
    if (!authorized.ok) return authorized;
    if (
      access.kind === "employee" &&
      !can(access.context.membership.role, "attachments:invalidate")
    )
      return failure(error("forbidden"));
    const invalidated = await this.repository.invalidate(
      authorized.value.organizationId,
      attachmentId,
    );
    if (!invalidated.ok) return failure(error("conflict"));
    const removed = await this.repository.removeObject(authorized.value.path);
    if (!removed) {
      await this.repository.markDeletionPending(
        authorized.value.organizationId,
        attachmentId,
      );
      return failure(error("storage_unavailable"));
    }
    await this.repository.markDeleted(
      authorized.value.organizationId,
      attachmentId,
    );
    return success(null);
  }
}
