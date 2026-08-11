import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ATTACHMENT_BUCKET,
  ATTACHMENT_DOWNLOAD_TTL_SECONDS,
} from "@/lib/domain/attachments";
import type { AttachmentDto } from "@/lib/dto/attachment-dto";
import type {
  AttachmentAuthorizationClient,
  AttachmentRecord,
  AttachmentRepository,
} from "@/lib/repositories/attachment-repository";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
const fail = (code: string) => ({ ok: false as const, code });

type AttachmentRow = Database["public"]["Tables"]["attachments"]["Row"];

function mapRow(row: AttachmentRow): AttachmentRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    conversationId: row.conversation_id,
    requestId: row.request_id,
    filename: row.original_filename,
    mimeType: row.mime_type as AttachmentRecord["mimeType"],
    sizeBytes: Number(row.size_bytes),
    createdAt: row.created_at,
    path: row.storage_path,
    status: row.upload_status,
    expiresAt: row.upload_expires_at,
    clientUploadId: row.client_upload_id,
  };
}

export class SupabaseAttachmentRepository implements AttachmentRepository {
  constructor(
    private readonly admin: Client,
    private readonly authorizationClient?: AttachmentAuthorizationClient,
  ) {}

  async consumeRateLimit(organizationId: string, subjectDigest: string) {
    const result = await this.admin.rpc("consume_public_rate_limit", {
      p_action: "attachment_upload",
      p_limit: 10,
      p_organization_id: organizationId,
      p_subject_digest: subjectDigest,
      p_window_seconds: 900,
    });
    return !result.error && result.data === true;
  }

