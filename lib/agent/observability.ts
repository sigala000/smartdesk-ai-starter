import type { AgentObservation, AgentObserver } from "@/lib/agent/types";
import { logEvent } from "@/lib/observability/logger";

export const noOpAgentObserver: AgentObserver = () => undefined;

export const serverAgentObserver: AgentObserver = (
  observation: AgentObservation,
) => {
  logEvent(observation.outcome === "fallback" ? "warn" : "info", "agent_turn", {
    ...observation,
    totalTokens: observation.inputTokens + observation.outputTokens,
  });
};
