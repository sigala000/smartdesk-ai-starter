export type AttachmentScanResult = Readonly<{
  status: "not_scanned" | "clean" | "infected" | "failed";
  scannerVersion: string;
}>;

export interface AttachmentScanner {
  scan(bytes: Uint8Array): Promise<AttachmentScanResult>;
}

export class NotConfiguredAttachmentScanner implements AttachmentScanner {
  async scan(bytes: Uint8Array): Promise<AttachmentScanResult> {
    void bytes;
    return { status: "not_scanned", scannerVersion: "not-configured" };
  }
}
