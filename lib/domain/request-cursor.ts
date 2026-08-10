import { z } from "zod";

const cursorPayloadSchema = z.object({
  version: z.literal(1),
  createdAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});

export type RequestCursor = z.infer<typeof cursorPayloadSchema>;

export function encodeRequestCursor(
  cursor: Omit<RequestCursor, "version">,
): string {
  return Buffer.from(
    JSON.stringify({ version: 1, ...cursor }),
    "utf8",
  ).toString("base64url");
}

export function decodeRequestCursor(value: string): RequestCursor | null {
  if (value.length > 500) return null;
  try {
    return cursorPayloadSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
  } catch {
    return null;
  }
}
