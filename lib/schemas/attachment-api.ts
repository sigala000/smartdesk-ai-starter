import { z } from "zod";

import {
  ATTACHMENT_MAX_BYTES,
  allowedAttachmentMimeTypes,
} from "@/lib/domain/attachments";

const targetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("conversation"), conversationId: z.uuid() }),
  z.object({ kind: z.literal("request"), requestId: z.uuid() }),
]);

export const attachmentPresignSchema = z.object({
  target: targetSchema,
  clientUploadId: z.uuid(),
  filename: z.string().min(1).max(255),
  mimeType: z.enum(allowedAttachmentMimeTypes),
  sizeBytes: z.number().int().min(1).max(ATTACHMENT_MAX_BYTES),
});

export const attachmentIdSchema = z.uuid();

export type AttachmentPresignInput = z.infer<typeof attachmentPresignSchema>;
