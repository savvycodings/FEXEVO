import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import i18n from '../i18n'
import { authClient } from './auth-client'
import { ensureCorrectionNotificationPermission, notifyMagicShotReady } from './correctionImageNotifications'

export type MagicShotStatus = 'idle' | 'starting' | 'running' | 'done' | 'failed'

export type MagicShotVideo = {
  frame: number
  startImage: string
  video: string
  poseVideo?: string
  windowStartMs: number | null
  windowEndMs: number | null
}

type JobSnapshot = {
  status: Exclude<MagicShotStatus, 'starting'>
  startedAt: string | null
  error: string | null
  video: MagicShotVideo | null
}

type PendingJob = { analysisId: string; startedAt: string | null }

const PENDING_KEY = 'magicShot.pending'
const POLL_MS = 10_000

function parseVideo(body: Record<string, unknown>): MagicShotVideo | null {
  const video = typeof body.video === 'string' ? body.video.trim() : ''
  if (!video) return null
  const poseVideo = typeof body.poseVideo === 'string' ? body.poseVideo.trim() : ''
  return {
    frame: typeof body.frame === 'number' ? body.frame : 0,
    startImage: typeof body.startImage === 'string' ? body.startImage : '',
    video,
    ...(poseVideo ? { poseVideo } : {}),
    windowStartMs: typeof body.windowStartMs === 'number' ? body.windowStartMs : null,
    windowEndMs: typeof body.windowEndMs === 'number' ? body.windowEndMs : null,
  }
}

function extractError(raw: any): string | null {
  const candidates = [raw?.error?.error, raw?.error?.message, raw?.error, raw?.message]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return null
}

function toSnapshot(raw: unknown): JobSnapshot | null {
  const body = ((raw as { data?: unknown })?.data ?? raw) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') return null
  const video = parseVideo(body)
  const status =
    body.status === 'running' || body.status === 'failed' || body.status === 'idle'
      ? body.status
      : video
        ? 'done'
        : body.status === 'done'
          ? 'done'
          : null
  if (!status) return null
  return {
    status,
    startedAt: typeof body.startedAt === 'string' ? body.startedAt : null,
    error: typeof body.error === 'string' ? body.error : null,
    video,
  }
}

async function fetchJob(analysisId: string): Promise<JobSnapshot | null> {
  const res = await authClient
    .$fetch(`/technique/analysis/${analysisId}/correction-videos`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    .catch(() => null)
  if (!res || (res as { error?: unknown }).error) return null
  return toSnapshot(res)
}

async function readPending(): Promise<PendingJob[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list)
      ? list.filter(
          (p): p is PendingJob => !!p && typeof (p as PendingJob).analysisId === 'string'
        )
      : []
  } catch {
    return []
  }
}

async function writePending(list: PendingJob[]) {
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(list)).catch(() => {})
}

async function addPending(job: PendingJob) {
  const list = await readPending()
  await writePending([...list.filter((p) => p.analysisId !== job.analysisId), job])
}

/** In-flight claims, so the screen hook and the app-wide watcher never both notify. */
const claiming = new Set<string>()

/** Removes a pending job; resolves true only for the caller that actually removed it. */
async function claimPending(analysisId: string): Promise<boolean> {
  if (claiming.has(analysisId)) return false
  claiming.add(analysisId)
  try {
    const list = await readPending()
    if (!list.some((p) => p.analysisId === analysisId)) return false
    await writePending(list.filter((p) => p.analysisId !== analysisId))
    return true
  } finally {
    claiming.delete(analysisId)
  }
}

async function settle(analysisId: string, snap: JobSnapshot) {
  if (snap.status === 'running') return
  const claimed = await claimPending(analysisId)
  if (claimed && snap.status === 'done') {
    await notifyMagicShotReady({
      analysisId,
      title: i18n.t('technique.magicShot.notificationTitle'),
      body: i18n.t('technique.magicShot.notificationBody'),
    })
  }
}

