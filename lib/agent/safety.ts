import type {
  AgentToolExecution,
  TrustedAgentContext,
} from "@/lib/agent/types";
import { agentInstructions } from "@/lib/agent/instructions";

const injectionPatterns = [
  /(?:ignore|disregard|override|forget).{0,40}(?:instructions|rules|directives|policy)/i,
  /(?:show|reveal|print|dump|repeat|expose).{0,80}(?:system prompt|hidden prompt|tool schema|secret|api key|internal note|instructions)/i,
  /(?:another|other).{0,30}(?:customer|organization|tenant|client)/i,
  /(?:pretend|act as|roleplay).{0,50}(?:administrator|developer|system|employee)/i,
  /(?:bypass|disable|remove).{0,40}(?:verification|confirmation|authorization|safety)/i,
  /(?:ignore|oublie|contourne|désactive).{0,50}(?:instructions|règles|confirmation|autorisation)/i,
  /(?:montre|révèle|affiche).{0,80}(?:invite système|instructions cachées|secret|clé api|note interne)/i,
  /(?:autre).{0,30}(?:client|organisation|locataire)/i,
];
const unconditionalForbiddenClaims = [
  /(?:guarantee|promise)\b/i,
  /(?:will|can) (?:start|finish|complete) (?:on|by)\b/i,
  /(?:system|hidden) (?:instruction|prompt)|tool schema|api key|service.role|internal note/i,
];
const priceClaim =
  /(?:\b(?:price|cost|quote|quotation|discount|estimate)\b.{0,50}(?:\d|one|two|three|four|five|six|seven|eight|nine|hundred|thousand|million)|(?:\d[\d,. ]*|one|two|three|four|five|six|seven|eight|nine|hundred|thousand|million).{0,30}\b(?:xaf|fcfa|cfa|usd|eur|dollars?|euros?)\b)/i;
const actionClaim =
  /(?:request|handoff|file|attachment|quotation).{0,40}(?:submitted|created|queued|attached|assigned|approved|prepared|sent)|(?:employee|human|officer|team member).{0,40}(?:joined|assigned|handling|on the way)/i;
const activeHumanClaim =
  /(?:employee|human|officer|team member|representative).{0,50}(?:joined|connected|transferred|took over|handling|is (?:now )?(?:here|active|present|with you)|speaking|chatting)|(?:connected|transferred).{0,30}(?:employee|human|officer|team member|representative)/i;
const companyClaim =
  /(?:\b(?:buildpro|company|we)\b.{0,50}\b(?:offers?|provides?|installs?|supports?|available|specializes?)\b|\b(?:offers?|provides?|installs?|supports?|available service|(?:is|are) available)\b)/i;
const referencePattern = /\b[A-Z0-9]{2,10}[- ]?\d{2,4}[- ]?\d{3,8}\b/g;

export function injectionResponse(message: string): string | null {
  if (!injectionPatterns.some((pattern) => pattern.test(message))) return null;
  return "I can’t provide protected instructions or another customer’s information. I can help with BuildPro services or your own request.";
}

function successfulResult(
  executions: readonly AgentToolExecution[],
  name: string,
) {
  return executions.find((execution) => {
    if (
      execution.name !== name ||
      typeof execution.result !== "object" ||
      execution.result === null
    )
      return false;
    return (
      !("success" in execution.result) || execution.result.success === true
    );
  })?.result;
}

export function validateCustomerSafeOutput(
  text: string,
  options?: Readonly<{
    executions: readonly AgentToolExecution[];
    context: TrustedAgentContext;
  }>,
) {
  const normalized = text.trim().slice(0, 2000);
  if (!normalized) return null;
  if (unconditionalForbiddenClaims.some((pattern) => pattern.test(normalized)))
    return null;
  const instructionWords = agentInstructions.toLowerCase().split(/\s+/);
  const lowerOutput = normalized.toLowerCase();
  for (let index = 0; index <= instructionWords.length - 10; index += 1) {
    if (
      lowerOutput.includes(instructionWords.slice(index, index + 10).join(" "))
    )
      return null;
  }
  if (priceClaim.test(normalized)) return null;

  const executions = options?.executions ?? [];
  const creation = successfulResult(executions, "create_customer_request");
  const handoff = successfulResult(executions, "request_human_support");
  const attachment = successfulResult(
    executions,
    "attach_file_to_conversation",
  );
  const status = successfulResult(executions, "get_request_status");
  if (actionClaim.test(normalized) && !creation && !handoff && !attachment)
    return null;
  if (
    activeHumanClaim.test(normalized) &&
    (!handoff ||
      typeof handoff !== "object" ||
      !("status" in handoff) ||
      (handoff as { status?: unknown }).status !== "active")
  )
    return null;

  const references = normalized.match(referencePattern) ?? [];
  if (references.length > 0) {
    const evidence = JSON.stringify([creation, status]);
    if (references.some((reference) => !evidence.includes(reference)))
      return null;
  }

  const deniesCompanyClaim =
    /(?:do not|does not|don't|doesn't|no approved information|cannot confirm|can't confirm)/i.test(
      normalized,
    );
  if (companyClaim.test(normalized) && !deniesCompanyClaim) {
    const search = successfulResult(executions, "search_company_information");
    if (!search || JSON.stringify(search).includes('"found":false'))
      return null;
    const evidence = JSON.stringify(search).toLowerCase();
    const meaningfulWords = normalized.toLowerCase().match(/[a-z]{5,}/g) ?? [];
    if (!meaningfulWords.some((word) => evidence.includes(word))) return null;
  }

  return normalized;
}

export function deterministicSafetyResponse(message: string) {
  if (/\b(?:unsafe|danger|collapse|fire|injur|threat)\w*/i.test(message))
    return "This may involve an immediate safety concern. Please avoid the unsafe area and contact an appropriate local emergency service if anyone is at risk. I can also help you contact a BuildPro employee.";
  if (/\b(?:human|person|employee|agent)\b/i.test(message))
    return "I can help request human support. I will only say an employee has joined after the system confirms acceptance.";
  if (/\b(?:price|cost|discount|how much)\b/i.test(message))
    return "I can’t calculate or promise a price. BuildPro must assess the request before an authorized employee prepares a quotation.";
  return null;
}
