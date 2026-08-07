import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(1024),
  next: z.string().optional(),
});

export type LoginInput = z.output<typeof loginSchema>;

export function sanitizeInternalRedirect(
  value: string | null | undefined,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  try {
    const decoded = decodeURIComponent(value);
    if (
      !decoded.startsWith("/") ||
      decoded.startsWith("//") ||
      decoded.includes("\\")
    ) {
      return "/dashboard";
    }
    const url = new URL(decoded, "https://smartdesk.invalid");
    return url.origin === "https://smartdesk.invalid"
      ? `${url.pathname}${url.search}`
      : "/dashboard";
  } catch {
    return "/dashboard";
  }
}
