import { useEffect, useState } from 'react'
import { authClient } from './auth-client'
import { resolveUploadUrl } from './mediaUrl'

export type HologramStatus = 'idle' | 'running' | 'done' | 'failed'

/** Joint on the hologram image, 0..1 from the top-left (player's own left/right). */
export type HologramKeypoint = { x: number; y: number; score: number }
export type HologramKeypoints = Record<string, HologramKeypoint>

/** MediaPipe joints for one frame of the orbit clip. */
export type HologramOrbitFrame = { frame: number; keypoints: HologramKeypoints }

export type HologramState = {
  status: HologramStatus
  /** Absolute URL of the hologram PNG once it is done. */
  image: string | null
  /** Contact skeleton in the image's framing; null for holograms built before keypoints existed. */
  keypoints: HologramKeypoints | null
  error: string | null
  /** Seedance orbit. Finger forward/back scrubs this clip. */
  orbitStatus: HologramStatus
  orbitVideo: string | null
  orbitDurationMs: number | null
  orbitFrameCount: number | null
  orbitWidth: number | null
  orbitHeight: number | null
  orbitFrames: HologramOrbitFrame[] | null
  /** Red hologram of the matched pro-library clip. */
  proStatus: HologramStatus
  proImage: string | null
  proKeypoints: HologramKeypoints | null
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

function parseOrbitFrames(raw: unknown): HologramOrbitFrame[] | null {
  if (!Array.isArray(raw)) return null
  const out: HologramOrbitFrame[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as { frame?: unknown; keypoints?: unknown }
    const keypoints = parseKeypoints(row.keypoints)
    if (typeof row.frame !== 'number' || !keypoints) continue
    out.push({ frame: row.frame, keypoints })
  }
  return out.length ? out : null
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null
}

const POLL_MS = 5_000

function toState(raw: unknown): HologramState | null {
  const body = ((raw as { data?: unknown })?.data ?? raw) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') return null
  const status = body.status
  if (status !== 'idle' && status !== 'running' && status !== 'done' && status !== 'failed') return null
  const proStatus = body.proStatus
  return {
    status,
    image: resolveUploadUrl(typeof body.image === 'string' ? body.image : null),
    keypoints: parseKeypoints(body.keypoints),
    error: typeof body.error === 'string' ? body.error : null,
    orbitStatus:
      body.orbitStatus === 'running' || body.orbitStatus === 'done' || body.orbitStatus === 'failed'
        ? body.orbitStatus
        : 'idle',
    orbitVideo: resolveUploadUrl(typeof body.orbitVideo === 'string' ? body.orbitVideo : null),
    orbitDurationMs: num(body.orbitDurationMs),
    orbitFrameCount: num(body.orbitFrameCount),
    orbitWidth: num(body.orbitWidth),
    orbitHeight: num(body.orbitHeight),
    orbitFrames: parseOrbitFrames(body.orbitFrames),
    proStatus:
      proStatus === 'running' || proStatus === 'done' || proStatus === 'failed' ? proStatus : 'idle',
    proImage: resolveUploadUrl(typeof body.proImage === 'string' ? body.proImage : null),
    proKeypoints: parseKeypoints(body.proKeypoints),
  }
}

/**
 * Kicks off the hologram of the player at ball contact. Fire-and-forget: the server runs it
 * detached and the Smart 3D view polls for the result.
 */
export async function startHologram(
  analysisId: string,
  contactMs?: number | null,
  contactFrame?: number | null
): Promise<HologramState | null> {
  const res = await authClient
    .$fetch('/technique/hologram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        analysisId,
        ...(contactMs != null ? { contactMs } : {}),
        ...(contactFrame != null ? { contactFrame } : {}),
      }),
    })
    .catch(() => null)
  return res ? toState(res) : null
}

async function fetchHologram(analysisId: string): Promise<HologramState | null> {
  const res = await authClient
    .$fetch(`/technique/analysis/${analysisId}/hologram?t=${Date.now()}`, {
      method: 'GET',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      cache: 'no-store',
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
    orbitStatus: 'idle',
    orbitVideo: null,
    orbitDurationMs: null,
    orbitFrameCount: null,
    orbitWidth: null,
    orbitHeight: null,
    orbitFrames: null,
    proStatus: 'idle',
    proImage: null,
    proKeypoints: null,
  })

  useEffect(() => {
    if (!analysisId) return
    let cancelled = false
    let started = false
    let timer: ReturnType<typeof setInterval> | null = null

    const stop = () => {
      if (timer) clearInterval(timer)
      timer = null
    }

    const tick = async () => {
      let next = await fetchHologram(analysisId)
      if (cancelled) return
      const needsOrbit = next?.status === 'done' && next.orbitStatus === 'idle' && !next.orbitVideo
      if ((next?.status === 'idle' || needsOrbit) && !started) {
        started = true
        next = (await startHologram(analysisId)) ?? next
        if (cancelled) return
      }
      if (next) setState(next)
      const pending =
        !next ||
        next.status === 'idle' ||
        next.status === 'running' ||
        next.proStatus === 'running' ||
        next.orbitStatus === 'running' ||
        (next.status === 'done' && !next.orbitVideo && next.orbitStatus !== 'failed' && !started)
      if (!pending) stop()
    }

    void tick()
    timer = setInterval(() => {
      void tick()
    }, POLL_MS)
    return () => {
      cancelled = true
      stop()
    }
  }, [analysisId])

  return state
}
