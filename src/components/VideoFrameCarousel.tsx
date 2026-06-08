import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Image, StyleSheet, Platform, PanResponder } from 'react-native'
import { getThumbnailAsync } from 'expo-video-thumbnails'
import * as FileSystem from 'expo-file-system/legacy'
import Feather from '@expo/vector-icons/Feather'

const SHELL_BG = '#071741'
const SHELL_BORDER = '#1657CF'
const TRACK_HEIGHT = 72
/** Inset above/below thumbnail strip inside the track (shows more “border” around frames). */
const FRAME_VERTICAL_INSET = 6
const FRAME_STRIP_HEIGHT = TRACK_HEIGHT - 2 * FRAME_VERTICAL_INSET
const TRACK_RADIUS = 12
const FRAME_WIDTH = 44
const FRAME_GAP = 2
const FRAME_STEP = FRAME_WIDTH + FRAME_GAP
const HANDLE_WIDTH = 20
const HANDLE_CORNER_RADIUS = 3
/** Nudge left handle slightly past inner edge to kill subpixel seam (stripInner overflow visible). */
const HANDLE_LEFT_EDGE_BLEED = 2
const MIN_HANDLE_HIT_SLOP = 22

export type VideoFrameCarouselFrame = {
  id: string
  timeMs: number
  uri: string | null
}

