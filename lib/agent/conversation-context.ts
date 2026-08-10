import { nextRequiredStage } from "@/lib/domain/conversation-workflow";
import type { TrustedAgentContext } from "@/lib/agent/types";

export function buildConversationContext(
  context: TrustedAgentContext,
  historyLimit: number,
  characterBudget: number,
  currentCustomerMessage: string,
) {
  const recent = context.conversation.messages
    .filter((message) => ["customer", "assistant"].includes(message.senderType))
    .slice(-historyLimit)
    .filter(
      (message, index, messages) =>
        !(
          index === messages.length - 1 &&
          message.senderType === "customer" &&
          message.content === currentCustomerMessage
        ),
    );
  const currentMessage = currentCustomerMessage.slice(0, 2000);
  const fixed = {
    organization: {
      name: context.conversation.organizationName,
      services: context.conversation.services,
    },
    authoritativeDraft: context.conversation.draft,
    deterministicNextStage: nextRequiredStage(context.conversation.draft),
    currentCustomerMessage: currentMessage,
  };
  const fixedCharacters = JSON.stringify(fixed).length;
  const historyBudget = Math.max(0, characterBudget - fixedCharacters);
  const selected: typeof recent = [];
  let used = 0;
  for (const message of [...recent].reverse()) {
    const content = message.content.slice(0, 2000);
    if (used + content.length > historyBudget) continue;
    selected.unshift({ ...message, content });
    used += content.length;
  }
  const serialized = JSON.stringify({
    ...fixed,
    recentMessages: selected.map(({ senderType, content }) => ({
      role: senderType,
      content,
    })),
  });
  return serialized.slice(0, characterBudget);
}
