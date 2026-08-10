import { createHash, randomUUID } from "node:crypto";

export const ATTACHMENT_BUCKET = "private-attachments";
export const ATTACHMENT_MAX_BYTES = 10_485_760;
export const ATTACHMENT_UPLOAD_TTL_SECONDS = 600;
export const ATTACHMENT_DOWNLOAD_TTL_SECONDS = 60;
export const allowedAttachmentMimeTypes = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;

export type AttachmentMimeType = (typeof allowedAttachmentMimeTypes)[number];
export type AttachmentTarget =
  | Readonly<{ kind: "conversation"; id: string }>
  | Readonly<{ kind: "request"; id: string }>;

const extensions: Record<AttachmentMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

export function sanitizeAttachmentFilename(value: string): string | null {
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (
    !cleaned ||
    cleaned.length > 255 ||
    cleaned.includes("/") ||
    cleaned.includes("\\")
  )
    return null;
  return cleaned;
}

export function filenameMatchesMimeType(
  filename: string,
  mimeType: AttachmentMimeType,
) {
  const extension = filename.toLowerCase().split(".").pop();
  return mimeType === "image/jpeg"
    ? extension === "jpg" || extension === "jpeg"
    : extension === extensions[mimeType];
}

export function createAttachmentIdentity(
  organizationId: string,
  target: AttachmentTarget,
  mimeType: AttachmentMimeType,
) {
  const id = randomUUID();
  return {
    id,
    path: `${organizationId}/${target.kind}/${target.id}/${id}.${extensions[mimeType]}`,
  };
}

export function detectAttachmentMimeType(
  bytes: Uint8Array,
): AttachmentMimeType | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    )
  )
    return "image/png";
  if (
    bytes.length >= 5 &&
    String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-"
  )
    return "application/pdf";
  return null;
}

export function attachmentSha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}
