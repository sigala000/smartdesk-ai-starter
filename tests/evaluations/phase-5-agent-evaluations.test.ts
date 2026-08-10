import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { AgentOrchestrator } from "@/lib/agent/orchestrator";
import { ToolExecutor } from "@/lib/agent/tool-executor";
import type { AgentProvider, TrustedAgentContext } from "@/lib/agent/types";

type Fixture = {
  id: string;
  input: string;
  mockedResponse: string;
  expect: "allowed" | "blocked" | "deterministic" | "injection" | "fallback";
  required?: string;
};

const fixtures = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../fixtures/agent-evaluations/phase-5.json", import.meta.url),
    ),
    "utf8",
  ),
) as Fixture[];

const context: TrustedAgentContext = {
  organizationId: "10000000-0000-4000-8000-000000000001",
  conversationId: "81000000-0000-4000-8000-000000000001",
  tokenDigest: "redacted-test-digest",
  knowledge: [],
  conversation: {
    id: "81000000-0000-4000-8000-000000000001",
    organizationName: "BuildPro Cameroon",
    state: "open",
    prompt: "What would you like help with?",
    services: [],
    messages: [],
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
      stage: "choose_action",
      version: 1,
    },
  },
};

const executor = new ToolExecutor({
  searchCompanyInformation: vi.fn(async () => ({ found: false })),
  saveConversationFields: vi.fn(async () => ({ success: false })),
});

describe("Phase 5 AI behavior evaluations", () => {
  for (const fixture of fixtures) {
    it(fixture.id, async () => {
      const respond = vi.fn<AgentProvider["respond"]>(async () => ({
        id: `response-${fixture.id}`,
        text: fixture.mockedResponse,
        toolCalls: [],
        outputItems: [],
      }));
      const result = await new AgentOrchestrator({ respond }, executor, {
        historyMessages: 8,
        inputCharacters: 5000,
        maxToolCalls: 2,
        timeoutMs: 1000,
      }).run(context, fixture.input);

      if (
        fixture.expect === "injection" ||
        fixture.expect === "deterministic"
      ) {
        expect(result.text).toContain(fixture.required);
        expect(result.fallback).toBe(true);
        expect(respond).not.toHaveBeenCalled();
      } else if (
        fixture.expect === "blocked" ||
        fixture.expect === "fallback"
      ) {
        expect(result.fallback).toBe(true);
        expect(result.text).not.toBe(fixture.mockedResponse);
      } else {
        expect(result.fallback).toBe(false);
        expect(result.text).toContain(fixture.required ?? "");
      }
    });
  }
});
