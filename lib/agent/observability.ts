import type { AgentObservation, AgentObserver } from "@/lib/agent/types";

export const noOpAgentObserver: AgentObserver = () => undefined;

export const serverAgentObserver: AgentObserver = (
  observation: AgentObservation,
) => {
  console.info(
    JSON.stringify({
      event: "agent_turn",
      ...observation,
    }),
  );
};
