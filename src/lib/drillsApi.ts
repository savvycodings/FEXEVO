import { useEffect, useState } from 'react'
import { authClient } from './auth-client'

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
  steps: string[]
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
    setState((prev) => ({ status: 'loading', drills: prev.drills }))
    const q = new URLSearchParams({ focus: focusKey, lang: lang.startsWith('es') ? 'es' : 'en', limit: String(limit) })
    if (shotLabel) q.set('shot', shotLabel)
    authClient
      .$fetch(`/technique/drills?${q.toString()}`, { method: 'GET', headers: { Accept: 'application/json' } })
      .then((res) => {
        if (cancelled) return
        // $fetch resolves with { data, error } rather than throwing on HTTP errors.
        if ((res as { error?: unknown })?.error) setState({ status: 'error', drills: [] })
        else setState({ status: 'ready', drills: toDrills(res) })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', drills: [] })
      })
    return () => {
      cancelled = true
    }
  }, [focusKey, shotLabel, lang, limit])
  return state
}
