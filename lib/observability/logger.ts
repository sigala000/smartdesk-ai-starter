import { redactForLog } from "@/lib/observability/redaction";

type LogLevel = "info" | "warn" | "error";

export function logEvent(
  level: LogLevel,
  event: string,
  fields: Readonly<Record<string, unknown>> = {},
) {
  const record = redactForLog({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  const output = JSON.stringify(record);
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.info(output);
}
