import {
  agentInstructions,
  agentInstructionVersion,
} from "@/lib/agent/instructions";
import { executableAgentTools } from "@/lib/agent/tool-definitions";
import type {
  AgentOutcome,
  AgentProvider,
  AgentObserver,
  AgentToolExecution,
  TrustedAgentContext,
} from "@/lib/agent/types";
import { buildConversationContext } from "@/lib/agent/conversation-context";
import {
  deterministicSafetyResponse,
  injectionResponse,
  validateCustomerSafeOutput,
} from "@/lib/agent/safety";
import type { ToolExecutor } from "@/lib/agent/tool-executor";
import { noOpAgentObserver } from "@/lib/agent/observability";

export type AgentLimits = Readonly<{
  historyMessages: number;
  inputCharacters: number;
  maxToolCalls: number;
  timeoutMs: number;
  maxTokensPerTurn: number;
}>;

export class AgentOrchestrator {
  constructor(
    private readonly provider: AgentProvider | null,
    private readonly executor: ToolExecutor,
    private readonly limits: AgentLimits,
    private readonly observe: AgentObserver = noOpAgentObserver,
  ) {}

  async run(
    context: TrustedAgentContext,
    customerMessage: string,
  ): Promise<AgentOutcome> {
    const startedAt = performance.now();
    const traceId = crypto.randomUUID();
    let inputTokens = 0;
    let outputTokens = 0;
    const toolNames: string[] = [];
    const executions: AgentToolExecution[] = [];
    const finish = (
      outcome: AgentOutcome,
      fallbackReason?: string,
    ): AgentOutcome => {
      try {
        this.observe({
          traceId,
          organizationId: context.organizationId,
          instructionVersion: agentInstructionVersion,
          outcome: outcome.fallback ? "fallback" : "completed",
          fallbackReason,
          durationMs: Math.round(performance.now() - startedAt),
          toolNames,
          inputTokens,
          outputTokens,
        });
      } catch {}
      return outcome;
    };
    const immediate =
      injectionResponse(customerMessage) ??
      deterministicSafetyResponse(customerMessage);
    if (immediate)
      return finish(
        { text: immediate, fallback: true, toolNames },
        "deterministic_safety",
      );
    const fallback =
      context.conversation.prompt ||
      "Please choose one of the available request options.";
    if (!this.provider)
      return finish(
        { text: fallback, fallback: true, toolNames },
        "provider_disabled",
      );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.limits.timeoutMs);
    let continuation: readonly Record<string, unknown>[] | undefined;
    try {
      for (
        let iteration = 0;
        iteration <= this.limits.maxToolCalls;
        iteration += 1
      ) {
        const response = await this.provider.respond({
          instructions: agentInstructions,
          input:
            continuation ??
            buildConversationContext(
              context,
              this.limits.historyMessages,
              this.limits.inputCharacters,
              customerMessage,
            ),
          tools: executableAgentTools,
          signal: controller.signal,
        });
        inputTokens += response.usage?.inputTokens ?? 0;
        outputTokens += response.usage?.outputTokens ?? 0;
        if (inputTokens + outputTokens > this.limits.maxTokensPerTurn)
          return finish(
            { text: fallback, fallback: true, toolNames },
            "token_limit",
          );
        if (response.toolCalls.length === 0) {
          const safe = validateCustomerSafeOutput(response.text, {
            executions,
            context,
          });
          return finish(
            {
              text: safe ?? fallback,
              fallback: safe === null,
              toolNames,
            },
            safe === null ? "output_validation" : undefined,
          );
        }
        if (
          toolNames.length + response.toolCalls.length >
          this.limits.maxToolCalls
        )
          return finish(
            { text: fallback, fallback: true, toolNames },
            "tool_limit",
          );
        const outputs: Record<string, unknown>[] = [];
        for (const call of response.toolCalls) {
          if (
            toolNames.includes(call.name) &&
            call.name !== "search_company_information"
          )
            return finish(
              { text: fallback, fallback: true, toolNames },
              "duplicate_mutation",
            );
          toolNames.push(call.name);
          const result = await this.executor.execute(
            context,
            call.name,
            call.arguments,
            customerMessage,
          );
          executions.push({ name: call.name, result });
          if (
            call.name === "request_human_support" &&
            typeof result === "object" &&
            result !== null &&
            "success" in result &&
            result.success === true &&
            "status" in result
          ) {
            const status = (result as { status?: unknown }).status;
            const text =
              status === "active"
                ? "A BuildPro employee has joined this conversation."
                : status === "assigned"
                  ? "Your conversation has been assigned. No employee has joined yet."
                  : "Human support has been requested. No employee has joined yet.";
            return finish(
              { text, fallback: true, toolNames },
              "server_owned_handoff_acknowledgement",
            );
          }
          outputs.push({
            type: "function_call_output",
            call_id: call.callId,
            output: JSON.stringify(result),
          });
        }
        continuation = [...response.outputItems, ...outputs];
      }
      return finish(
        { text: fallback, fallback: true, toolNames },
        "tool_limit",
      );
    } catch {
      return finish(
        { text: fallback, fallback: true, toolNames },
        "provider_error",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