export type VideoFrameCarouselProps = {
  videoUri: string
  durationMs: number
  durationSec?: number | null
  progress: number
  onProgressChange: (progress: number) => void
  framesEvery?: number
  videoFps?: number
  extractIntervalSec?: number
  maxFrames?: number
  trimStartMs: number
  trimEndMs: number
  minClipDurationMs?: number
  /** Cap selected range length (AI Coach: 3s max to Modal). */
  maxClipDurationMs?: number
  onTrimChange: (next: { startMs: number; endMs: number }) => void
  onScrubStart?: () => void
  onScrubEnd?: () => void
  onCenterFrameImageUriChange?: (uri: string | null) => void
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

function fmt(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function timeMsToStripX(ms: number, durationMs: number, viewportW: number): number {
  if (durationMs <= 0 || viewportW <= 0) return 0
  return (Math.max(0, Math.min(durationMs, ms)) / durationMs) * viewportW
}

function applyMaxClipDuration(
  startMs: number,
  endMs: number,
  durationMs: number,
  minClipDurationMs: number,
  maxClipDurationMs: number | undefined,
  anchor: 'start' | 'end'
): { startMs: number; endMs: number } {
  let start = Math.max(0, Math.min(durationMs, startMs))
  let end = Math.max(start + minClipDurationMs, Math.min(durationMs, endMs))
  const cap = maxClipDurationMs
  if (cap == null || cap <= 0 || end - start <= cap) return { startMs: start, endMs: end }
  if (anchor === 'end') {
    start = Math.max(0, end - cap)
  } else {
    end = Math.min(durationMs, start + cap)
  }
  return { startMs: start, endMs: end }
}

export function normalizeThumbnailImageUri(raw: string): string {
  const u = typeof raw === 'string' ? raw.trim() : ''
  if (!u) return u
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return u
  return `file://${u}`
}

type ResolvedThumbSource = {
  path: string
  dispose: () => Promise<void>
}

async function resolveVideoSourceForThumbnails(rawUri: string): Promise<ResolvedThumbSource> {
  const noop = async () => {}
  if (Platform.OS === 'web') return { path: rawUri, dispose: noop }

  const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory
  if (!base) return { path: rawUri, dispose: noop }

  if (rawUri.startsWith('http://') || rawUri.startsWith('https://')) {
    const dest = `${base}vc-carousel-${Date.now()}.mp4`
    try {
      const result = await FileSystem.downloadAsync(rawUri, dest)
      const path = result.uri && result.uri.length > 0 ? result.uri : dest
      return {
        path,
        dispose: async () => {
          try {
            await FileSystem.deleteAsync(path, { idempotent: true })
          } catch {
            /* ignore */
          }
        },
      }
    } catch {
      return { path: rawUri, dispose: noop }
    }
  }

  if (rawUri.startsWith('file://') || rawUri.startsWith('content://')) {
    return { path: rawUri, dispose: noop }
  }

  const dest = `${base}vc-carousel-copy-${Date.now()}.mp4`
  try {
    await FileSystem.copyAsync({ from: rawUri, to: dest })
    return { path: dest.startsWith('file://') ? dest : `file://${dest}`, dispose: noop }
  } catch {
    return { path: rawUri, dispose: noop }
  }
}

function buildFrameTimes(durationMs: number, intervalSec: number, maxFrames: number): number[] {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return [0]
  const stepRaw = Math.max(200, Math.round(intervalSec * 1000))
  const idealCount = Math.max(1, Math.floor(durationMs / stepRaw) + 1)
  const step = idealCount > maxFrames ? Math.ceil(durationMs / (maxFrames - 1)) : stepRaw
  const times: number[] = []
  for (let t = 0; t < durationMs && times.length < maxFrames; t += step) {
    times.push(Math.min(durationMs - 1, Math.round(t)))
  }
  const last = Math.max(0, durationMs - 1)
  if (times.length === 0) times.push(last)
  else if (times[times.length - 1]! < last && times.length < maxFrames) times.push(last)
  return times
}

async function extractFramesWeb(
  videoSrc: string,
  timesMs: number[],
  onFrame: (index: number, dataUrl: string) => void,
  isCancelled: () => boolean
): Promise<void> {
  if (typeof document === 'undefined') return
  const video = document.createElement('video')
  if (/^https?:/i.test(videoSrc)) video.crossOrigin = 'anonymous'
  video.muted = true
  // @ts-ignore runtime supported
  video.playsInline = true
  video.preload = 'auto'
  video.style.position = 'fixed'
  video.style.left = '0px'
  video.style.bottom = '0px'
  video.style.width = '1px'
  video.style.height = '1px'
  video.style.opacity = '0.001'
  video.style.pointerEvents = 'none'
  video.style.zIndex = '-1'
  document.body.appendChild(video)
  video.src = videoSrc

  const cleanup = () => {
    try {
      video.pause()
      video.removeAttribute('src')
      video.load()
      video.parentNode?.removeChild(video)
    } catch {
      /* ignore */
    }
  }

  const waitFor = (target: EventTarget, ok: string, fail: string[], timeoutMs: number) =>
    new Promise<void>((resolve, reject) => {
      let done = false
      const timer = setTimeout(() => {
        if (done) return
        done = true
        off()
        reject(new Error(`${ok} timeout`))
      }, timeoutMs)
      const onOk = () => {
        if (done) return
        done = true
        clearTimeout(timer)
        off()
        resolve()
      }
      const onFail = () => {
        if (done) return
        done = true
        clearTimeout(timer)
        off()
        reject(new Error('video failed'))
      }
      const off = () => {
        target.removeEventListener(ok, onOk)
        for (const f of fail) target.removeEventListener(f, onFail)
      }
      target.addEventListener(ok, onOk)
      for (const f of fail) target.addEventListener(f, onFail)
    })

  try {
    await waitFor(video, 'loadedmetadata', ['error', 'abort'], 12000)
    if (video.readyState < 2) {
      try {
        await waitFor(video, 'loadeddata', ['error'], 6000)
      } catch {
        /* continue */
      }
    }
    const w = Math.max(1, Math.min(320, video.videoWidth || 320))
    const h = Math.max(1, Math.round(w * ((video.videoHeight || 180) / (video.videoWidth || 320))))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    for (let i = 0; i < timesMs.length; i++) {
      if (isCancelled()) return
      const sec = Math.max(0, (timesMs[i] ?? 0) / 1000)
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked)
          resolve()
        }
        video.addEventListener('seeked', onSeeked)
        try {
          video.currentTime = Math.max(0, Math.min((video.duration || sec) - 0.01, sec))
        } catch {
          video.removeEventListener('seeked', onSeeked)
          resolve()
        }
      })
      try {
        ctx.drawImage(video, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        if (!isCancelled()) onFrame(i, dataUrl)
      } catch {
        /* ignore bad frame */
      }
    }
  } finally {
    cleanup()
  }
}

