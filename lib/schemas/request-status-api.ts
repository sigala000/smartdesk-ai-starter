import { z } from "zod";
export const statusReferenceSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{2,10}-\d{4}-\d{6}$/);
export const statusChallengeSchema = z
  .object({
    organizationSlug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(100),
    referenceNumber: statusReferenceSchema,
    phone: z
      .string()
      .trim()
      .regex(/^\+[1-9]\d{7,14}$/),
  })
  .strict();
export const statusVerifySchema = z
  .object({
    challengeId: z.uuid(),
    code: z.string().regex(/^\d{6}$/),
    conversationId: z.uuid().optional(),
  })
  .strict();
export const statusTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
