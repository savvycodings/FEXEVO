import { useEffect, useState } from 'react'
import { authClient } from './auth-client'
import { localCatalogueDrills } from './drillLocalCatalogue'

export type DrillFocus = 'elbow' | 'racket' | 'torso' | 'foot'
export type DrillLevel = 'beginner' | 'intermediate' | 'advanced'

/** One suggested drill, already in the requested language. From GET /technique/drills. */
export type Drill = {
  slug: string
  level: DrillLevel
  minutes: number
  focus: DrillFocus[]
  videoUrl: string | null
  title: string
  summary: string
  focusLabel: string
  steps: DrillStepCopy[]
}

/** Icon beside a step key point. */
export type DrillKeyPointIcon = 'split' | 'eye' | 'target' | 'posture' | 'racket'
export type DrillStepKeyPoint = { title: string; text: string; icon: DrillKeyPointIcon }

/** A step is either its one-line instruction, or a titled step with its own key points. */
export type DrillStepCopy = string | { title: string; subtitle: string; keyPoints: DrillStepKeyPoint[] }

/** The step's own title, or null for a plain one-line step. */
export function stepTitle(step: DrillStepCopy | undefined): string | null {
  return step && typeof step === 'object' ? step.title : null
}

/** The step's line of text: the subtitle, or the plain instruction. */
export function stepText(step: DrillStepCopy | undefined): string {
  if (!step) return ''
  return typeof step === 'string' ? step : step.subtitle
}

/** Key points written for this step (empty for a plain step). */
export function stepKeyPoints(step: DrillStepCopy | undefined): DrillStepKeyPoint[] {
  return step && typeof step === 'object' && Array.isArray(step.keyPoints) ? step.keyPoints : []
}

export type DrillsState = { status: 'loading' | 'ready' | 'error'; drills: Drill[] }

/** The server sends `{ data: { drills } }`, and $fetch wraps that in its own `{ data }`. */
function toDrills(raw: unknown): Drill[] {
  let body = raw as { data?: unknown; drills?: unknown } | null
  for (let i = 0; i < 3 && body && !Array.isArray(body.drills); i++) {
    body = (body.data ?? null) as typeof body
  }
  return Array.isArray(body?.drills) ? (body!.drills as Drill[]) : []
}

/** Drills for this shot, most relevant first. `focus` is most important first. */
export function useDrills(focus: DrillFocus[], shotLabel: string | null, lang: string, limit = 3): DrillsState {
  const [state, setState] = useState<DrillsState>({ status: 'loading', drills: [] })
  const focusKey = focus.join(',')
  useEffect(() => {
    let cancelled = false
    const focusList = focusKey.split(',').filter(Boolean) as DrillFocus[]
    setState((prev) => ({ status: 'loading', drills: prev.drills }))
    const q = new URLSearchParams({ focus: focusKey, lang: lang.startsWith('es') ? 'es' : 'en', limit: String(limit) })
    if (shotLabel) q.set('shot', shotLabel)
    authClient
      .$fetch(`/technique/drills?${q.toString()}`, { method: 'GET', headers: { Accept: 'application/json' } })
      .then((res) => {
        if (cancelled) return
        // $fetch resolves with { data, error } rather than throwing on HTTP errors.
        if ((res as { error?: unknown })?.error) {
          setState({
            status: 'ready',
            drills: localCatalogueDrills(focusList, shotLabel, lang, limit),
          })
          return
        }
        const drills = toDrills(res)
        setState({
          status: 'ready',
          drills: drills.length ? drills : localCatalogueDrills(focusList, shotLabel, lang, limit),
        })
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: 'ready',
            drills: localCatalogueDrills(focusList, shotLabel, lang, limit),
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [focusKey, shotLabel, lang, limit])
  return state
}
