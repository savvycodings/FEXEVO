import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { PG, glow } from '../screens/progress/progressTheme'
import { ThemeContext } from '../context'
import { vercel as defaultTheme } from '../theme'
import { createFrameGrabber, type FrameGrabber } from '../lib/videoFrameGrab'
import { GestureDetector } from 'react-native-gesture-handler'
import { FRAME_VIEW_RESET, type FrameView, useFrameZoomGesture, zoomedImageStyle } from './contactFrameZoom'
import { ZoomChips } from './ContactFrameZoomChips'
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
}

/** Frame that is on screen at `ms`; 1 ms of slack absorbs player position rounding. */
function frameAt(ms: number, frameMs: number) {
  return Math.floor((ms + 1) / frameMs)
}

/** Start time of a frame, rounded up so it maps back to the same frame here and on the backend. */
function frameStartMs(index: number, frameMs: number) {
  return Math.ceil(index * frameMs)
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
}: Props) {
  const { t } = useTranslation()
  const ctx = useContext(ThemeContext)?.theme
  const theme = ctx?.backgroundColor != null ? ctx : defaultTheme

  const [fps, setFps] = useState(DEFAULT_FPS)
  const [fpsMeasured, setFpsMeasured] = useState(false)
  const [frames, setFrames] = useState<Record<number, string>>({})
  const [aspect, setAspect] = useState(16 / 9)
  const [gridW, setGridW] = useState(0)
  /** One zoom/pan for every frame, shared with the viewer. */
  const [view, setView] = useState<FrameView>(FRAME_VIEW_RESET)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
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
    setViewerIndex(null)
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

  const cellW = gridW > 0 ? (gridW - GAP * (COLS - 1)) / COLS : 0
  const cellH = cellW / aspect
  // Same instant the thumbnail was decoded at, so the stored contact is that picture.
  const pick = (index: number) => onChangeContactMs(Math.round((index + 0.25) * frameMs))
  const contactSec = (frameStartMs(contactFrame, frameMs) / 1000).toFixed(3)

  return (
    <View style={styles.root} testID="contact-frame-grid">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.semiBoldFont }]}>
            {t('technique.setClipScreen.contactFrameTitle')}
          </Text>
        </View>
        <View style={styles.stepper}>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => pick(Math.max(firstFrame, contactFrame - 1))}
            disabled={contactFrame <= firstFrame}
            accessibilityRole="button"
            accessibilityLabel={t('technique.setClipScreen.previousFrame')}
            testID="contact-frame-prev"
          >
            <Ionicons name="chevron-back" size={20} color={PG.labelBlue} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => pick(Math.min(lastFrame, contactFrame + 1))}
            disabled={contactFrame >= lastFrame}
            accessibilityRole="button"
            accessibilityLabel={t('technique.setClipScreen.nextFrame')}
            testID="contact-frame-next"
          >
            <Ionicons name="chevron-forward" size={20} color={PG.labelBlue} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.zoomRow}>
        <Text allowFontScaling={false} style={[styles.zoomLabel, { fontFamily: theme.mediumFont }]}>
          {t('technique.setClipScreen.zoom')}
        </Text>
        <ZoomChips view={view} onViewChange={setView} font={theme.mediumFont} testIDPrefix="contact-frame-zoom" />
      </View>

      <View style={styles.grid} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
        {cellW > 0
          ? windowFrames.map((index) => {
              const active = index === contactFrame
              const offset = index - contactFrame
              return (
                <FrameCell
                  key={index}
                  index={index}
                  uri={frames[index]}
                  active={active}
                  label={active ? t('technique.contactLabel') : offset > 0 ? `+${offset}` : `${offset}`}
                  width={cellW}
                  height={cellH}
                  view={view}
                  onViewChange={setView}
                  // Tapping the current contact opens it large; picking it again would do nothing.
                  onTap={() => (active ? setViewerIndex(index) : pick(index))}
                  onExpand={() => setViewerIndex(index)}
                  font={theme.mediumFont}
                />
              )
            })
          : null}
      </View>

      <Text allowFontScaling={false} style={[styles.footer, { fontFamily: theme.regularFont }]}>
        {t('technique.setClipScreen.contactFrameInfo', { frame: contactFrame, sec: contactSec, fps })}
        {fpsMeasured ? '' : ` ${t('technique.setClipScreen.fpsAssumed')}`}
      </Text>

      <ContactFrameViewer
        openIndex={viewerIndex}
        contactFrame={contactFrame}
        firstFrame={firstFrame}
        lastFrame={lastFrame}
        aspect={aspect}
        getFrame={getFrame}
        view={view}
        onViewChange={setView}
        onUse={(index) => {
          setViewerIndex(null)
          pick(index)
        }}
        onClose={() => setViewerIndex(null)}
        fonts={{ regular: theme.regularFont, medium: theme.mediumFont, semiBold: theme.semiBoldFont }}
      />
    </View>
  )
}

type CellProps = {
  index: number
  uri: string | undefined
  active: boolean
  label: string
  width: number
  height: number
  view: FrameView
  onViewChange: (v: FrameView) => void
  onTap: () => void
  onExpand: () => void
  font?: string
}

/** One frame: shared zoom crop, tap to pick, drag/pinch to zoom, corner button to enlarge. */
function FrameCell({ index, uri, active, label, width, height, view, onViewChange, onTap, onExpand, font }: CellProps) {
  const { t } = useTranslation()
  const gesture = useFrameZoomGesture({ view, onViewChange, width, height, onTap })
  return (
    <View style={{ width, height }}>
      <GestureDetector gesture={gesture}>
        <View
          style={[styles.cell, { width, height }, active && styles.cellActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          aria-selected={active}
          accessibilityLabel={t('technique.setClipScreen.frameN', { n: index })}
          testID={`contact-frame-${index}`}
        >
          {uri ? (
            <Image source={{ uri }} style={zoomedImageStyle(view, width - 4, height - 4)} resizeMode="stretch" />
          ) : (
            <ActivityIndicator size="small" color={ACCENT} />
          )}
          <View style={[styles.badge, active && styles.badgeActive]}>
            <Text allowFontScaling={false} style={[styles.badgeText, { fontFamily: font }]}>
              {label}
            </Text>
          </View>
        </View>
      </GestureDetector>
      <TouchableOpacity
        onPress={onExpand}
        style={styles.expandBtn}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel={t('technique.setClipScreen.expandFrame', { n: index })}
        testID={`contact-frame-expand-${index}`}
      >
        <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    marginTop: 16,
    gap: 12,
    backgroundColor: PG.cardPlain,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PG.borderSoft,
    padding: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 16, color: '#FFFFFF' },
  subtitle: { fontSize: 14, lineHeight: 19, color: '#A9B8D6' },
  stepper: { flexDirection: 'row', gap: 8 },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CELL_BG,
    borderWidth: 1.5,
    borderColor: PG.border,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cell: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: CELL_BG,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cellActive: { borderColor: '#3D8BFF', ...glow(10, 0.7) },
  badge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(5, 12, 35, 0.75)',
  },
  badgeActive: { backgroundColor: ACCENT },
  expandBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 12, 35, 0.75)',
  },
  zoomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  zoomLabel: { fontSize: 14, color: PG.muted },
  badgeText: { fontSize: 12, color: '#FFFFFF' },
  footer: { fontSize: 13, color: PG.muted },
})
