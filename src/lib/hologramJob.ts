import { useEffect, useState } from 'react'
import { authClient } from './auth-client'
import { resolveUploadUrl } from './mediaUrl'

export type HologramStatus = 'idle' | 'running' | 'done' | 'failed'

/** Joint on the hologram image, 0..1 from the top-left (player's own left/right). */
export type HologramKeypoint = { x: number; y: number; score: number }
export type HologramKeypoints = Record<string, HologramKeypoint>

export type HologramState = {
  status: HologramStatus
  /** Absolute URL of the hologram PNG once it is done. */
  image: string | null
  /** Contact skeleton in the image's framing; null for holograms built before keypoints existed. */
  keypoints: HologramKeypoints | null
  error: string | null
}

function parseKeypoints(raw: unknown): HologramKeypoints | null {
  if (!raw || typeof raw !== 'object') return null
  const out: HologramKeypoints = {}
  for (const [name, v] of Object.entries(raw as Record<string, unknown>)) {
    const p = v as Partial<HologramKeypoint> | null
    if (p && typeof p.x === 'number' && typeof p.y === 'number') out[name] = { x: p.x, y: p.y, score: p.score ?? 1 }
  }
  return Object.keys(out).length ? out : null
}

const POLL_MS = 5_000

function toState(raw: unknown): HologramState | null {
  const body = ((raw as { data?: unknown })?.data ?? raw) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') return null
  const status = body.status
  if (status !== 'idle' && status !== 'running' && status !== 'done' && status !== 'failed') return null
  return {
    status,
    image: resolveUploadUrl(typeof body.image === 'string' ? body.image : null),
    keypoints: parseKeypoints(body.keypoints),
    error: typeof body.error === 'string' ? body.error : null,
  }
}

/**
 * Kicks off the hologram of the player at ball contact. Fire-and-forget: the server runs it
 * detached and the Smart 3D view polls for the result.
 */
export async function startHologram(analysisId: string, contactMs?: number | null): Promise<HologramState | null> {
  const res = await authClient
    .$fetch('/technique/hologram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ analysisId, ...(contactMs != null ? { contactMs } : {}) }),
    })
    .catch(() => null)
  return res ? toState(res) : null
}

async function fetchHologram(analysisId: string): Promise<HologramState | null> {
  const res = await authClient
    .$fetch(`/technique/analysis/${analysisId}/hologram`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    .catch(() => null)
  return res ? toState(res) : null
}

/**
 * Hologram for a saved shot. Shots analysed before this existed have none yet, so an idle job is
 * started once from the analysis' own impact frame.
 */
export function useHologram(analysisId: string | null | undefined): HologramState {
  const [state, setState] = useState<HologramState>({
    status: 'idle',
    image: null,
    keypoints: null,
    error: null,
  })

  useEffect(() => {
    if (!analysisId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let started = false

    const tick = async () => {
      let next = await fetchHologram(analysisId)
      if (cancelled) return
      if (next?.status === 'idle' && !started) {
        started = true
        next = (await startHologram(analysisId)) ?? next
        if (cancelled) return
      }
      if (next) setState(next)
      if (!next || next.status === 'running') timer = setTimeout(tick, POLL_MS)
    }
    void tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [analysisId])

  return state
}
