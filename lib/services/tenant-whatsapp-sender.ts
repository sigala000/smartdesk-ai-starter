import "server-only";

import { requireMetaCredentialEncryptionConfig } from "@/lib/config/env-schema";
import { serverEnvironment } from "@/lib/config/env-server";
import { decryptCredential } from "@/lib/crypto/credential-envelope";
import {
  MetaWhatsAppClient,
  type MetaSendResult,
} from "@/lib/meta/whatsapp-client";
import type { WhatsAppRepository } from "@/lib/repositories/whatsapp-repository";

export class TenantWhatsAppSender {
  constructor(
    private readonly repository: WhatsAppRepository,
    private readonly legacy: Readonly<{
      graphApiVersion: string;
      accessToken: string;
      phoneNumberId: string;
      testRecipients: readonly string[];
      timeoutMs: number;
    }> | null,
    private readonly request: typeof fetch = fetch,
  ) {}

  async sendText(
    recipient: string,
    text: string,
    context?: Readonly<{ organizationId: string; accountId: string }>,
  ): Promise<MetaSendResult> {
    if (!context || !this.repository.getOutboundConnection)
      return { ok: false, code: "meta_rejected" };
    const connection = await this.repository.getOutboundConnection(
      context.organizationId,
      context.accountId,
    );
    if (!connection) return { ok: false, code: "meta_rejected" };
    if (
      connection.mode === "production" &&
      connection.billingStatus === "action_required"
    )
      return { ok: false, code: "meta_billing_required" };
    if (connection.mode === "developer_test") {
      if (
        !this.legacy ||
        connection.phoneNumberId !== this.legacy.phoneNumberId ||
        !this.legacy.testRecipients.includes(recipient)
      )
        return { ok: false, code: "meta_rejected" };
      return new MetaWhatsAppClient(
        {
          graphApiVersion: this.legacy.graphApiVersion,
          accessToken: this.legacy.accessToken,
          phoneNumberId: connection.phoneNumberId,
          allowedRecipients: this.legacy.testRecipients,
          timeoutMs: this.legacy.timeoutMs,
        },
        this.request,
      ).sendText(recipient, text);
    }
    const encryption = requireMetaCredentialEncryptionConfig(serverEnvironment);
    if (
      !encryption ||
      !connection.keyVersion ||
      !connection.ciphertext ||
      !connection.initializationVector ||
      !connection.authenticationTag
    )
      return { ok: false, code: "meta_authentication" };
    try {
      const accessToken = decryptCredential(
        {
          keyVersion: connection.keyVersion,
          ciphertext: connection.ciphertext,
          initializationVector: connection.initializationVector,
          authenticationTag: connection.authenticationTag,
        },
        context.organizationId,
        context.accountId,
        encryption,
      );
      return new MetaWhatsAppClient(
        {
          graphApiVersion: connection.graphApiVersion,
          accessToken,
          phoneNumberId: connection.phoneNumberId,
          timeoutMs: this.legacy?.timeoutMs ?? 10_000,
        },
        this.request,
      ).sendText(recipient, text);
    } catch {
      return { ok: false, code: "meta_authentication" };
    }
  }
}
