/**
 * Client types + formatters for server `metrics.biomechanics_summary` (v1 / v1.1 / v1.2).
 * Primary units: ms, degrees, torso-lengths/s. Absolute m/s / J only when labelled estimates exist.
 */

export type BiomechanicsSummary = {
  version?: string
  calibration?: string
  timing?: {
    fps?: number | null
    impact_frame?: number | null
    impact_source?: string | null
    prep_to_impact_ms?: number | null
    impact_to_follow_ms?: number | null
    frames_prep_to_impact?: number | null
    frames_impact_to_follow?: number | null
  }
  angles_deg_proxy?: {
    elbow_impact_deg?: number | null
    elbow_prep_deg?: number | null
    elbow_delta_deg?: number | null
    knee_impact_deg?: number | null
    shoulder_hip_sep_prep_deg?: number | null
    shoulder_hip_sep_impact_deg?: number | null
    torso_sep_delta_deg?: number | null
  }
  speeds_body?: {
    scale?: string
    wrist_peak_body_per_s?: number | null
    wrist_path_prep_to_impact_body?: number | null
    wrist_peak_mps_est?: number | null
    wrist_peak_kmh_est?: number | null
    absolute_method?: string | null
    absolute_uncertainty_pct?: number | null
  }
  contact?: {
    yolo_contact_count?: number
    contact_window_ms?: number | null
    ball_height_vs_hip?: string
    lob_rise?: number | null
  }
  energy_est?: {
    method?: string
    racket_ke_j_est?: number | null
    note?: string
  }
  player_context?: {
    height_cm?: number | null
    weight_kg?: number | null
    age_years?: number | null
    age_band?: string | null
  }
  quality?: {
    pose_frames?: number
    mean_visibility?: number | null
    ball_track_n?: number
    cite_ok?: boolean
  }
}

export type MotionEvidenceAccent = 'neutral' | 'alert'

export type MotionEvidenceIcon = 'torso' | 'elbow' | 'wrist' | 'contact'

export type MotionEvidenceRow = {
  id: string
  /** Full bullet line (kept for any consumers that still want a single string). */
  text: string
  label: string
  /** Primary numeric / display value shown large in the tile. */
  value: string
  /** Optional trailing unit (e.g. body lengths/s). */
  valueUnit?: string | null
  /** Optional secondary note under the value (e.g. elbow delta from prep). */
  valueNote?: string | null
  accent: MotionEvidenceAccent
  icon: MotionEvidenceIcon
}

function asFiniteNumber(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  return v
}

export function parseBiomechanicsSummary(
  metrics: Record<string, unknown> | null | undefined
): BiomechanicsSummary | null {
  if (!metrics || typeof metrics !== 'object') return null
  const raw = metrics.biomechanics_summary
  if (!raw || typeof raw !== 'object') return null
  return raw as BiomechanicsSummary
}

function fmtMs(n: number): string {
  return `${Math.round(n)} ms`
}

