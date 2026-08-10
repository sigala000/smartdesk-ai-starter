import { describe, expect, it } from "vitest";

import {
  ATTACHMENT_MAX_BYTES,
  createAttachmentIdentity,
  detectAttachmentMimeType,
  filenameMatchesMimeType,
  sanitizeAttachmentFilename,
} from "@/lib/domain/attachments";
import { attachmentPresignSchema } from "@/lib/schemas/attachment-api";

describe("attachment validation", () => {
  it.each([
    [new Uint8Array([0xff, 0xd8, 0xff, 0]), "image/jpeg"],
    [
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      "image/png",
    ],
    [new TextEncoder().encode("%PDF-1.7"), "application/pdf"],
  ] as const)("detects allowed file signatures", (bytes, expected) => {
    expect(detectAttachmentMimeType(bytes)).toBe(expected);
  });

  it("rejects content that only claims an allowed type", () => {
    expect(
      detectAttachmentMimeType(new TextEncoder().encode("<script>")),
    ).toBeNull();
  });

  it("never uses the original filename in a storage path", () => {
    const identity = createAttachmentIdentity(
      "10000000-0000-4000-8000-000000000001",
      { kind: "conversation", id: "20000000-0000-4000-8000-000000000001" },
      "application/pdf",
    );
    expect(identity.path).toMatch(
      /^10000000-0000-4000-8000-000000000001\/conversation\/20000000-0000-4000-8000-000000000001\/[0-9a-f-]+\.pdf$/,
    );
    expect(identity.path).not.toContain("customer");
  });

  it("sanitizes display filenames and blocks paths", () => {
    expect(sanitizeAttachmentFilename(" plan\u0000.pdf ")).toBe("plan.pdf");
    expect(sanitizeAttachmentFilename("../plan.pdf")).toBeNull();
    expect(sanitizeAttachmentFilename("folder\\plan.pdf")).toBeNull();
  });

  it("requires a matching safe extension", () => {
    expect(filenameMatchesMimeType("photo.jpeg", "image/jpeg")).toBe(true);
    expect(filenameMatchesMimeType("photo.svg", "image/jpeg")).toBe(false);
    expect(filenameMatchesMimeType("plan.pdf.exe", "application/pdf")).toBe(
      false,
    );
  });

  it("enforces the exact type and 10 MiB limit in the API schema", () => {
    const base = {
      target: {
        kind: "request",
        requestId: "20000000-0000-4000-8000-000000000001",
      },
      clientUploadId: "30000000-0000-4000-8000-000000000001",
      filename: "plan.pdf",
      mimeType: "application/pdf",
      sizeBytes: ATTACHMENT_MAX_BYTES,
    };
    expect(attachmentPresignSchema.safeParse(base).success).toBe(true);
    expect(
      attachmentPresignSchema.safeParse({ ...base, mimeType: "image/svg+xml" })
        .success,
    ).toBe(false);
    expect(
      attachmentPresignSchema.safeParse({
        ...base,
        sizeBytes: ATTACHMENT_MAX_BYTES + 1,
      }).success,
    ).toBe(false);
  });
});
