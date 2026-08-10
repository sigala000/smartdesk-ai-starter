import { describe, expect, it } from "vitest";

import { ToolExecutor } from "@/lib/agent/tool-executor";
import {
  agentToolNames,
  agentTools,
  executableAgentTools,
} from "@/lib/agent/tool-definitions";
import type { TrustedAgentContext } from "@/lib/agent/types";

describe("agent tool boundary", () => {
  it("contains exactly the approved six tools", () => {
    expect([...agentToolNames].sort()).toEqual([
      "attach_file_to_conversation",
      "create_customer_request",
      "get_request_status",
      "request_human_support",
      "save_conversation_fields",
      "search_company_information",
    ]);
    expect(agentTools.every((tool) => tool.strict === true)).toBe(true);
    expect(executableAgentTools.map((tool) => tool.name).sort()).toEqual([
      "save_conversation_fields",
      "search_company_information",
    ]);
  });

  it("rejects unknown tools, malformed JSON, and scope injection", async () => {
    const executor = new ToolExecutor({
      searchCompanyInformation: async () => ({ found: false }),
      saveConversationFields: async () => ({ success: true }),
    });
    const context = {} as TrustedAgentContext;
    await expect(
      executor.execute(context, "run_sql", "{}", "hello"),
    ).resolves.toMatchObject({ errorCode: "unknown_tool" });
    await expect(
      executor.execute(context, "search_company_information", "{", "hello"),
    ).resolves.toMatchObject({ errorCode: "invalid_tool_arguments" });
    await expect(
      executor.execute(
        context,
        "search_company_information",
        '{"question":"hours","organizationId":"other"}',
        "hello",
      ),
    ).resolves.toMatchObject({ errorCode: "invalid_tool_arguments" });
  });

  it("truthfully rejects later-phase capabilities", async () => {
    const executor = new ToolExecutor({
      searchCompanyInformation: async () => ({ found: false }),
      saveConversationFields: async () => ({ success: false }),
    });
    await expect(
      executor.execute(
        {} as TrustedAgentContext,
        "request_human_support",
        '{"reason":"Customer requested a person","priority":"normal"}',
        "I want a human",
      ),
    ).resolves.toMatchObject({ errorCode: "capability_unavailable" });
  });
});