function fmtDeg(n: number): string {
  const rounded = Math.round(n)
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${rounded}°`
}

function fmtDegAbs(n: number): string {
  return `${Math.round(n)}°`
}

/** Peak wrist speed in torso-lengths per second (shoulder–hip height as 1 body unit). */
function fmtBodyLengthsPerS(n: number): string {
  const v = Math.round(n * 10) / 10
  return `${v}`
}

export type MotionEvidenceLabels = {
  torsoRotation: string
  elbowImpact: string
  wristSpeed: string
  contactWindow: string
  bodyLengthsUnit?: string
  /** e.g. "≈ {n} m/s est" — `{n}` replaced with value */
  wristMpsEstNote?: string
}

/**
 * Primary evidence rows: torso, elbow at impact, wrist speed, contact window.
 * Prep/follow timing intentionally omitted from the player UI.
 * Selection rules unchanged — only structured fields added for tile UI.
 */
export function pickPrimaryEvidenceRows(
  summary: BiomechanicsSummary | null | undefined,
  labels: MotionEvidenceLabels
): MotionEvidenceRow[] {
  if (!summary) return []
  const rows: MotionEvidenceRow[] = []
  const angles = summary.angles_deg_proxy ?? {}
  const speeds = summary.speeds_body ?? {}
  const contact = summary.contact ?? {}
  const bodyUnit = labels.bodyLengthsUnit ?? 'body lengths/s'

  const torsoDelta = asFiniteNumber(angles.torso_sep_delta_deg)
  if (torsoDelta != null) {
    const value = fmtDeg(torsoDelta)
    rows.push({
      id: 'torso_sep_delta',
      text: `${labels.torsoRotation}: ${value}`,
      label: labels.torsoRotation,
      value,
      accent: 'neutral',
      icon: 'torso',
    })
  } else {
    const sep = asFiniteNumber(angles.shoulder_hip_sep_impact_deg)
    if (sep != null) {
      const value = fmtDegAbs(sep)
      rows.push({
        id: 'torso_sep_impact',
        text: `${labels.torsoRotation}: ${value}`,
        label: labels.torsoRotation,
        value,
        accent: 'neutral',
        icon: 'torso',
      })
    }
  }

  const elbow = asFiniteNumber(angles.elbow_impact_deg)
  if (elbow != null) {
    const delta = asFiniteNumber(angles.elbow_delta_deg)
    const value = fmtDegAbs(elbow)
    const deltaPart = delta != null ? `(${fmtDeg(delta)} from prep)` : null
    rows.push({
      id: 'elbow_impact',
      text: `${labels.elbowImpact}: ${value}${deltaPart ? ` ${deltaPart}` : ''}`,
      label: labels.elbowImpact,
      value,
      valueNote: deltaPart,
      accent: 'neutral',
      icon: 'elbow',
    })
  }

  const wrist = asFiniteNumber(speeds.wrist_peak_body_per_s)
  if (wrist != null && wrist > 0) {
    const value = fmtBodyLengthsPerS(wrist)
    const mps = asFiniteNumber(speeds.wrist_peak_mps_est)
    let valueNote: string | null = null
    if (mps != null && mps > 0 && labels.wristMpsEstNote) {
      valueNote = labels.wristMpsEstNote.replace('{n}', String(Math.round(mps * 10) / 10))
    } else if (mps != null && mps > 0) {
      valueNote = `≈ ${Math.round(mps * 10) / 10} m/s est`
    }
    rows.push({
      id: 'wrist_peak',
      text: `${labels.wristSpeed}: ${value} ${bodyUnit}${valueNote ? ` (${valueNote})` : ''}`,
      label: labels.wristSpeed,
      value,
      valueUnit: bodyUnit,
      valueNote,
      accent: 'neutral',
      icon: 'wrist',
    })
  }

  const contactMs = asFiniteNumber(contact.contact_window_ms)
  const contactCount =
    typeof contact.yolo_contact_count === 'number' ? contact.yolo_contact_count : 0
  if (contactMs != null && contactMs >= 0 && contactCount > 0) {
    const value = fmtMs(contactMs)
    rows.push({
      id: 'contact_window',
      text: `${labels.contactWindow}: ${value}`,
      label: labels.contactWindow,
      value,
      accent: 'alert',
      icon: 'contact',
    })
  }

  return rows.slice(0, 4)
}

/** Show section when cite_ok or we have at least one measurable row. */
export function shouldShowMotionEvidence(summary: BiomechanicsSummary | null | undefined): boolean {
  if (!summary) return false
  // Labels don't affect presence — use empty strings for the check.
  const rows = pickPrimaryEvidenceRows(summary, {
    torsoRotation: 't',
    elbowImpact: 'e',
    wristSpeed: 'w',
    contactWindow: 'c',
  })
  if (rows.length === 0) return false
  if (summary.quality?.cite_ok === true) return true
  return rows.length >= 1
}

/** Footer line for labelled energy estimate when present. */
export function formatEnergyEstimateNote(
  summary: BiomechanicsSummary | null | undefined,
  template: string
): string | null {
  const j = asFiniteNumber(summary?.energy_est?.racket_ke_j_est)
  if (j == null || j <= 0) return null
  return template.replace('{n}', String(Math.round(j * 10) / 10))
}