  async authorizeConversation(conversationId: string, tokenDigest: string) {
    const result = await this.admin
      .from("public_conversation_access")
      .select("organization_id,conversations!inner(state,request_id)")
      .eq("conversation_id", conversationId)
      .eq("token_digest", tokenDigest)
      .is("revoked_at", null)
      .is("read_disabled_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (result.error) return fail("internal_error");
    if (!result.data) return fail("not_found");
    const conversation = Array.isArray(result.data.conversations)
      ? result.data.conversations[0]
      : result.data.conversations;
    if (
      !conversation ||
      conversation.request_id ||
      conversation.state === "resolved" ||
      conversation.state === "closed"
    )
      return fail("not_found");
    return {
      ok: true as const,
      value: { organizationId: result.data.organization_id },
    };
  }

  async authorizeRequest(organizationId: string, requestId: string) {
    if (!this.authorizationClient) return false;
    const result = await this.authorizationClient
      .from("requests")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", requestId)
      .maybeSingle();
    return !result.error && Boolean(result.data);
  }

  async findByClientUpload(organizationId: string, clientUploadId: string) {
    const result = await this.admin
      .from("attachments")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("client_upload_id", clientUploadId)
      .maybeSingle();
    if (result.error) return fail("internal_error");
    return {
      ok: true as const,
      value: result.data ? mapRow(result.data) : null,
    };
  }

  async createPending(
    input: Parameters<AttachmentRepository["createPending"]>[0],
  ) {
    const result = await this.admin
      .from("attachments")
      .insert({
        id: input.id,
        organization_id: input.organizationId,
        conversation_id:
          input.target.kind === "conversation" ? input.target.id : null,
        request_id: input.target.kind === "request" ? input.target.id : null,
        message_id: null,
        storage_bucket: ATTACHMENT_BUCKET,
        storage_path: input.path,
        original_filename: input.filename,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        upload_status: "pending",
        scan_status: "not_scanned",
        upload_expires_at: input.expiresAt,
        client_upload_id: input.clientUploadId,
        uploaded_by_member_id: input.uploadedByMemberId,
        uploaded_by_type: input.uploadedByType,
      })
      .select("*")
      .single();
    if (result.error)
      return fail(
        result.error.code === "23505" ? "conflict" : "internal_error",
      );
    return { ok: true as const, value: mapRow(result.data) };
  }

  async signUpload(path: string) {
    const result = await this.admin.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });
    return result.error
      ? fail("storage_unavailable")
      : {
          ok: true as const,
          value: { path: result.data.path, token: result.data.token },
        };
  }

  async find(organizationId: string, attachmentId: string) {
    const result = await this.admin
      .from("attachments")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", attachmentId)
      .maybeSingle();
    if (result.error) return fail("internal_error");
    return {
      ok: true as const,
      value: result.data ? mapRow(result.data) : null,
    };
  }

  async beginValidation(organizationId: string, attachmentId: string) {
    const result = await this.admin
      .from("attachments")
      .update({ upload_status: "validating" })
      .eq("organization_id", organizationId)
      .eq("id", attachmentId)
      .eq("upload_status", "pending")
      .select("*")
      .maybeSingle();
    if (result.error) return fail("internal_error");
    if (!result.data) return fail("conflict");
    return { ok: true as const, value: mapRow(result.data) };
  }

  async downloadObject(path: string) {
    const result = await this.admin.storage
      .from(ATTACHMENT_BUCKET)
      .download(path);
    return result.error
      ? fail("storage_unavailable")
      : { ok: true as const, value: result.data };
  }

  async activate(
    organizationId: string,
    attachmentId: string,
    actualSize: number,
    sha256: string,
  ) {
    const result = await this.admin.rpc("activate_private_attachment", {
      p_actual_size: actualSize,
      p_attachment_id: attachmentId,
      p_organization_id: organizationId,
      p_sha256: sha256,
    });
    if (result.error) return fail("internal_error");
    const row = result.data[0];
    if (!row) return fail("internal_error");
    await this.admin.from("audit_events").insert({
      organization_id: organizationId,
      action: "attachment.activated",
      entity_type: "attachment",
      entity_id: attachmentId,
      metadata: { source: "attachment_service" },
    });
    return { ok: true as const, value: mapRow(row) };
  }

  async reject(organizationId: string, attachmentId: string, code: string) {
    await this.admin
      .from("attachments")
      .update({
        upload_status: "rejected",
        rejection_code: code,
        upload_expires_at: null,
      })
      .eq("organization_id", organizationId)
      .eq("id", attachmentId)
      .in("upload_status", ["pending", "validating"]);
  }

  async listConversation(organizationId: string, conversationId: string) {
    const result = await this.admin
      .from("attachments")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("conversation_id", conversationId)
      .eq("upload_status", "active")
      .order("created_at");
    if (result.error) return fail("internal_error");
    return {
      ok: true as const,
      value: result.data.map((row): AttachmentDto => {
        const record = mapRow(row);
        return {
          id: record.id,
          filename: record.filename,
          mimeType: record.mimeType,
          sizeBytes: record.sizeBytes,
          createdAt: record.createdAt,
        };
      }),
    };
  }

  async signDownload(path: string) {
    const result = await this.admin.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrl(path, ATTACHMENT_DOWNLOAD_TTL_SECONDS, {
        download: true,
      });
    return result.error
      ? fail("storage_unavailable")
      : { ok: true as const, value: { signedUrl: result.data.signedUrl } };
  }

  async invalidate(organizationId: string, attachmentId: string) {
    const result = await this.admin
      .from("attachments")
      .update({
        upload_status: "invalidation_pending",
        invalidated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", attachmentId)
      .eq("upload_status", "active")
      .select("id")
      .maybeSingle();
    if (result.error) return fail("internal_error");
    if (!result.data) return fail("conflict");
    await this.admin.from("audit_events").insert({
      organization_id: organizationId,
      action: "attachment.invalidated",
      entity_type: "attachment",
      entity_id: attachmentId,
      metadata: { source: "attachment_service" },
    });
    return { ok: true as const, value: null };
  }

  async removeObject(path: string) {
    const result = await this.admin.storage
      .from(ATTACHMENT_BUCKET)
      .remove([path]);
    return !result.error;
  }

  async markDeleted(organizationId: string, attachmentId: string) {
    await this.admin
      .from("attachments")
      .update({
        upload_status: "deleted",
        deleted_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", attachmentId)
      .in("upload_status", ["invalidation_pending", "deletion_pending"]);
  }

  async markDeletionPending(organizationId: string, attachmentId: string) {
    const timestamp = new Date().toISOString();
    await this.admin
      .from("attachments")
      .update({
        upload_status: "deletion_pending",
        invalidated_at: timestamp,
        upload_expires_at: timestamp,
      })
      .eq("organization_id", organizationId)
      .eq("id", attachmentId)
      .in("upload_status", ["validating", "rejected", "invalidation_pending"]);
  }
}
