import { agentToolNames } from "@/lib/agent/tool-definitions";
import { toolSchemas, type AgentToolName } from "@/lib/agent/tool-schemas";
import type { TrustedAgentContext } from "@/lib/agent/types";

export type ToolServices = Readonly<{
  searchCompanyInformation: (
    context: TrustedAgentContext,
    question: string,
  ) => Promise<unknown>;
  saveConversationFields: (
    context: TrustedAgentContext,
    input: unknown,
    customerMessage: string,
  ) => Promise<unknown>;
  requestHumanSupport?: (
    context: TrustedAgentContext,
    input: unknown,
    customerMessage: string,
  ) => Promise<unknown>;
  getRequestStatus?: (
    context: TrustedAgentContext,
    input: unknown,
  ) => Promise<unknown>;
}>;

const unavailable = { success: false, errorCode: "capability_unavailable" };

export class ToolExecutor {
  constructor(private readonly services: ToolServices) {}

  async execute(
    context: TrustedAgentContext,
    name: string,
    rawArguments: string,
    customerMessage: string,
  ) {
    if (!agentToolNames.includes(name as AgentToolName))
      return { success: false, errorCode: "unknown_tool" };
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawArguments) as unknown;
    } catch {
      return { success: false, errorCode: "invalid_tool_arguments" };
    }
    const schema = toolSchemas[name as AgentToolName];
    const input = schema.safeParse(parsed);
    if (!input.success)
      return { success: false, errorCode: "invalid_tool_arguments" };
    if (name === "search_company_information")
      return this.services.searchCompanyInformation(
        context,
        (input.data as { question: string }).question,
      );
    if (name === "save_conversation_fields")
      return this.services.saveConversationFields(
        context,
        input.data,
        customerMessage,
      );
    if (name === "request_human_support")
      return this.services.requestHumanSupport
        ? this.services.requestHumanSupport(
            context,
            input.data,
            customerMessage,
          )
        : unavailable;
    if (name === "get_request_status")
      return this.services.getRequestStatus
        ? this.services.getRequestStatus(context, input.data)
        : unavailable;
    return unavailable;
  }
}
