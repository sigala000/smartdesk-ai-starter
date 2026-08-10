import type { PublicConversationView } from "@/lib/dto/public-conversation-dto";

export type AgentKnowledgeItem = Readonly<{
  id: string;
  title: string;
  content: string;
}>;

export type TrustedAgentContext = Readonly<{
  organizationId: string;
  conversationId: string;
  tokenDigest: string;
  conversation: PublicConversationView;
  knowledge: readonly AgentKnowledgeItem[];
}>;

export type AgentToolCall = Readonly<{
  callId: string;
  name: string;
  arguments: string;
}>;

export type AgentProviderResponse = Readonly<{
  id: string;
  text: string;
  toolCalls: readonly AgentToolCall[];
  outputItems: readonly Record<string, unknown>[];
  usage?: Readonly<{
    inputTokens: number;
    outputTokens: number;
  }>;
}>;

export interface AgentProvider {
  respond(input: {
    instructions: string;
    input: string | readonly Record<string, unknown>[];
    tools: readonly Record<string, unknown>[];
    signal: AbortSignal;
  }): Promise<AgentProviderResponse>;
}

export type AgentOutcome = Readonly<{
  text: string;
  fallback: boolean;
  toolNames: readonly string[];
}>;

export type AgentToolExecution = Readonly<{
  name: string;
  result: unknown;
}>;

export type AgentObservation = Readonly<{
  traceId: string;
  organizationId: string;
  instructionVersion: string;
  outcome: "completed" | "fallback";
  fallbackReason?: string;
  durationMs: number;
  toolNames: readonly string[];
  inputTokens: number;
  outputTokens: number;
}>;

export type AgentObserver = (observation: AgentObservation) => void;
