import { describe, expect, it } from "vitest";
import {
  canTransitionHandoff,
  classifyEscalation,
} from "@/lib/domain/handoffs";
describe("handoff escalation", () => {
  it.each([
    ["I need to speak to a human", "explicit_human_request", "normal"],
    ["There is a fire and someone is injured", "safety_concern", "urgent"],
    ["This is fraud and an unauthorized charge", "suspected_fraud", "high"],
    ["I have a payment dispute", "payment_dispute", "high"],
    ["I want to make a formal complaint", "serious_complaint", "high"],
    ["The wall is cracking and leaning", "safety_concern", "urgent"],
    ["I smell gas near an exposed wire", "safety_concern", "urgent"],
    ["This fake invoice was not authorized", "suspected_fraud", "high"],
    ["I paid but no work was done", "payment_dispute", "high"],
    ["This negligence is unacceptable conduct", "serious_complaint", "high"],
  ])("classifies %s", (message, reason, priority) =>
    expect(classifyEscalation(message)).toMatchObject({
      reasonCode: reason,
      priority,
    }),
  );
  it("does not escalate ordinary text", () =>
    expect(classifyEscalation("Tell me about house renovation")).toBeNull());
  it("does not mistake ordinary construction words for emergencies", () => {
    expect(classifyEscalation("Can you quote a wall renovation?")).toBeNull();
    expect(
      classifyEscalation("Tell me about gas appliance services"),
    ).toBeNull();
  });
  it("keeps join and resume explicit", () => {
    expect(canTransitionHandoff("assigned", "active")).toBe(true);
    expect(canTransitionHandoff("queued", "active")).toBe(false);
    expect(canTransitionHandoff("resolved", "active")).toBe(false);
  });
});
