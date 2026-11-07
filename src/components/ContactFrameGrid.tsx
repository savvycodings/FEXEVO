import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { vercel as defaultTheme } from '../theme'
import { createFrameGrabber, type FrameGrabber } from '../lib/videoFrameGrab'
import { GestureDetector } from 'react-native-gesture-handler'
import { FRAME_VIEW_RESET, type FrameView, useFrameZoomGesture, zoomedImageStyle } from './contactFrameZoom'
import { ContactFrameViewer } from './ContactFrameViewer'

/** Frames shown around the contact: four before, the contact, four after. */
const GRID_RADIUS = 4
const COLS = 3
const GAP = 8
const DEFAULT_FPS = 30
/** Wait for scrubbing to settle before decoding frames. */
const GRAB_DEBOUNCE_MS = 150
const ACCENT = '#2A88F4'
const CELL_BG = '#0A1E5C'
/** Design: rounded square frames. */
const CELL_RADIUS = 20

type Props = {
  videoUri: string
  durationMs: number
  /** Current contact time, or null before the clip is known. */
  contactMs: number | null
  /** The trimmed clip; the contact can't leave it. */
  clipStartMs: number
  clipEndMs: number
  onChangeContactMs: (ms: number) => void
  /** File frame index of the cell the player is on, once fps is known. */
  onChangeContactFrame?: (frame: number) => void
  /** Set Clip's "Contact" step: show one frame (stepper, zoom, Next) in place of the grid. */
  contactStep?: boolean
  /** X on the Contact step: back to the grid. */
  onCloseContactStep?: () => void
  /** Next on the Contact step, after the shown frame became the contact. */
  onConfirm?: () => void
}

/** Frame that is on screen at `ms`; 1 ms of slack absorbs player position rounding. */
function frameAt(ms: number, frameMs: number) {
  return Math.floor((ms + 1) / frameMs)
}


/**
 * Real frames around the marked contact, one per captured frame, so the player can tap the exact
 * frame where the ball meets the racket instead of guessing on the timeline.
 */
