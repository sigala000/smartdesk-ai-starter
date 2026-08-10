"use client";

import { useEffect, useState, type ChangeEvent } from "react";

import {
  ATTACHMENT_MAX_BYTES,
  allowedAttachmentMimeTypes,
} from "@/lib/domain/attachments";
import type { AttachmentDto } from "@/lib/dto/attachment-dto";
import { createClient } from "@/lib/supabase/client";

type Target =
  | Readonly<{ kind: "conversation"; conversationId: string }>
  | Readonly<{ kind: "request"; requestId: string }>;
type ApiPayload = Record<string, unknown> & { error?: { message?: string } };

async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const payload = (await response.json().catch(() => ({}))) as ApiPayload;
  if (!response.ok)
    throw new Error(payload.error?.message ?? "The file operation failed.");
  return payload;
}

export function AttachmentUploader({
  target,
  initialAttachments = [],
  onBusyChange,
}: Readonly<{
  target: Target;
  initialAttachments?: readonly AttachmentDto[];
  onBusyChange?: (busy: boolean) => void;
}>) {
  const [attachments, setAttachments] =
    useState<readonly AttachmentDto[]>(initialAttachments);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const conversationId =
    target.kind === "conversation" ? target.conversationId : null;
  const conversationQuery = conversationId
    ? `?conversationId=${encodeURIComponent(conversationId)}`
    : "";

  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);
  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    void api(`/api/conversations/${conversationId}/attachments`)
      .then((payload) => {
        if (active)
          setAttachments(payload.attachments as readonly AttachmentDto[]);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [conversationId]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    if (
      !allowedAttachmentMimeTypes.includes(
        file.type as (typeof allowedAttachmentMimeTypes)[number],
      )
    ) {
      setError("Choose a JPEG, PNG, or PDF file.");
      return;
    }
    if (file.size < 1 || file.size > ATTACHMENT_MAX_BYTES) {
      setError("Choose a file no larger than 10 MiB.");
      return;
    }
    setBusy(true);
    setProgress("Preparing secure upload…");
    try {
      const authorization = await api("/api/attachments/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          clientUploadId: crypto.randomUUID(),
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });
      setProgress("Uploading file…");
      const storage = createClient().storage.from("private-attachments");
      const uploaded = await storage.uploadToSignedUrl(
        authorization.path as string,
        authorization.token as string,
        file,
        { contentType: file.type, upsert: false },
      );
      if (uploaded.error)
        throw new Error("The upload could not be completed. Please retry.");
      setProgress("Validating file…");
      const completed = await api(
        `/api/attachments/${(authorization.attachment as AttachmentDto).id}/complete${conversationQuery}`,
        { method: "POST" },
      );
      const attachment = completed.attachment as AttachmentDto;
      setAttachments((current) => [
        ...current.filter((item) => item.id !== attachment.id),
        attachment,
      ]);
      setProgress("Upload complete.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The upload failed safely. Please retry.",
      );
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  async function download(attachment: AttachmentDto) {
    setError(null);
    try {
      const payload = await api(
        `/api/attachments/${attachment.id}/download${conversationQuery}`,
        { method: "POST" },
      );
      const link = document.createElement("a");
      link.href = payload.url as string;
      link.rel = "noopener noreferrer";
      link.target = "_blank";
      link.click();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The download is unavailable.",
      );
    }
  }

  async function remove(attachment: AttachmentDto) {
    setError(null);
    try {
      await api(`/api/attachments/${attachment.id}${conversationQuery}`, {
        method: "DELETE",
      });
      setAttachments((current) =>
        current.filter((item) => item.id !== attachment.id),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The attachment could not be removed.",
      );
    }
  }

  return (
    <section className="attachment-panel">
      <div>
        <h3>Attachments</h3>
        <p className="attachment-help">
          JPEG, PNG, or PDF. Maximum 10 MiB. Files remain private.
        </p>
      </div>
      <label className="attachment-picker">
        <span>{busy ? "Uploading…" : "Choose a file"}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          disabled={busy}
          onChange={(event) => void upload(event)}
        />
      </label>
      {progress ? <p role="status">{progress}</p> : null}
      {error ? (
        <p className="form-message error-panel" role="alert">
          {error}
        </p>
      ) : null}
      {attachments.length ? (
        <ul className="attachment-list">
          {attachments.map((attachment) => (
            <li key={attachment.id}>
              <span>
                <strong>{attachment.filename}</strong>
                <small>
                  {Math.ceil(attachment.sizeBytes / 1024)} KB ·{" "}
                  {attachment.mimeType}
                </small>
              </span>
              <span className="attachment-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void download(attachment)}
                >
                  Download
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void remove(attachment)}
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">No attachments.</p>
      )}
    </section>
  );
}