async function checkPendingJobs(): Promise<number> {
  const list = await readPending()
  let stillRunning = 0
  for (const p of list) {
    const snap = await fetchJob(p.analysisId)
    if (!snap) {
      stillRunning += 1
      continue
    }
    if (snap.status === 'running') stillRunning += 1
    else await settle(p.analysisId, snap)
  }
  return stillRunning
}

/**
 * App-wide: checks remembered Magic Shot jobs on launch, on every return to the foreground and
 * periodically while any is still running, so the "ready" banner fires whichever screen is open.
 */
export function watchPendingMagicShots(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  const run = async () => {
    if (timer) clearTimeout(timer)
    timer = null
    if (stopped || AppState.currentState !== 'active') return
    const running = await checkPendingJobs()
    if (!stopped && running > 0 && AppState.currentState === 'active') {
      timer = setTimeout(() => void run(), POLL_MS * 2)
    }
  }

  void run()
  const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
    if (s === 'active') void run()
  })
  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
    sub.remove()
  }
}

/**
 * Magic Shot generation for one analysis. The server runs the job detached from the request,
 * so this only starts it and then follows its status; leaving the screen or the app loses
 * nothing, and the next focus, app resume or launch picks the job back up.
 */
export function useMagicShotJob(analysisId: string | null, enabled: boolean) {
  const [status, setStatus] = useState<MagicShotStatus>('idle')
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [video, setVideo] = useState<MagicShotVideo | null>(null)
  const [focused, setFocused] = useState(false)
  const [appActive, setAppActive] = useState(AppState.currentState === 'active')

  /** Bumped on analysis change; responses from an older generation are dropped. */
  const generation = useRef(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      setFocused(true)
      return () => setFocused(false)
    }, [])
  )

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'))
    return () => sub.remove()
  }, [])

  const apply = useCallback((snap: JobSnapshot) => {
    setStatus(snap.status)
    setStartedAt(snap.startedAt)
    setError(snap.status === 'failed' ? snap.error : null)
    setVideo(snap.status === 'done' ? snap.video : null)
  }, [])

  const refresh = useCallback(async () => {
    if (!analysisId || !enabled) return
    const gen = generation.current
    const snap = await fetchJob(analysisId)
    if (!snap || !mounted.current || gen !== generation.current) return
    apply(snap)
    await settle(analysisId, snap)
  }, [analysisId, enabled, apply])

  useEffect(() => {
    generation.current += 1
    setStatus('idle')
    setStartedAt(null)
    setError(null)
    setVideo(null)
    if (analysisId && enabled) void refresh()
  }, [analysisId, enabled, refresh])

  useEffect(() => {
    if (focused && appActive) void refresh()
  }, [focused, appActive, refresh])

  useEffect(() => {
    if (status !== 'running' || !focused || !appActive) return
    const id = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(id)
  }, [status, focused, appActive, refresh])

  const start = useCallback(
    async (opts?: { forceRegenerate?: boolean }) => {
      if (!analysisId || !enabled) return
      if (status === 'starting' || status === 'running') return
      const gen = generation.current
      setStatus('starting')
      setError(null)
      void ensureCorrectionNotificationPermission()
      const res = await authClient
        .$fetch('/technique/correction-videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ analysisId, forceRegenerate: opts?.forceRegenerate === true }),
        })
        .catch((err: unknown) => ({ error: err }))
      if (!mounted.current || gen !== generation.current) return
      const failure = (res as { error?: unknown })?.error
      if (failure) {
        setStatus('failed')
        setError(extractError(res) ?? i18n.t('technique.magicShot.failed'))
        return
      }
      const snap = toSnapshot(res)
      if (!snap) {
        setStatus('failed')
        setError(i18n.t('technique.magicShot.failed'))
        return
      }
      if (snap.status === 'running') {
        await addPending({ analysisId, startedAt: snap.startedAt })
      }
      apply(snap)
    },
    [analysisId, enabled, status, apply]
  )

  return { status, startedAt, error, video, start, refresh }
}
