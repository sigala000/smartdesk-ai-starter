import { z } from "zod";

export const completeEmbeddedSignupSchema = z.object({
  state: z.string().min(32).max(256),
  code: z.string().min(8).max(4096),
  wabaId: z.string().regex(/^\d{5,32}$/),
  phoneNumberId: z.string().regex(/^\d{5,32}$/),
});
