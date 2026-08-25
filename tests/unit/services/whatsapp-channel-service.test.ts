import { describe, expect, it, vi } from "vitest";

import type { MetaWhatsAppClient } from "@/lib/meta/whatsapp-client";
import type { WhatsAppRepository } from "@/lib/repositories/whatsapp-repository";
import type { PublicConversationService } from "@/lib/services/public-conversation-service";
import { WhatsAppChannelService } from "@/lib/services/whatsapp-channel-service";
import type { PublicStage } from "@/lib/dto/public-conversation-dto";

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
  stage: PublicStage = "choose_action",
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
        status: claim ? "received" : "sent",
      };
    }),
    claim: vi.fn(async () => {
      calls.push("claim");
      return claim;
    }),
    release: vi.fn(async () => true),
    consumeRateLimit: vi.fn(async () => true),
    summaryReady: vi.fn(async () => summaryReady),
    restoreConversationAccess: vi.fn(async () => true),
    findAssistantReply: vi.fn(async () => ({
      id: "reply",
      content: "Which service?",
    })),
    complete: vi.fn(async () => "outbound"),
    claimOutbound: vi.fn(async () => ({
      id: "outbound",
      content: "Which service?",
    })),
    markUnsupported: vi.fn(async () => undefined),
    recordSendResult: vi.fn(async () => true),
    updateStatus: vi.fn(async () => undefined),
    recordOptOut: vi.fn(async () => true),
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
      services: [
        {
          id: "12000000-0000-4000-8000-000000000002",
          name: "House renovation",
          description: "Renovation work",
        },
      ],
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
    expect(fixture.conversations.message).toHaveBeenCalledWith(
      "conversation",
      "a".repeat(64),
      expect.objectContaining({
        kind: "action",
        action: "request_quotation",
      }),
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(fixture.sender.sendText).toHaveBeenCalledWith(
      "237600000001",
      "Which service?",
      { organizationId: "trusted-organization", accountId: "trusted-account" },
    );
    expect(fixture.repository.recordSendResult).toHaveBeenCalledOnce();
  });

  it("selects a listed service without depending on the AI provider", async () => {
    const fixture = setup(true, true, "choose_service");
    await fixture.service.handle({ ...event, text: "House renovation" });
    expect(fixture.conversations.message).toHaveBeenCalledWith(
      "conversation",
      "a".repeat(64),
      expect.objectContaining({
        kind: "answer",
        value: "12000000-0000-4000-8000-000000000002",
      }),
      expect.any(String),
    );
  });

  it("submits required answers and optional skips deterministically", async () => {
    const required = setup(true, true, "collect_name");
    await required.service.handle({ ...event, text: "John Mbah" });
    expect(required.conversations.message).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ kind: "answer", value: "John Mbah" }),
      expect.any(String),
    );

    const optional = setup(true, true, "collect_email");
    await optional.service.handle({ ...event, text: "Skip" });
    expect(optional.conversations.message).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ kind: "skip" }),
      expect.any(String),
    );
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
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await fixture.service.handle(foreign);
    expect(fixture.repository.ingest).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      "whatsapp_event_ignored",
      expect.objectContaining({
        code: "destination_mismatch",
        phoneNumberMatches: false,
        businessAccountMatches: true,
        testRecipientMatches: true,
      }),
    );
    info.mockRestore();
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

  it("keeps Meta retrying while another worker holds the processing lease", async () => {
    const fixture = setup(false);
    fixture.repository.ingest.mockResolvedValueOnce({
      created: false,
      organizationId: "trusted-organization",
      accountId: "trusted-account",
      identityId: "identity",
      conversationId: "conversation",
      tokenDigest: "a".repeat(64),
      deliveryId: "delivery",
      clientMessageId: "10000000-0000-4000-8000-000000000001",
      status: "processing",
    });
    await expect(fixture.service.handle(event)).resolves.toMatchObject({
      accepted: false,
      duplicate: true,
    });
    expect(fixture.sender.sendText).not.toHaveBeenCalled();
  });

  it("reuses the persisted reply on a retry without invoking the agent again", async () => {
    const fixture = setup(false);
    fixture.repository.ingest.mockResolvedValueOnce({
      created: false,
      organizationId: "trusted-organization",
      accountId: "trusted-account",
      identityId: "identity",
      conversationId: "conversation",
      tokenDigest: "a".repeat(64),
      deliveryId: "delivery",
      clientMessageId: "10000000-0000-4000-8000-000000000001",
      status: "processed",
    });
    await expect(fixture.service.handle(event)).resolves.toMatchObject({
      accepted: true,
      delivered: true,
    });
    expect(fixture.conversations.channelContext).not.toHaveBeenCalled();
    expect(fixture.conversations.message).not.toHaveBeenCalled();
    expect(fixture.sender.sendText).toHaveBeenCalledOnce();
  });

  it("releases a recoverable processing failure for the next Meta retry", async () => {
    const fixture = setup();
    fixture.conversations.channelContext = vi.fn(async () => ({
      ok: false as const,
      code: "internal_error",
    }));
    await expect(fixture.service.handle(event)).resolves.toMatchObject({
      accepted: false,
    });
    expect(fixture.repository.release).toHaveBeenCalledWith(
      "trusted-organization",
      "delivery",
      "context_unavailable",
    );
  });

  it("persists a deterministic response and skips the agent when rate limited", async () => {
    const fixture = setup();
    fixture.repository.consumeRateLimit.mockResolvedValueOnce(false);
    await expect(fixture.service.handle(event)).resolves.toMatchObject({
      delivered: true,
    });
    expect(fixture.conversations.message).not.toHaveBeenCalled();
    expect(fixture.conversations.recordChannelReply).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      event.text,
      expect.stringContaining("Too many messages"),
    );
  });

  it("requests a provider retry only for an explicitly retryable send result", async () => {
    const fixture = setup();
    fixture.sender.sendText = vi.fn(async () => ({
      ok: false as const,
      code: "meta_rate_limited" as const,
    }));
    await expect(fixture.service.handle(event)).resolves.toMatchObject({
      accepted: false,
      delivered: false,
    });
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

  it("handles opt-out deterministically before agent invocation and stores only a digest", async () => {
    const fixture = setup();
    await expect(
      fixture.service.handle({ ...event, text: "STOP" }),
    ).resolves.toMatchObject({ delivered: true });
    expect(fixture.repository.recordOptOut).toHaveBeenCalledWith(
      "trusted-organization",
      "trusted-account",
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(String),
    );
    expect(fixture.conversations.message).not.toHaveBeenCalled();
    expect(fixture.conversations.recordChannelReply).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      "STOP",
      expect.stringContaining("opted out"),
    );
  });
});
