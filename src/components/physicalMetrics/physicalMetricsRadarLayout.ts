export function radarVertex(
  index: number,
  count: number,
  radius: number,
  cx: number,
  cy: number,
  value01: number
): { x: number; y: number } {
  'worklet'
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / count
  const r = Math.max(0, Math.min(1, value01)) * radius
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  }
}

/** Build polygon path with vertices scaled from center (progress 0–1). Worklet-safe for Reanimated. */
export function radarPolygonPathProgress(
  values: number[],
  maxValue: number,
  radius: number,
  cx: number,
  cy: number,
  progress: number
): string {
  'worklet'
  const count = values.length
  if (count < 3) return ''
  const max = Math.max(maxValue, 1)
  const t = Math.max(0, Math.min(1, progress))
  let d = ''
  for (let i = 0; i < count; i++) {
    const v = values[i] ?? 0
    const { x, y } = radarVertex(i, count, radius, cx, cy, (v / max) * t)
    d += `${i === 0 ? 'M' : ' L'} ${x} ${y}`
  }
  return `${d} Z`
}

export function radarPolygonPath(
  values: number[],
  maxValue: number,
  radius: number,
  cx: number,
  cy: number
): string {
  if (values.length < 3) return ''
  const max = Math.max(maxValue, 1)
  const pts = values.map((v, i) =>
    radarVertex(i, values.length, radius, cx, cy, v / max)
  )
  return `${pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} Z`
}

export function shortenRadarLabel(label: string, max = 12): string {
  if (label.length <= max) return label
  return `${label.slice(0, max - 1)}…`
}
