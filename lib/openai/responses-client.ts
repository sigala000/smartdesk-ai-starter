import "server-only";

import OpenAI from "openai";

import type { AgentProvider, AgentProviderResponse } from "@/lib/agent/types";

export class OpenAIResponsesClient implements AgentProvider {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly maxOutputTokens: number,
  ) {
    this.client = new OpenAI({ apiKey, maxRetries: 0 });
  }

  async respond(input: Parameters<AgentProvider["respond"]>[0]) {
    const response = await this.client.responses.create(
      {
        model: this.model,
        instructions: input.instructions,
        input: input.input as never,
        tools: input.tools as never,
        max_output_tokens: this.maxOutputTokens,
        store: false,
      },
      { signal: input.signal },
    );
    return {
      id: response.id,
      text: response.output_text,
      toolCalls: response.output.flatMap((item) =>
        item.type === "function_call"
          ? [
              {
                callId: item.call_id,
                name: item.name,
                arguments: item.arguments,
              },
            ]
          : [],
      ),
      outputItems: response.output as unknown as readonly Record<
        string,
        unknown
      >[],
      usage: response.usage
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          }
        : undefined,
    } satisfies AgentProviderResponse;
  }
}
