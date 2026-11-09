import { useEffect, useState } from 'react'
import type { TFunction } from 'i18next'
import { DOMAIN } from '../../../constants'
import { authClient } from '../../lib/auth-client'
import { type BiomechanicsSummary, parseBiomechanicsSummary } from '../../lib/biomechanicsSummary'
import { type ActivityItem, listFromFetch } from '../coachHome/coachHomeData'

export type CompareMetricKey = 'shoulder' | 'elbow' | 'wrist' | 'torso' | 'knee'

export type CompareMetric = {
  key: CompareMetricKey
  label: string
  deg: number
}

const METRIC_ORDER: CompareMetricKey[] = ['shoulder', 'elbow', 'wrist', 'torso', 'knee']

function pushDeg(out: CompareMetric[], key: CompareMetricKey, label: string, deg: unknown) {
  if (typeof deg === 'number' && Number.isFinite(deg)) {
    out.push({ key, label, deg })
  }
}

/** Contact angles for Save & Track — same joints the Biggest Mistakes / View Angles lists use. */
export function buildCompareMetrics(
  metrics: Record<string, unknown> | null | undefined,
  t: TFunction
): CompareMetric[] {
  return compareMetricsFromSummary(parseBiomechanicsSummary(metrics), t)
}

export function compareMetricsFromSummary(
  summary: BiomechanicsSummary | null | undefined,
  t: TFunction
): CompareMetric[] {
  const angles = summary?.angles_deg_proxy
  const out: CompareMetric[] = []
  pushDeg(out, 'elbow', t('analysis.elbowAngle'), angles?.elbow_impact_deg)
  pushDeg(
    out,
    'torso',
    t('analysis.torsoRotation'),
    angles?.torso_sep_delta_deg ?? angles?.shoulder_hip_sep_impact_deg
  )
  pushDeg(out, 'knee', t('analysis.jointName.knee'), angles?.knee_impact_deg)
  return out
}

/** Merge biomechanics proxies with live contact-joint readings from the pro library. */
export function mergeCompareMetrics(
  base: CompareMetric[],
  joints: Partial<Record<CompareMetricKey, number | null | undefined>> | null | undefined,
  t: TFunction
): CompareMetric[] {
  const byKey = new Map<CompareMetricKey, CompareMetric>()
  for (const m of base) byKey.set(m.key, m)
  const labels: Record<CompareMetricKey, string> = {
    shoulder: t('analysis.jointName.shoulder'),
    elbow: t('analysis.elbowAngle'),
    wrist: t('analysis.jointName.wrist'),
    torso: t('analysis.torsoRotation'),
    knee: t('analysis.jointName.knee'),
  }
  if (joints) {
    for (const key of METRIC_ORDER) {
      const deg = joints[key]
      if (typeof deg === 'number' && Number.isFinite(deg)) {
        byKey.set(key, { key, label: labels[key], deg })
      }
    }
  }
  return METRIC_ORDER.map((key) => byKey.get(key)).filter((m): m is CompareMetric => m != null)
}

export type ShotHistoryPoint = {
  analysisId: string
  createdAt: string
  score: number | null
}

export type PreviousShot = ShotHistoryPoint & {
  videoUri: string | null
  metrics: Record<string, unknown> | null
}

export type ShotHistory = {
  loading: boolean
  /** Human shot label shared by every point, e.g. "Forehand Volley". */
  shotLabel: string | null
  /** Completed analyses of this shot type, oldest first, ending with the current one. */
  points: ShotHistoryPoint[]
  /** Latest analysis of this shot type before the current one. */
  previous: PreviousShot | null
}

const EMPTY: ShotHistory = { loading: false, shotLabel: null, points: [], previous: null }

function absoluteUrl(path: string): string {
  if (path.startsWith('http')) return path
  return `${DOMAIN.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`
}

const time = (iso?: string) => (iso ? Date.parse(iso) : NaN)

/**
 * The player's history for the shot type of `analysisId`: the activities list gives the label,
 * date and score of every analysis, and the previous one's metrics are fetched for its angles.
 */
export function useShotHistory(analysisId: string | null | undefined): ShotHistory {
  const [state, setState] = useState<ShotHistory>(analysisId ? { ...EMPTY, loading: true } : EMPTY)

  useEffect(() => {
    if (!analysisId) {
      setState(EMPTY)
      return
    }
    let cancelled = false
    setState({ ...EMPTY, loading: true })
    ;(async () => {
      const res = await authClient
        .$fetch<{ items?: ActivityItem[] }>('/technique/activities', { method: 'GET' })
        .catch(() => null)
      const items = listFromFetch<ActivityItem>(res) ?? []
      const current = items.find((i) => i.analysisId === analysisId)
      const label = current?.shotLabel?.trim() || null
      if (!current || !label) {
        if (!cancelled) setState(EMPTY)
        return
      }
      const currentAt = time(current.createdAt)
      const sameShot = items
        .filter(
          (i) =>
            i.analysisId &&
            i.status === 'completed' &&
            i.shotLabel?.trim() === label &&
            Number.isFinite(time(i.createdAt)) &&
            (i.analysisId === analysisId || time(i.createdAt) < currentAt)
        )
        .sort((a, b) => time(a.createdAt) - time(b.createdAt))
      const points: ShotHistoryPoint[] = sameShot.map((i) => ({
        analysisId: i.analysisId as string,
        createdAt: i.createdAt as string,
        score: typeof i.score === 'number' && Number.isFinite(i.score) ? Math.round(i.score) : null,
      }))
      if (!points.some((p) => p.analysisId === analysisId)) {
        points.push({ analysisId, createdAt: current.createdAt ?? new Date().toISOString(), score: null })
      }
      const prevItem = sameShot.filter((i) => i.analysisId !== analysisId).pop()
      let previous: PreviousShot | null = null
      if (prevItem?.analysisId) {
        const prevRes = await authClient
          .$fetch<{ metrics?: Record<string, unknown> | null }>(`/technique/analysis/${prevItem.analysisId}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          })
          .catch(() => null)
        const body = ((prevRes as { data?: unknown } | null)?.data ?? prevRes) as {
          metrics?: Record<string, unknown> | null
        } | null
        const point = points.find((p) => p.analysisId === prevItem.analysisId)
        previous = {
          analysisId: prevItem.analysisId,
          createdAt: prevItem.createdAt as string,
          score: point?.score ?? null,
          videoUri: prevItem.videoPath ? absoluteUrl(prevItem.videoPath) : null,
          metrics: body?.metrics ?? null,
        }
      }
      if (!cancelled) setState({ loading: false, shotLabel: label, points, previous })
    })().catch(() => {
      if (!cancelled) setState(EMPTY)
    })
    return () => {
      cancelled = true
    }
  }, [analysisId])

  return state
}
