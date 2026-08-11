import { describe, expect, it, vi } from "vitest";

import type { MetaWhatsAppClient } from "@/lib/meta/whatsapp-client";
import type { WhatsAppRepository } from "@/lib/repositories/whatsapp-repository";
import type { PublicConversationService } from "@/lib/services/public-conversation-service";
import { WhatsAppChannelService } from "@/lib/services/whatsapp-channel-service";

const event = {
  kind: "message" as const,
  phoneNumberId: "12345678901",
  businessAccountId: "98765432101",
  waId: "237600000001",
  profileName: "Test Customer",
  providerMessageId: "wamid.inbound.1",
  timestamp: new Date("2026-08-10T10:00:00Z"),
  messageType: "text",
  text: "I want a quotation for organization 999",
};

function setup(
  claim = true,
  sendOk = true,
  stage: "choose_action" | "review" = "choose_action",
  summaryReady = false,
) {
  const calls: string[] = [];
  const repository = {
    ingest: vi.fn(async () => {
      calls.push("ingest");
      return {
        created: true,
        organizationId: "trusted-organization",
        accountId: "trusted-account",
        identityId: "identity",
        conversationId: "conversation",
        tokenDigest: "a".repeat(64),
        deliveryId: "delivery",
        clientMessageId: "10000000-0000-4000-8000-000000000001",
        status: "received",
      };
    }),
    claim: vi.fn(async () => {
      calls.push("claim");
      return claim;
    }),
    summaryReady: vi.fn(async () => summaryReady),
    restoreConversationAccess: vi.fn(async () => true),
    findAssistantReply: vi.fn(async () => ({
      id: "reply",
      content: "Which service?",
    })),
    complete: vi.fn(async () => "outbound"),
    markUnsupported: vi.fn(async () => undefined),
    recordSendResult: vi.fn(async () => undefined),
    updateStatus: vi.fn(async () => undefined),
  } satisfies WhatsAppRepository;
  const context = {
    organizationId: "trusted-organization",
    conversationId: "conversation",
    tokenDigest: "a".repeat(64),
    knowledge: [],
    conversation: {
      id: "conversation",
      organizationName: "BuildPro Cameroon",
      state: "open",
      draft: {
        intent: null,
        requestType: null,
        serviceId: null,
        serviceName: null,
        customerName: null,
        phone: null,
        phoneConfirmedAt: null,
        email: null,
        description: null,
        location: null,
        preferredStartDate: null,
        budgetMin: null,
        budgetMax: null,
        stage,
        version: 1,
      },
      prompt: "Welcome",
      services: [],
      messages: [],
    },
  };
  const conversations = {
    channelContext: vi.fn(async () => {
      calls.push("context");
      return { ok: true as const, value: context };
    }),
    message: vi.fn(async () => {
      calls.push("agent");
      return { ok: true as const, value: context.conversation };
    }),
    ensureChannelCustomerMessage: vi.fn(async () => ({
      ok: true as const,
      value: null,
    })),
    summary: vi.fn(async () => ({
      ok: true as const,
      value: {
        conversation: context.conversation,
        expiresAt: "2026-08-10T10:10:00Z",
      },
    })),
    confirm: vi.fn(async () => ({
      ok: true as const,
      value: {
        id: "request",
        referenceNumber: "BP-2026-000001",
        status: "new",
        createdAt: "2026-08-10T10:00:00Z",
        replayed: false,
      },
    })),
    recordChannelReply: vi.fn(async () => ({
      ok: true as const,
      value: context.conversation,
    })),
  } as unknown as PublicConversationService;
  const sender = {
    sendText: vi.fn(async () =>
      sendOk
        ? ({
            ok: true as const,
            providerMessageId: "wamid.outbound.1",
          } as const)
        : ({ ok: false as const, code: "meta_timeout" } as const),
    ),
  } as unknown as MetaWhatsAppClient;
  const service = new WhatsAppChannelService(
    repository,
    conversations,
    sender,
    {
      phoneNumberId: "12345678901",
      businessAccountId: "98765432101",
      testRecipient: "237600000001",
    },
  );
  return { service, repository, conversations, sender, calls };
}

describe("WhatsApp channel service", () => {
  it("persists and claims before invoking the existing agent, then sends once", async () => {
    const fixture = setup();
    await expect(fixture.service.handle(event)).resolves.toMatchObject({
      accepted: true,
      processed: true,
      delivered: true,
    });
    expect(fixture.calls).toEqual(["ingest", "claim", "context", "agent"]);
    expect(fixture.conversations.message).toHaveBeenCalledOnce();
    expect(fixture.sender.sendText).toHaveBeenCalledWith(
      "237600000001",
      "Which service?",
    );
    expect(fixture.repository.recordSendResult).toHaveBeenCalledOnce();
  });

  it("deduplicates before agent invocation or outbound sending", async () => {
    const fixture = setup(false);
    await expect(fixture.service.handle(event)).resolves.toMatchObject({
      accepted: true,
      processed: false,
      duplicate: true,
    });
    expect(fixture.conversations.message).not.toHaveBeenCalled();
    expect(fixture.sender.sendText).not.toHaveBeenCalled();
  });

  it("takes tenant scope only from the trusted destination mapping", async () => {
    const fixture = setup();
    await fixture.service.handle(event);
    expect(fixture.repository.complete).toHaveBeenCalledWith(
      "trusted-organization",
      "delivery",
      "reply",
      expect.any(String),
    );
    const foreign = { ...event, phoneNumberId: "99999999999" };
    await fixture.service.handle(foreign);
    expect(fixture.repository.ingest).toHaveBeenCalledTimes(1);
  });

  it("persists a provider failure and does not report delivery", async () => {
    const fixture = setup(true, false);
    await expect(fixture.service.handle(event)).resolves.toMatchObject({
      accepted: true,
      processed: true,
      delivered: false,
    });
    expect(fixture.repository.recordSendResult).toHaveBeenCalledWith(
      "trusted-organization",
      "outbound",
      { ok: false, code: "meta_timeout" },
    );
  });

  it("uses the existing server-held summary and confirmation services", async () => {
    const fixture = setup(true, true, "review", true);
    await fixture.service.handle({ ...event, text: "Confirm" });
    expect(fixture.conversations.message).not.toHaveBeenCalled();
    expect(fixture.conversations.summary).not.toHaveBeenCalled();
    expect(fixture.conversations.confirm).toHaveBeenCalledWith(
      "conversation",
      "a".repeat(64),
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.objectContaining({
        confirmation: true,
        idempotencyKey: expect.stringMatching(
          /^[0-9a-f-]{36}$/,
        ) as unknown as string,
      }),
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(fixture.conversations.recordChannelReply).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "trusted-organization" }),
      expect.any(String),
      "Confirm",
      expect.stringContaining("BP-2026-000001"),
    );
  });

  it("shows a server-built summary before the first confirmation can create a request", async () => {
    const fixture = setup(true, true, "review", false);
    await fixture.service.handle({ ...event, text: "Confirm" });
    expect(fixture.conversations.summary).toHaveBeenCalledOnce();
    expect(fixture.conversations.confirm).not.toHaveBeenCalled();
    expect(fixture.conversations.recordChannelReply).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      "Confirm",
      expect.stringContaining("Please review your request"),
    );
  });
});
