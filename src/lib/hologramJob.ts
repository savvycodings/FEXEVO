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
  /** User-facing Seedance / privacy failure when orbitStatus is failed. */
  orbitError: string | null
  /** Red hologram of the matched pro-library clip. */
  proStatus: HologramStatus
  proImage: string | null
  proKeypoints: HologramKeypoints | null
  /** False until the first GET returns — avoids a false "building" flash on reopen. */
  ready: boolean
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

const EMPTY: HologramState = {
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
  orbitError: null,
  proStatus: 'idle',
  proImage: null,
  proKeypoints: null,
  ready: false,
}

function toState(raw: unknown): HologramState | null {
  const body = ((raw as { data?: unknown })?.data ?? raw) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') return null
  const status = body.status
  if (status !== 'idle' && status !== 'running' && status !== 'done' && status !== 'failed') return null
  const proStatus = body.proStatus
  const orbitVideo = resolveUploadUrl(typeof body.orbitVideo === 'string' ? body.orbitVideo : null)
  let orbitStatus: HologramStatus =
    body.orbitStatus === 'running' || body.orbitStatus === 'done' || body.orbitStatus === 'failed'
      ? body.orbitStatus
      : 'idle'
  // Saved clip always means done — never treat a stuck job as "still building".
  if (orbitVideo) orbitStatus = 'done'
  return {
    status,
    image: resolveUploadUrl(typeof body.image === 'string' ? body.image : null),
    keypoints: parseKeypoints(body.keypoints),
    error: typeof body.error === 'string' ? body.error : null,
    orbitStatus,
    orbitVideo,
    orbitDurationMs: num(body.orbitDurationMs),
    orbitFrameCount: num(body.orbitFrameCount),
    orbitWidth: num(body.orbitWidth),
    orbitHeight: num(body.orbitHeight),
    orbitFrames: parseOrbitFrames(body.orbitFrames),
    orbitError: typeof body.orbitError === 'string' ? body.orbitError : null,
    proStatus:
      proStatus === 'running' || proStatus === 'done' || proStatus === 'failed' ? proStatus : 'idle',
    proImage: resolveUploadUrl(typeof body.proImage === 'string' ? body.proImage : null),
    proKeypoints: parseKeypoints(body.proKeypoints),
    ready: true,
  }
}

/**
 * Kicks off the hologram of the player at ball contact. Fire-and-forget: the server runs it
 * detached and the Smart 3D view polls for the result.
 */
export async function startHologram(
  analysisId: string,
  contactMs?: number | null,
  contactFrame?: number | null,
  forceRegenerate = false
): Promise<HologramState | null> {
  const res = await authClient
    .$fetch('/technique/hologram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        analysisId,
        ...(contactMs != null ? { contactMs } : {}),
        ...(contactFrame != null ? { contactFrame } : {}),
        ...(forceRegenerate ? { forceRegenerate: true } : {}),
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

/** True once the contact still (and its joints) are ready — orbit/spin is a separate step. */
function hasContactStill(state: HologramState | null | undefined): boolean {
  return Boolean(state && state.status === 'done' && state.image)
}

function hasOrbit(state: HologramState | null | undefined): boolean {
  return Boolean(state?.orbitVideo)
}

/**
 * Hologram for a saved shot. Polls until the contact still is back, then until the orbit
 * clip is ready (or fails). POST only kicks generation when nothing is saved yet —
 * a finished orbit is never regenerated on reopen.
 */
export function useHologram(analysisId: string | null | undefined): HologramState {
  const [state, setState] = useState<HologramState>(EMPTY)

  useEffect(() => {
    if (!analysisId) return
    let cancelled = false
    let startedStill = false
    let kickedOrbit = false
    let timer: ReturnType<typeof setInterval> | null = null

    const stop = () => {
      if (timer) clearInterval(timer)
      timer = null
    }

    const tick = async () => {
      let next = await fetchHologram(analysisId)
      if (cancelled) return
      // Idle, failed, or a "done" row with no image yet — kick (or force-retry) the still.
      const needsStill = !hasContactStill(next) && next?.status !== 'running'
      if (needsStill && !startedStill) {
        startedStill = true
        const force = next?.status === 'failed' || (next?.status === 'done' && !next.image)
        next = (await startHologram(analysisId, null, null, force)) ?? next
        if (cancelled) return
      }
      // Still ready, no saved orbit clip, and not already running — kick Seedance once.
      // Never POST when orbitVideo is present (reopen must reuse the saved mp4).
      // Retry once after a prior failed orbit so a newly enabled HOLOGRAM_ORBIT_ENABLED can recover.
      const needsOrbitKick =
        hasContactStill(next) &&
        !hasOrbit(next) &&
        next?.orbitStatus !== 'running' &&
        next?.orbitStatus !== 'done' &&
        !kickedOrbit
      if (needsOrbitKick) {
        kickedOrbit = true
        next = (await startHologram(analysisId)) ?? next
        if (cancelled) return
      }
      if (next) {
        setState(next)
        if (__DEV__) {
          console.log('[hologram] poll', {
            analysisId,
            status: next.status,
            image: Boolean(next.image),
            orbitStatus: next.orbitStatus,
            orbitVideo: next.orbitVideo ? next.orbitVideo.slice(0, 120) : null,
            orbitError: next.orbitError,
            orbitFrames: next.orbitFrames?.length ?? 0,
            orbitSize:
              next.orbitWidth && next.orbitHeight ? `${next.orbitWidth}x${next.orbitHeight}` : null,
          })
        }
      }
      // Keep polling while the turn job is running even if a premature orbitVideo appeared
      // (disk heal can surface the mp4 before MediaPipe frames are written).
      const pending =
        !hasContactStill(next) ||
        next?.status === 'running' ||
        next?.proStatus === 'running' ||
        next?.orbitStatus === 'running' ||
        (hasContactStill(next) &&
          !hasOrbit(next) &&
          next?.orbitStatus !== 'failed')
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
