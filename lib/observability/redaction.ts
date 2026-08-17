const sensitiveKey =
  /(?:authorization|cookie|secret|token|password|api[_-]?key|phone|email|content|message|prompt)/i;
const credentialPattern =
  /(?:sk-[A-Za-z0-9_-]{12,}|EA[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g;

const MAX_DEPTH = 6;
const MAX_STRING_LENGTH = 512;

export function redactForLog(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[TRUNCATED]";
  if (typeof value === "string")
    return value
      .replace(credentialPattern, "[REDACTED_CREDENTIAL]")
      .slice(0, MAX_STRING_LENGTH);
  if (Array.isArray(value))
    return value.slice(0, 50).map((item) => redactForLog(item, depth + 1));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      sensitiveKey.test(key) ? "[REDACTED]" : redactForLog(entry, depth + 1),
    ]),
  );
}
