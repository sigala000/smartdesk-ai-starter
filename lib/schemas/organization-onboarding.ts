import { z } from "zod";

const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);

export const ownerRegistrationSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(12).max(128),
  fullName: z.string().trim().min(2).max(160),
  captchaToken: z.string().min(16).max(4096).optional(),
});

export const organizationOnboardingSchema = z.object({
  name: z.string().trim().min(2).max(160),
  displayName: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(63)
    .transform(slugify)
    .pipe(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
  referencePrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/),
});

export type OwnerRegistrationInput = z.infer<typeof ownerRegistrationSchema>;
export type OrganizationOnboardingInput = z.infer<
  typeof organizationOnboardingSchema
>;
