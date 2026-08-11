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
    cleaned.includes("\\") ||
    /[\u202a-\u202e\u2066-\u2069]/u.test(cleaned)
  )
    return null;
  return cleaned;
}

export function filenameMatchesMimeType(
  filename: string,
  mimeType: AttachmentMimeType,
) {
  const parts = filename.toLowerCase().split(".");
  const extension = parts.pop();
  const dangerousInnerExtensions = new Set([
    "bat",
    "cmd",
    "com",
    "exe",
    "hta",
    "html",
    "js",
    "jar",
    "msi",
    "ps1",
    "scr",
    "svg",
    "vbs",
  ]);
  if (parts.some((part) => dangerousInnerExtensions.has(part))) return false;
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
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9
  )
    return "image/jpeg";
  if (
    bytes.length >= 45 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    ) &&
    String.fromCharCode(...bytes.slice(12, 16)) === "IHDR" &&
    String.fromCharCode(...bytes.slice(-8, -4)) === "IEND"
  )
    return "image/png";
  if (bytes.length >= 12) {
    const start = String.fromCharCode(...bytes.slice(0, 5));
    const end = new TextDecoder("latin1").decode(bytes.slice(-1024));
    const lowered = new TextDecoder("latin1").decode(bytes).toLowerCase();
    if (
      start === "%PDF-" &&
      end.includes("%%EOF") &&
      !lowered.includes("<script") &&
      !lowered.includes("<html") &&
      !lowered.includes("javascript:")
    )
      return "application/pdf";
  }
  return null;
}

export function attachmentSha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}