export function ContactFrameGrid({
  videoUri,
  durationMs,
  contactMs,
  clipStartMs,
  clipEndMs,
  onChangeContactMs,
  onChangeContactFrame,
  contactStep = false,
  onCloseContactStep,
  onConfirm,
}: Props) {
  const ctx = useContext(ThemeContext)?.theme
  const theme = ctx?.backgroundColor != null ? ctx : defaultTheme

  const [fps, setFps] = useState(DEFAULT_FPS)
  const [fpsMeasured, setFpsMeasured] = useState(false)
  const [frames, setFrames] = useState<Record<number, string>>({})
  const [aspect, setAspect] = useState(16 / 9)
  const [gridW, setGridW] = useState(0)
  /** One zoom/pan for every frame, shared with the viewer. */
  const [view, setView] = useState<FrameView>(FRAME_VIEW_RESET)
  const grabberRef = useRef<FrameGrabber | null>(null)
  const onFrameRef = useRef(onChangeContactFrame)
  onFrameRef.current = onChangeContactFrame
  /** Decoded frames survive recentering so stepping only decodes the new edge. */
  const cacheRef = useRef(new Map<number, string>())

  const frameMs = 1000 / fps
  const firstFrame = Math.ceil(clipStartMs / frameMs)
  const lastFrame = Math.max(firstFrame, Math.floor((Math.min(clipEndMs, durationMs) - 1) / frameMs))
  const contactFrame =
    contactMs == null ? null : Math.max(firstFrame, Math.min(lastFrame, frameAt(contactMs, frameMs)))

  const windowFrames = useMemo(() => {
    if (contactFrame == null) return []
    let lo = contactFrame - GRID_RADIUS
    let hi = contactFrame + GRID_RADIUS
    // At the clip edges, slide the window instead of showing fewer frames.
    if (lo < firstFrame) {
      hi += firstFrame - lo
      lo = firstFrame
    }
    if (hi > lastFrame) {
      lo = Math.max(firstFrame, lo - (hi - lastFrame))
      hi = lastFrame
    }
    const out: number[] = []
    for (let i = lo; i <= hi; i++) out.push(i)
    return out
  }, [contactFrame, firstFrame, lastFrame])

  useEffect(() => {
    const grabber = createFrameGrabber(videoUri)
    grabberRef.current = grabber
    cacheRef.current = new Map()
    setFrames({})
    setView(FRAME_VIEW_RESET)
    let cancelled = false
    void grabber
      .detectFps()
      .then((measured) => {
        if (cancelled || measured == null) return
        cacheRef.current = new Map()
        setFrames({})
        setFps(measured)
        setFpsMeasured(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      grabber.dispose()
      grabberRef.current = null
    }
  }, [videoUri])

  /** Decoded frame for `index`, from the cache or decoded now (the viewer can step past the grid). */
  const getFrame = useCallback(
    async (index: number) => {
      const hit = cacheRef.current.get(index)
      if (hit) return hit
      const grabber = grabberRef.current
      if (!grabber) throw new Error('no frame grabber')
      // A quarter into the frame so the decoder lands on it, not the one before.
      const frame = await grabber.grab((index + 0.25) * frameMs)
      cacheRef.current.set(index, frame.uri)
      if (frame.width > 0 && frame.height > 0) setAspect(frame.width / frame.height)
      setFrames((prev) => ({ ...prev, [index]: frame.uri }))
      return frame.uri
    },
    [frameMs]
  )

  useEffect(() => {
    if (windowFrames.length === 0 || contactFrame == null) return
    let cancelled = false
    const timer = setTimeout(() => {
      // Contact first, then outward, so the frames nearest the pick show up first.
      const order = [...windowFrames].sort((a, b) => Math.abs(a - contactFrame) - Math.abs(b - contactFrame))
      void (async () => {
        for (const index of order) {
          if (cancelled) return
          if (cacheRef.current.has(index)) continue
          if (!grabberRef.current) return
          try {
            await getFrame(index)
          } catch {
            /* leave the cell on its spinner */
          }
        }
      })()
    }, GRAB_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [windowFrames, contactFrame, getFrame])

  useEffect(() => {
    if (contactFrame == null || !fpsMeasured) return
    onFrameRef.current?.(contactFrame)
  }, [contactFrame, fpsMeasured])

  if (contactFrame == null) return null

  // Floor (minus a px) so Android's pixel rounding can't push the third cell onto the next row.
  const cellW = gridW > 0 ? Math.floor((gridW - GAP * (COLS - 1)) / COLS) - 1 : 0
  /** Design: square cells; the frame covers the square. */
  const cellH = cellW
  // Same instant the thumbnail was decoded at, so the stored contact is that picture.
  const pick = (index: number) => onChangeContactMs(Math.round((index + 0.25) * frameMs))

  if (contactStep) {
    return (
      <ContactFrameViewer
        initialIndex={contactFrame}
        firstFrame={firstFrame}
        lastFrame={lastFrame}
        aspect={aspect}
        getFrame={getFrame}
        view={view}
        onViewChange={setView}
        onUse={(index) => {
          pick(index)
          // Report the frame now: the next step unmounts this grid before its effect would run.
          if (fpsMeasured) onFrameRef.current?.(index)
          onConfirm?.()
        }}
        onClose={() => onCloseContactStep?.()}
        fonts={{ regular: theme.regularFont, medium: theme.mediumFont, semiBold: theme.semiBoldFont }}
      />
    )
  }

  return (
    <View style={styles.root} testID="contact-frame-grid">
      <View style={styles.grid} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
        {cellW > 0
          ? windowFrames.map((index) => {
              const active = index === contactFrame
              return (
                <FrameCell
                  key={index}
                  index={index}
                  uri={frames[index]}
                  active={active}
                  size={cellW}
                  aspect={aspect}
                  view={view}
                  onViewChange={setView}
                  // Tap only selects; Set Clip's "Next" opens the Contact step.
                  onTap={() => {
                    if (!active) pick(index)
                  }}
                />
              )
            })
          : null}
      </View>
    </View>
  )
}

type CellProps = {
  index: number
  uri: string | undefined
  active: boolean
  /** Square cell side. */
  size: number
  /** Width / height of the video picture. */
  aspect: number
  view: FrameView
  onViewChange: (v: FrameView) => void
  onTap: () => void
}

/** Design: the contact cell has a 2px solid #0BF border. */
const RING = 2

/** One frame: square, picture covers it; shared zoom crop, tap to pick, drag/pinch to zoom. */
function FrameCell({ index, uri, active, size, aspect, view, onViewChange, onTap }: CellProps) {
  const { t } = useTranslation()
  const inner = active ? size - RING * 2 : size
  // Cover: the picture's short side fills the square.
  const picW = aspect >= 1 ? inner * aspect : inner
  const picH = aspect >= 1 ? inner : inner / aspect
  const gesture = useFrameZoomGesture({ view, onViewChange, width: picW, height: picH, onTap })
  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[styles.cell, { width: size, height: size }, active && styles.cellActive]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        aria-selected={active}
        accessibilityLabel={t('technique.setClipScreen.frameN', { n: index })}
        testID={`contact-frame-${index}`}
      >
        {uri ? (
          <View
            style={{ position: 'absolute', width: picW, height: picH, left: (inner - picW) / 2, top: (inner - picH) / 2 }}
          >
            <Image source={{ uri }} style={zoomedImageStyle(view, picW, picH)} resizeMode="stretch" />
          </View>
        ) : (
          <ActivityIndicator size="small" color={ACCENT} />
        )}
      </View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  root: { marginTop: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: GAP },
  cell: {
    borderRadius: CELL_RADIUS,
    overflow: 'hidden',
    backgroundColor: CELL_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: { borderWidth: RING, borderColor: '#00BBFF' },
})