export function VideoFrameCarousel({
  videoUri,
  durationMs,
  durationSec,
  progress,
  onProgressChange,
  framesEvery = 5,
  videoFps = 30,
  extractIntervalSec,
  maxFrames = 120,
  trimStartMs,
  trimEndMs,
  minClipDurationMs = 400,
  maxClipDurationMs,
  onTrimChange,
  onScrubStart,
  onScrubEnd,
  onCenterFrameImageUriChange,
}: VideoFrameCarouselProps) {
  const [frames, setFrames] = useState<VideoFrameCarouselFrame[]>([])
  const [viewportW, setViewportW] = useState(0)
  const [currentTimeMs, setCurrentTimeMs] = useState(0)
  const [dragTrimStartMs, setDragTrimStartMs] = useState(trimStartMs)
  const [dragTrimEndMs, setDragTrimEndMs] = useState(trimEndMs)
  const dragModeRef = useRef<'scrub' | 'left' | 'right' | null>(null)
  const dragStartCurrentTimeRef = useRef(0)
  const dragStartTrimRef = useRef({ startMs: trimStartMs, endMs: trimEndMs })
  const isDraggingRef = useRef(false)
  const callbackRafRef = useRef<number | null>(null)
  const pendingProgressRef = useRef<number | null>(null)
  const pendingTrimRef = useRef<{ startMs: number; endMs: number } | null>(null)
  /**
   * Screen-space X of the strip's left edge. We hit-test in screen (page) coords because
   * `evt.nativeEvent.locationX` is reported relative to the *touched child* on Android,
   * which broke right-handle and scrub taps when a child intercepted the touch.
   */
  const stripOuterRef = useRef<View | null>(null)
  const stripPageXRef = useRef(0)
  const measureStrip = useCallback(() => {
    const node = stripOuterRef.current
    if (!node || typeof node.measureInWindow !== 'function') return
    node.measureInWindow((x) => {
      if (typeof x === 'number' && Number.isFinite(x)) stripPageXRef.current = x
    })
  }, [])
  const latestRef = useRef({
    clampedLeftX: 0,
    clampedRightX: 0,
    currentTimeMs: 0,
    dragTrimStartMs: 0,
    dragTrimEndMs: 0,
    durationMs: 0,
    msPerPx: 0,
    minClipDurationMs: 0,
    maxClipDurationMs: 0,
  })

  const intervalSec = useMemo(() => {
    if (typeof extractIntervalSec === 'number' && extractIntervalSec > 0) return extractIntervalSec
    const fps = videoFps > 0 ? videoFps : 30
    const every = framesEvery > 0 ? framesEvery : 5
    return every / fps
  }, [extractIntervalSec, framesEvery, videoFps])

  const times = useMemo(
    () =>
      buildFrameTimes(
        durationMs,
        intervalSec * 2,
        Math.max(8, Math.floor(maxFrames / 2))
      ),
    [durationMs, intervalSec, maxFrames]
  )

  useEffect(() => {
    if (isDraggingRef.current) return
    const lo = Math.max(0, Math.min(durationMs, dragTrimStartMs))
    const hi = Math.max(lo + minClipDurationMs, Math.min(durationMs, dragTrimEndMs))
    const target = Math.round(clamp01(progress) * durationMs)
    const clamped = Math.max(lo, Math.min(hi, target))
    setCurrentTimeMs((prev) => (Math.abs(prev - clamped) < 4 ? prev : clamped))
  }, [progress, durationMs, dragTrimStartMs, dragTrimEndMs, minClipDurationMs])

  useEffect(() => {
    if (dragModeRef.current !== 'left') setDragTrimStartMs(trimStartMs)
  }, [trimStartMs])

  useEffect(() => {
    if (dragModeRef.current !== 'right') setDragTrimEndMs(trimEndMs)
  }, [trimEndMs])

  const pxPerMs = useMemo(() => {
    if (durationMs <= 0 || viewportW <= 0) return 0
    // Full timeline always visible: map full duration to track width.
    return viewportW / durationMs
  }, [durationMs, viewportW])
  const msPerPx = pxPerMs > 0 ? 1 / pxPerMs : 0
  const safeStartMs = Math.max(0, Math.min(durationMs, dragTrimStartMs))
  const safeEndMs = Math.max(safeStartMs + minClipDurationMs, Math.min(durationMs, dragTrimEndMs))
  const playheadTimeMs = Math.max(safeStartMs, Math.min(safeEndMs, currentTimeMs))
  const playheadX = playheadTimeMs * pxPerMs

  const centerIndex = useMemo(() => {
    if (frames.length === 0) return -1
    let best = 0
    let bestD = Number.POSITIVE_INFINITY
    for (let i = 0; i < frames.length; i++) {
      const d = Math.abs((frames[i]?.timeMs ?? 0) - playheadTimeMs)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return best
  }, [frames, playheadTimeMs])

  useEffect(() => {
    if (!onCenterFrameImageUriChange) return
    if (centerIndex < 0) {
      onCenterFrameImageUriChange(null)
      return
    }
    onCenterFrameImageUriChange(frames[centerIndex]?.uri ?? null)
  }, [centerIndex, frames, onCenterFrameImageUriChange])

  const flushCallbacks = useCallback(() => {
    callbackRafRef.current = null
    const p = pendingProgressRef.current
    if (p != null) {
      pendingProgressRef.current = null
      onProgressChange(clamp01(p))
    }
    const t = pendingTrimRef.current
    if (t) {
      pendingTrimRef.current = null
      onTrimChange(t)
    }
  }, [onProgressChange, onTrimChange])

  const scheduleFlush = useCallback(() => {
    if (callbackRafRef.current != null) return
    callbackRafRef.current = requestAnimationFrame(flushCallbacks)
  }, [flushCallbacks])

  useEffect(() => {
    if (durationMs <= 0) return
    const lo = Math.max(0, Math.min(durationMs, dragTrimStartMs))
    const hi = Math.max(lo + minClipDurationMs, Math.min(durationMs, dragTrimEndMs))
    setCurrentTimeMs((prev) => {
      const n = Math.max(lo, Math.min(hi, prev))
      if (n !== prev) {
        requestAnimationFrame(() => {
          pendingProgressRef.current = n / durationMs
          scheduleFlush()
        })
      }
      return n
    })
  }, [dragTrimStartMs, dragTrimEndMs, durationMs, minClipDurationMs, scheduleFlush])

  useEffect(
    () => () => {
      if (callbackRafRef.current != null) cancelAnimationFrame(callbackRafRef.current)
    },
    []
  )

  useEffect(() => {
    if (viewportW <= 0) return
    measureStrip()
  }, [viewportW, measureStrip])

  useEffect(() => {
    let cancelled = false
    setFrames(times.map((t, i) => ({ id: `f-${i}-${t}`, timeMs: t, uri: null })))
    if (!videoUri || durationMs <= 0) {
      return () => {
        cancelled = true
      }
    }

    if (Platform.OS === 'web') {
      const built = times.map((t, i) => ({ id: `f-${i}-${t}`, timeMs: t, uri: null as string | null }))
      void extractFramesWeb(
        videoUri,
        times,
        (index, dataUrl) => {
          built[index] = {
            id: `f-${index}-${times[index]}`,
            timeMs: times[index] ?? 0,
            uri: dataUrl,
          }
          if (!cancelled) setFrames(built.slice())
        },
        () => cancelled
      )
      return () => {
        cancelled = true
      }
    }

    void (async () => {
      let disposeSource: () => Promise<void> = async () => {}
      try {
        const resolved = await resolveVideoSourceForThumbnails(videoUri)
        disposeSource = resolved.dispose
        if (cancelled) return
        const source = resolved.path
        const built = times.map((t, i) => ({ id: `f-${i}-${t}`, timeMs: t, uri: null as string | null }))

        for (let i = 0; i < times.length; i++) {
          if (cancelled) return
          const t = times[i]!
          const safeMs = Math.min(Math.max(0, t), Math.max(0, durationMs - 1))
          try {
            const { uri } = await getThumbnailAsync(source, { time: safeMs, quality: 0.82 })
            built[i] = { id: `f-${i}-${t}`, timeMs: t, uri: uri ? normalizeThumbnailImageUri(uri) : null }
          } catch {
            built[i] = { id: `f-${i}-${t}`, timeMs: t, uri: null }
          }
          if (!cancelled && (i % 3 === 2 || i === times.length - 1)) setFrames(built.slice())
        }
      } finally {
        await disposeSource()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [videoUri, durationMs, times])

  const startStripX = timeMsToStripX(safeStartMs, durationMs, viewportW)
  const endStripX = timeMsToStripX(safeEndMs, durationMs, viewportW)
  const leftHandleCenterX = startStripX + HANDLE_WIDTH / 2
  const rightHandleCenterX = endStripX - HANDLE_WIDTH / 2
  latestRef.current = {
    clampedLeftX: leftHandleCenterX,
    clampedRightX: rightHandleCenterX,
    currentTimeMs,
    dragTrimStartMs,
    dragTrimEndMs,
    durationMs,
    msPerPx,
    minClipDurationMs,
    maxClipDurationMs: maxClipDurationMs ?? 0,
  }

  const onScrubStartRef = useRef(onScrubStart)
  const onScrubEndRef = useRef(onScrubEnd)
  const scheduleFlushRef = useRef(scheduleFlush)
  const flushCallbacksRef = useRef(flushCallbacks)
  useEffect(() => {
    onScrubStartRef.current = onScrubStart
    onScrubEndRef.current = onScrubEnd
    scheduleFlushRef.current = scheduleFlush
    flushCallbacksRef.current = flushCallbacks
  }, [onScrubStart, onScrubEnd, scheduleFlush, flushCallbacks])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Capture variants prevent a parent ScrollView (KeyboardAwareScrollView in
      // technique.tsx) from stealing the gesture on Android.
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt, gestureState) => {
        // Use page coords - locationX is unreliable on Android when a child view is hit.
        const pageX =
          typeof evt.nativeEvent.pageX === 'number'
            ? evt.nativeEvent.pageX
            : gestureState.x0
        const x = pageX - stripPageXRef.current
        const { clampedLeftX: l, clampedRightX: r, currentTimeMs: c, dragTrimStartMs: s, dragTrimEndMs: e } =
          latestRef.current
        const leftDist = Math.abs(x - l)
        const rightDist = Math.abs(x - r)
        const handleSlop = Math.max(MIN_HANDLE_HIT_SLOP, HANDLE_WIDTH)
        if (leftDist <= handleSlop && leftDist <= rightDist) {
          dragModeRef.current = 'left'
        } else if (rightDist <= handleSlop) {
          dragModeRef.current = 'right'
        } else {
          dragModeRef.current = 'scrub'
          onScrubStartRef.current?.()
        }
        dragStartCurrentTimeRef.current = Math.max(s, Math.min(e, c))
        dragStartTrimRef.current = { startMs: s, endMs: e }
        isDraggingRef.current = true
      },
      onPanResponderMove: (_evt, gestureState) => {
        const mode = dragModeRef.current
        const {
          durationMs: d,
          msPerPx: mpp,
          minClipDurationMs: minDur,
          maxClipDurationMs: maxDur,
          dragTrimStartMs: s,
          dragTrimEndMs: e,
        } = latestRef.current
        if (!mode || d <= 0 || mpp <= 0) return
        const dx = gestureState.dx

        if (mode === 'scrub') {
          const raw = dragStartCurrentTimeRef.current + dx * mpp
          const next = Math.max(s, Math.min(e, raw))
          setCurrentTimeMs(next)
          pendingProgressRef.current = d > 0 ? next / d : 0
          scheduleFlushRef.current()
          return
        }

        if (mode === 'left') {
          const raw = dragStartTrimRef.current.startMs + dx * mpp
          const maxStart = Math.max(0, e - minDur)
          let nextStart = Math.round(Math.max(0, Math.min(maxStart, raw)))
          let nextEnd = e
          if (maxDur > 0 && nextEnd - nextStart > maxDur) {
            nextEnd = Math.min(d, nextStart + maxDur)
          }
          const capped = applyMaxClipDuration(nextStart, nextEnd, d, minDur, maxDur || undefined, 'start')
          setDragTrimStartMs(capped.startMs)
          setDragTrimEndMs(capped.endMs)
          pendingTrimRef.current = capped
          scheduleFlushRef.current()
          return
        }

        const raw = dragStartTrimRef.current.endMs + dx * mpp
        const minEnd = Math.min(d, s + minDur)
        let nextEnd = Math.round(Math.max(minEnd, Math.min(d, raw)))
        let nextStart = s
        if (maxDur > 0 && nextEnd - nextStart > maxDur) {
          nextStart = Math.max(0, nextEnd - maxDur)
        }
        const capped = applyMaxClipDuration(nextStart, nextEnd, d, minDur, maxDur || undefined, 'end')
        setDragTrimStartMs(capped.startMs)
        setDragTrimEndMs(capped.endMs)
        pendingTrimRef.current = capped
        scheduleFlushRef.current()
      },
      onPanResponderRelease: () => {
        const mode = dragModeRef.current
        dragModeRef.current = null
        isDraggingRef.current = false
        if (mode === 'scrub') onScrubEndRef.current?.()
        flushCallbacksRef.current()
      },
      onPanResponderTerminate: () => {
        const mode = dragModeRef.current
        dragModeRef.current = null
        isDraggingRef.current = false
        if (mode === 'scrub') onScrubEndRef.current?.()
        flushCallbacksRef.current()
      },
    })
  ).current

  const selectionMs = Math.max(0, safeEndMs - safeStartMs)
  const selectionSecLabel =
    selectionMs >= 1000
      ? `${(selectionMs / 1000).toFixed(1)}s`
      : `${Math.max(1, Math.round(selectionMs))}ms`
  const maxClipSec =
    typeof maxClipDurationMs === 'number' && maxClipDurationMs > 0
      ? maxClipDurationMs / 1000
      : null
  const lengthLabel =
    durationSec != null && durationSec > 0
      ? maxClipSec != null
        ? `Selected ${selectionSecLabel} (max ${maxClipSec}s) · full video ${durationSec}s`
        : `Selected ${selectionSecLabel} · full video ${durationSec}s`
      : `Selected ${selectionSecLabel}`
  const selectedLeftEdge = startStripX
  const selectedRightEdge = endStripX
  const leftHandleRenderLeft =
    safeStartMs <= 0 ? -HANDLE_LEFT_EDGE_BLEED : Math.max(0, Math.min(viewportW - HANDLE_WIDTH, startStripX))
  const rightHandleRenderLeft = Math.max(
    0,
    Math.min(viewportW - HANDLE_WIDTH, endStripX - HANDLE_WIDTH)
  )

  const playheadLineX = Math.max(selectedLeftEdge, Math.min(selectedRightEdge, playheadX))

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <Text allowFontScaling={false} style={styles.lengthHint}>
          {lengthLabel}
        </Text>
      </View>

      <View
        ref={stripOuterRef}
        collapsable={false}
        style={styles.stripOuter}
        onLayout={(e) => {
          setViewportW(Math.max(0, e.nativeEvent.layout.width))
          measureStrip()
        }}
        {...panResponder.panHandlers}
      >
        <View pointerEvents="box-none" style={styles.stripInner}>
          <View pointerEvents="none" style={styles.framesRow}>
            {frames.map((frame) => {
              const ms = frame.timeMs ?? 0
              const frameX = ms * pxPerMs
              const width = Math.max(8, FRAME_WIDTH * Math.min(1, Math.max(0.22, pxPerMs * 180)))
              return (
                <View key={frame.id} style={[styles.frameSlot, { left: frameX - width / 2, width }]}>
                  {frame.uri ? (
                    <Image
                      source={{ uri: normalizeThumbnailImageUri(frame.uri) }}
                      style={styles.frameImage}
                      resizeMode="cover"
                      fadeDuration={0}
                    />
                  ) : (
                    <View style={styles.framePlaceholder}>
                      <Feather name="film" size={14} color="rgba(255,255,255,0.35)" />
                    </View>
                  )}
                </View>
              )
            })}
          </View>

          <View
            pointerEvents="none"
            style={[
              styles.selectedRange,
              {
                left: selectedLeftEdge,
                width: Math.max(0, selectedRightEdge - selectedLeftEdge),
              },
            ]}
          />

          <View
            pointerEvents="none"
            style={[styles.outsideMask, { left: 0, width: selectedLeftEdge }]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.outsideMask,
              {
                left: selectedRightEdge,
                width: Math.max(0, viewportW - selectedRightEdge),
              },
            ]}
          />

          <View
            pointerEvents="none"
            style={[
              styles.handle,
              {
                left: leftHandleRenderLeft,
                borderRadius: HANDLE_CORNER_RADIUS,
              },
            ]}
          >
            <View style={styles.handleInnerPill} />
          </View>
          <View
            pointerEvents="none"
            style={[
              styles.handle,
              {
                left: rightHandleRenderLeft,
                borderRadius: HANDLE_CORNER_RADIUS,
              },
            ]}
          >
            <View style={styles.handleInnerPill} />
          </View>

          <View pointerEvents="none" style={styles.centerLineWrap}>
            <View style={[styles.centerLine, { left: playheadLineX - 1 }]} />
          </View>
        </View>
      </View>

      <View style={styles.timesRow}>
        <Text allowFontScaling={false} style={styles.timeText}>
          {fmt(dragTrimStartMs)}
        </Text>
        <Text allowFontScaling={false} style={styles.timeTextCenter}>
          {fmt(playheadTimeMs)}
          {' · '}
          {selectionSecLabel}
        </Text>
        <Text allowFontScaling={false} style={styles.timeText}>
          {fmt(dragTrimEndMs)}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    paddingBottom: 10,
  },
  header: {
    height: 24,
    justifyContent: 'center',
  },
  lengthHint: {
    alignSelf: 'flex-end',
    fontSize: 11,
    color: 'rgba(232,240,255,0.92)',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  stripOuter: {
    borderRadius: TRACK_RADIUS + 3,
    borderWidth: 2,
    borderColor: SHELL_BORDER,
    overflow: 'hidden',
    backgroundColor: SHELL_BG,
  },
  stripInner: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_RADIUS,
    overflow: 'visible',
    backgroundColor: SHELL_BG,
    position: 'relative',
  },
  framesRow: {
    position: 'absolute',
    left: 0,
    top: FRAME_VERTICAL_INSET,
    height: FRAME_STRIP_HEIGHT,
    width: '100%',
  },
  frameSlot: {
    position: 'absolute',
    width: FRAME_WIDTH,
    height: FRAME_STRIP_HEIGHT,
    borderRightWidth: FRAME_GAP,
    borderRightColor: SHELL_BG,
  },
  frameImage: {
    width: '100%',
    height: '100%',
  },
  framePlaceholder: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedRange: {
    position: 'absolute',
    top: 0,
    height: TRACK_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.56)',
    borderWidth: 1,
    zIndex: 4,
  },
  outsideMask: {
    position: 'absolute',
    top: 0,
    height: TRACK_HEIGHT,
    backgroundColor: 'rgba(0,0,0,0.38)',
    zIndex: 5,
  },
  handle: {
    position: 'absolute',
    top: 0,
    width: HANDLE_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: HANDLE_CORNER_RADIUS,
    backgroundColor: '#1657CF',
    borderWidth: 1,
    borderColor: '#1657CF',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleInnerPill: {
    width: 4,
    height: 18,
    borderRadius: 3,
    backgroundColor: '#8FE1FF',
  },
  centerLineWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 12,
  },
  centerLine: {
    position: 'absolute',
    width: 2,
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  timesRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    color: 'rgba(255,255,255,0.72)',
  },
  timeTextCenter: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    color: '#FFFFFF',
  },
})
