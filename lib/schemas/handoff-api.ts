import { z } from "zod";

export const requestHandoffSchema = z
  .object({
    clientRequestId: z.uuid(),
    reason: z
      .string()
      .trim()
      .min(3)
      .max(500)
      .default("Customer requested human support."),
  })
  .strict();

export const handoffListQuerySchema = z
  .object({
    status: z
      .enum(["open", "queued", "assigned", "active", "resolved", "cancelled"])
      .default("open"),
  })
  .strict();

export const handoffAssignSchema = z.object({ memberId: z.uuid() }).strict();
export const handoffMessageSchema = z
  .object({
    clientMessageId: z.uuid(),
    message: z.string().trim().min(1).max(2000),
  })
  .strict();
export const handoffResolveSchema = z
  .object({
    resolution: z.string().trim().min(3).max(1000),
    resumeAutomation: z.boolean(),
  })
  .strict();

export type RequestHandoffInput = z.infer<typeof requestHandoffSchema>;
export type HandoffListQuery = z.infer<typeof handoffListQuerySchema>;
export type HandoffAssignInput = z.infer<typeof handoffAssignSchema>;
export type HandoffMessageInput = z.infer<typeof handoffMessageSchema>;
export type HandoffResolveInput = z.infer<typeof handoffResolveSchema>;
