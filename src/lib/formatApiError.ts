/** Turn API / fetch error payloads into a user-visible string. */
export function formatApiError(value: unknown, fallback: string): string {
  if (value == null) return fallback;
  if (typeof value === "string") {
    const t = value.trim();
    return t || fallback;
  }
  if (value instanceof Error) {
    return value.message?.trim() || fallback;
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
    if (typeof o.error === "string" && o.error.trim()) return o.error.trim();
    if (o.error != null && typeof o.error === "object") {
      const nested = formatApiError(o.error, "");
      if (nested) return nested;
    }
    try {
      const s = JSON.stringify(value);
      if (s && s !== "{}") return s;
    } catch {
      /* ignore */
    }
  }
  return fallback;
}
