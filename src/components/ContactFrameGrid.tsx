import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { vercel as defaultTheme } from '../theme'
import { createFrameGrabber, type FrameGrabber } from '../lib/videoFrameGrab'

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
export function ContactFrameGrid({ videoUri, durationMs, contactMs, clipStartMs, clipEndMs, onChangeContactMs }: Props) {
  const { t } = useTranslation()
  const ctx = useContext(ThemeContext)?.theme
  const theme = ctx?.backgroundColor != null ? ctx : defaultTheme

  const [fps, setFps] = useState(DEFAULT_FPS)
  const [fpsMeasured, setFpsMeasured] = useState(false)
  const [frames, setFrames] = useState<Record<number, string>>({})
  const [aspect, setAspect] = useState(16 / 9)
  const [gridW, setGridW] = useState(0)
  const grabberRef = useRef<FrameGrabber | null>(null)
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
          const grabber = grabberRef.current
          if (!grabber) return
          try {
            // A quarter into the frame so the decoder lands on it, not the one before.
            const frame = await grabber.grab((index + 0.25) * frameMs)
            if (cancelled) return
            cacheRef.current.set(index, frame.uri)
            if (frame.width > 0 && frame.height > 0) setAspect(frame.width / frame.height)
            setFrames((prev) => ({ ...prev, [index]: frame.uri }))
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
  }, [windowFrames, contactFrame, frameMs])

  if (contactFrame == null) return null

  const cellW = gridW > 0 ? (gridW - GAP * (COLS - 1)) / COLS : 0
  const cellH = cellW / aspect
  const pick = (index: number) => onChangeContactMs(frameStartMs(index, frameMs))
  const contactSec = (frameStartMs(contactFrame, frameMs) / 1000).toFixed(3)

  return (
    <View style={styles.root} testID="contact-frame-grid">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.semiBoldFont }]}>
            {t('technique.setClipScreen.contactFrameTitle')}
          </Text>
          <Text allowFontScaling={false} style={[styles.subtitle, { fontFamily: theme.regularFont }]}>
            {t('technique.setClipScreen.contactFrameHint')}
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
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => pick(Math.min(lastFrame, contactFrame + 1))}
            disabled={contactFrame >= lastFrame}
            accessibilityRole="button"
            accessibilityLabel={t('technique.setClipScreen.nextFrame')}
            testID="contact-frame-next"
          >
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.grid} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
        {cellW > 0
          ? windowFrames.map((index) => {
              const active = index === contactFrame
              const uri = frames[index]
              const offset = index - contactFrame
              return (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.85}
                  onPress={() => pick(index)}
                  style={[styles.cell, { width: cellW, height: cellH }, active && styles.cellActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t('technique.setClipScreen.frameN', { n: index })}
                  testID={`contact-frame-${index}`}
                >
                  {uri ? (
                    <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : (
                    <ActivityIndicator size="small" color={ACCENT} />
                  )}
                  <View style={[styles.badge, active && styles.badgeActive]}>
                    <Text allowFontScaling={false} style={[styles.badgeText, { fontFamily: theme.mediumFont }]}>
                      {active ? t('technique.contactLabel') : offset > 0 ? `+${offset}` : `${offset}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              )
            })
          : null}
      </View>

      <Text allowFontScaling={false} style={[styles.footer, { fontFamily: theme.regularFont }]}>
        {t('technique.setClipScreen.contactFrameInfo', { frame: contactFrame, sec: contactSec, fps })}
        {fpsMeasured ? '' : ` ${t('technique.setClipScreen.fpsAssumed')}`}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { marginTop: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 17, color: '#FFFFFF' },
  subtitle: { fontSize: 14, lineHeight: 19, color: '#A9B8D6' },
  stepper: { flexDirection: 'row', gap: 8 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CELL_BG,
    borderWidth: 1,
    borderColor: '#1848BA',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cell: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: CELL_BG,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cellActive: { borderColor: ACCENT },
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
  badgeText: { fontSize: 12, color: '#FFFFFF' },
  footer: { fontSize: 13, color: '#A9B8D6' },
})
