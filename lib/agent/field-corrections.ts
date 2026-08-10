export function permitsAgentFieldChange(
  current: unknown,
  proposed: unknown,
  source: "customer_message" | "explicit_correction" | undefined,
  customerMessage: string,
) {
  if (proposed === undefined || current === null || current === undefined)
    return true;
  if (proposed === current) return true;
  return (
    source === "explicit_correction" &&
    /\b(?:correct|correction|change|update|actually|instead)\b/i.test(
      customerMessage,
    )
  );
}
