/** Shallow-merge top-level namespaces; deep-merge nested objects (one level). */
export function mergeLocale<T extends Record<string, unknown>>(
  base: T,
  ext: Record<string, unknown>
): T {
  const out = { ...base } as Record<string, unknown>
  for (const key of Object.keys(ext)) {
    const b = out[key]
    const e = ext[key]
    if (
      b &&
      e &&
      typeof b === "object" &&
      typeof e === "object" &&
      !Array.isArray(b) &&
      !Array.isArray(e)
    ) {
      out[key] = { ...(b as Record<string, unknown>), ...(e as Record<string, unknown>) }
    } else {
      out[key] = e
    }
  }
  return out as T
}
