/** Compact counts for profile stats: 165, 3K, 1.2K, 2.5M. */
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 1000) return String(Math.max(0, Math.round(n || 0)))
  const fmt = (v: number, unit: string) => `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}${unit}`
  if (n < 1_000_000) return fmt(n / 1000, 'K')
  return fmt(n / 1_000_000, 'M')
}
