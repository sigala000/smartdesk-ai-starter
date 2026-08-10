import { z } from "zod";

import {
  editableFields,
  publicActions,
} from "@/lib/domain/conversation-workflow";

export const createConversationSchema = z
  .object({
    organizationSlug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(100),
    locale: z.enum(["en"]).default("en"),
  })
  .strict();

export const publicMessageSchema = z.discriminatedUnion("kind", [
  z
    .object({
      clientMessageId: z.uuid(),
      kind: z.literal("action"),
      action: z.enum(publicActions),
    })
    .strict(),
  z
    .object({
      clientMessageId: z.uuid(),
      kind: z.literal("answer"),
      value: z.string().trim().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      clientMessageId: z.uuid(),
      kind: z.literal("skip"),
    })
    .strict(),
  z
    .object({
      clientMessageId: z.uuid(),
      kind: z.literal("cancel"),
    })
    .strict(),
  z
    .object({
      clientMessageId: z.uuid(),
      kind: z.literal("message"),
      message: z.string().trim().min(1).max(2000),
    })
    .strict(),
]);

export const editDraftSchema = z
  .object({
    field: z.enum(editableFields),
    value: z.string().trim().min(1).max(2000),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export const confirmRequestSchema = z
  .object({
    confirmation: z.literal(true),
    confirmationNonce: z.string().regex(/^[A-Za-z0-9_-]{32,200}$/),
    idempotencyKey: z.uuid(),
  })
  .strict();

export const conversationIdSchema = z.uuid();

export type PublicMessageInput = z.infer<typeof publicMessageSchema>;
export type EditDraftInput = z.infer<typeof editDraftSchema>;
export type ConfirmRequestInput = z.infer<typeof confirmRequestSchema>;
