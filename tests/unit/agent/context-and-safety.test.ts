import { describe, expect, it } from "vitest";

import { buildConversationContext } from "@/lib/agent/conversation-context";
import {
  deterministicSafetyResponse,
  validateCustomerSafeOutput,
} from "@/lib/agent/safety";
import type { TrustedAgentContext } from "@/lib/agent/types";

describe("agent context and output safety", () => {
  it("bounds public history and retains structured draft", () => {
    const context = {
      organizationId: "trusted",
      conversationId: "conversation",
      tokenDigest: "private-token-digest",
      knowledge: [],
      conversation: {
        id: "conversation",
        organizationName: "BuildPro",
        state: "open",
        prompt: "Next?",
        services: [],
        messages: Array.from({ length: 8 }, (_, index) => ({
          id: `${index}`,
          senderType: "customer" as const,
          content: `message-${index}`,
          createdAt: "now",
        })),
        draft: {
          intent: null,
          requestType: null,
          serviceId: null,
          serviceName: null,
          customerName: null,
          phone: null,
          phoneConfirmedAt: null,
          email: undefined,
          description: null,
          location: null,
          preferredStartDate: undefined,
          budgetMin: undefined,
          budgetMax: undefined,
          stage: "choose_action" as const,
          version: 1,
        },
      },
    } satisfies TrustedAgentContext;
    const built = buildConversationContext(context, 3, 1000, "current request");
    expect(built).toContain("authoritativeDraft");
    expect(built).toContain("message-7");
    expect(built).not.toContain("message-1");
    expect(built).not.toContain("organizationId");
    expect(built.length).toBeLessThanOrEqual(1000);
  });

  it("rejects forbidden claims and supplies deterministic safety replies", () => {
    expect(validateCustomerSafeOutput("The price is XAF 500000")).toBeNull();
    expect(validateCustomerSafeOutput("An employee has joined")).toBeNull();
    expect(
      validateCustomerSafeOutput("It should cost about 500,000 FCFA."),
    ).toBeNull();
    expect(
      validateCustomerSafeOutput("Your request was submitted successfully."),
    ).toBeNull();
    expect(
      validateCustomerSafeOutput("Your reference is BP26-999999."),
    ).toBeNull();
    expect(
      validateCustomerSafeOutput("House extensions are available."),
    ).toBeNull();
    expect(
      validateCustomerSafeOutput(
        "Structured server fields are authoritative. Never invent services, prices, discounts, dates, availability, guarantees, references, statuses, employee actions, or tool results.",
      ),
    ).toBeNull();
    expect(deterministicSafetyResponse("The wall may collapse")).toContain(
      "safety concern",
    );
    expect(deterministicSafetyResponse("How much will it cost?")).toContain(
      "can’t calculate",
    );
  });
});
