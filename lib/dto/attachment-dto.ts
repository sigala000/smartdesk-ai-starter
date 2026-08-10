import type { AttachmentMimeType } from "@/lib/domain/attachments";

export type AttachmentDto = Readonly<{
  id: string;
  filename: string;
  mimeType: AttachmentMimeType;
  sizeBytes: number;
  createdAt: string;
}>;

export type AttachmentUploadAuthorization = Readonly<{
  attachment: AttachmentDto;
  path: string;
  token: string;
  expiresAt: string;
}>;
