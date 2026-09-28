import React, { useCallback, useContext, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native'
import { Video, ResizeMode, type AVPlaybackStatus, type AVPlaybackStatusSuccess } from 'expo-av'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import Ionicons from '@expo/vector-icons/Ionicons'
import FeatherIcon from '@expo/vector-icons/Feather'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { ProLibraryGradientFrame } from './ProLibraryGradientFrame'
import { proLibraryChrome } from '../theme/proLibraryChrome'

const SCRUB_TRACK_PLAYED = '#00B8FF'
const SCRUB_TRACK_REST = '#808080'

/** Re-seek the follower only past this drift, so status updates do not fight playback. */
const SYNC_TOLERANCE_MS = 140
/** Half the split-handle column, used to centre it on the split. */
const HANDLE_HALF = 28

/**
 * Tallest the video box may get, as a multiple of its width, and as a share of the screen.
 * A portrait phone clip is about 1.2x taller than wide, which filled most of the screen and
 * magnified every compression artefact. Capping and cropping keeps the width full-bleed.
 */
const MAX_HEIGHT_RATIO = 0.8
const MAX_SCREEN_SHARE = 0.4

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export type CorrectionVideoCompareProps = {
  /** The athlete's own clip — shown left of the split. */
  originalUri: string
  /** The generated correction clip — shown right of the split. */
  correctedUri: string
  /** `key` for Video remount (e.g. analysis id). */
  videoKey: string
  width: number
  initialSplit?: number
  /**
   * Span of the original clip the corrected clip was generated from. The correction covers a
   * window centred on contact, so without these the two sides show different moments.
   */
  windowStartMs?: number | null
  windowEndMs?: number | null
}

/**
 * Before/after compare for the correction clip: two synced players behind a draggable split,
 * inside the same accent gradient board as the analysis video. The corrected clip is the
 * playback master; the original is offset into the correction's source window and nudged back
 * whenever it drifts.
 *
 * Playback position lives in shared values rather than state, so neither the 4x/second status
 * ticks nor a scrub gesture re-renders the players. Re-rendering them was what made pause jump
 * back to the start.
 */
export function CorrectionVideoCompare({
  originalUri,
  correctedUri,
  videoKey,
  width,
  initialSplit = 0.5,
  windowStartMs,
  windowEndMs,
}: CorrectionVideoCompareProps) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const { height: screenH } = useWindowDimensions()
  const correctedRef = useRef<Video>(null)
  const originalRef = useRef<Video>(null)

  const [aspect, setAspect] = useState<number | null>(null)
  const [originalAspect, setOriginalAspect] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [clock, setClock] = useState({ positionMs: 0, durationMs: 0 })

  const split = useSharedValue(clamp01(initialSplit))
  const splitStart = useSharedValue(clamp01(initialSplit))
  const progress = useSharedValue(0)
  const isScrubbing = useSharedValue(false)

  const durationRef = useRef(0)
  const trackWidthRef = useRef(0)
  const pendingSeekRef = useRef<{ fraction: number; pause: boolean } | null>(null)
  const seekingRef = useRef(false)

  // A new object literal here on every render replaces the native player's source, which is
  // what previously restarted the clip whenever a status tick re-rendered the component.
  const correctedSource = useMemo(() => ({ uri: correctedUri }), [correctedUri])
  const originalSource = useMemo(() => ({ uri: originalUri }), [originalUri])

  const videoH = useMemo(() => {
    const natural = aspect != null ? width * aspect : width * (9 / 16)
    const cap = Math.min(width * MAX_HEIGHT_RATIO, screenH * MAX_SCREEN_SHARE)
    return Math.max(1, Math.ceil(Math.min(natural, cap)))
  }, [width, aspect, screenH])

  /** Where the original should sit for a given corrected-clip position. */
  const followerTargetMs = useCallback(
    (masterMs: number) => {
      const start = typeof windowStartMs === 'number' && windowStartMs >= 0 ? windowStartMs : 0
      const end = typeof windowEndMs === 'number' && windowEndMs > start ? windowEndMs : null
      const target = start + masterMs
      return end != null ? Math.min(target, end) : target
    },
    [windowStartMs, windowEndMs]
  )

  const handleStatus = useCallback(
    (s: AVPlaybackStatus) => {
      if (!s.isLoaded) return
      const master = s as AVPlaybackStatusSuccess
      if (master.durationMillis && master.durationMillis !== durationRef.current) {
        durationRef.current = master.durationMillis
      }
      setIsPlaying((prev) => (prev === master.isPlaying ? prev : master.isPlaying))

      if (!isScrubbing.value && durationRef.current > 0) {
        progress.value = clamp01((master.positionMillis ?? 0) / durationRef.current)
      }

      const pos = master.positionMillis ?? 0
      const dur = durationRef.current
      setClock((prev) => {
        if (prev.durationMs === dur && Math.abs(prev.positionMs - pos) < 200) return prev
        return { positionMs: pos, durationMs: dur }
      })

      const follower = originalRef.current
      if (!follower) return
      void follower
        .getStatusAsync()
        .then((f) => {
          if (!f.isLoaded) return
          const want = followerTargetMs(master.positionMillis ?? 0)
          if (Math.abs((f.positionMillis ?? 0) - want) > SYNC_TOLERANCE_MS) {
            void follower.setPositionAsync(want)
          }
          if (master.isPlaying && !f.isPlaying) void follower.playAsync()
          if (!master.isPlaying && f.isPlaying) void follower.pauseAsync()
        })
        .catch(() => {})
    },
    [followerTargetMs, isScrubbing, progress]
  )

  const pumpSeek = useCallback(() => {
    if (seekingRef.current) return
    const job = pendingSeekRef.current
    if (!job) return
    pendingSeekRef.current = null
    const duration = durationRef.current
    if (duration <= 0) return
    seekingRef.current = true
    const masterMs = clamp01(job.fraction) * duration
    const followerMs = followerTargetMs(masterMs)
    void Promise.all([
      correctedRef.current?.setPositionAsync(masterMs) ?? Promise.resolve(),
      originalRef.current?.setPositionAsync(followerMs) ?? Promise.resolve(),
    ])
      .then(async () => {
        if (job.pause && !pendingSeekRef.current) {
          await correctedRef.current?.pauseAsync().catch(() => {})
          await originalRef.current?.pauseAsync().catch(() => {})
        }
      })
      .catch(() => {})
      .finally(() => {
        seekingRef.current = false
        if (pendingSeekRef.current) pumpSeek()
      })
  }, [followerTargetMs])

  const queueSeek = useCallback(
    (fraction: number, pause: boolean) => {
      const previous = pendingSeekRef.current
      pendingSeekRef.current = { fraction, pause: pause || Boolean(previous?.pause) }
      pumpSeek()
    },
    [pumpSeek]
  )

  const togglePlay = useCallback(async () => {
    const master = correctedRef.current
    const follower = originalRef.current
    if (!master) return
    if (isPlaying) {
      await master.pauseAsync().catch(() => {})
      await follower?.pauseAsync().catch(() => {})
    } else {
      await master.playAsync().catch(() => {})
      await follower?.playAsync().catch(() => {})
    }
  }, [isPlaying])

  const onNaturalSize = useCallback(
    (ns: { width: number; height: number } | null | undefined) => {
      if (!ns || ns.width <= 0 || ns.height <= 0) return
      const next = ns.height / ns.width
      setAspect((prev) => (prev != null && Math.abs(prev - next) < 0.001 ? prev : next))
    },
    []
  )

  // minDistance(0) so a plain tap on the track seeks, rather than needing a drag first.
  const scrubGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((e) => {
          isScrubbing.value = true
          const w = trackWidthRef.current
          if (w <= 0) return
          progress.value = clamp01(e.x / w)
          runOnJS(queueSeek)(progress.value, false)
        })
        .onUpdate((e) => {
          const w = trackWidthRef.current
          if (w <= 0) return
          progress.value = clamp01(e.x / w)
          runOnJS(queueSeek)(progress.value, false)
        })
        .onFinalize(() => {
          runOnJS(queueSeek)(progress.value, true)
          isScrubbing.value = false
        }),
    [isScrubbing, progress, queueSeek]
  )

  // Anchored to the handle rather than the whole card: a card-wide raw responder competed
  // with the parent ScrollView, which is what made the split feel jumpy.
  const splitGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin(() => {
          splitStart.value = split.value
        })
        .onUpdate((e) => {
          split.value = clamp01(splitStart.value + e.translationX / width)
        }),
    [split, splitStart, width]
  )

  const beforeClipStyle = useAnimatedStyle(() => ({ width: split.value * width }))
  const handleColumnStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: split.value * width - HANDLE_HALF }],
  }))
  const trackFillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }))
  const thumbStyle = useAnimatedStyle(() => ({ left: `${progress.value * 100}%` }))
  const aspectsDiffer =
    aspect != null && originalAspect != null && Math.abs(aspect - originalAspect) > 0.04
  const resizeMode = aspectsDiffer ? ResizeMode.CONTAIN : ResizeMode.COVER
  const showContact =
    typeof windowStartMs === 'number' &&
    windowStartMs >= 0 &&
    typeof windowEndMs === 'number' &&
    windowEndMs > windowStartMs

  const styles = useMemo(
    () =>
      StyleSheet.create({
        outer: { width: '100%', alignItems: 'center' },
        column: { width, alignSelf: 'center' },
        labelRow: {
          width: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        },
        label: {
          fontFamily: theme.semiBoldFont,
          fontSize: 11,
          color: 'rgba(200, 215, 230, 0.72)',
        },
        frame: { width, alignSelf: 'center', marginBottom: 2 },
        shell: { width, backgroundColor: '#000', alignItems: 'center' },
        card: { position: 'relative', width, height: videoH, overflow: 'hidden' },
        fill: { position: 'absolute', left: 0, top: 0, width, height: videoH },
        beforeClip: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
        sliderTrack: {
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: HANDLE_HALF * 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        dividerLine: {
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 2,
          backgroundColor: 'rgba(255,255,255,0.9)',
        },
        handle: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: 'rgba(0, 20, 53, 0.92)',
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.85)',
        },
        controls: {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'stretch',
          marginTop: 10,
          paddingHorizontal: 4,
          paddingVertical: 8,
          gap: 10,
        },
        playHit: { padding: 4, flexShrink: 0 },
        trackWrap: { flex: 1, justifyContent: 'center', paddingVertical: 12 },
        trackBg: {
          height: 6,
          borderRadius: 3,
          backgroundColor: SCRUB_TRACK_REST,
          position: 'relative',
        },
        trackFill: {
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          borderRadius: 3,
          backgroundColor: SCRUB_TRACK_PLAYED,
        },
        thumb: {
          position: 'absolute',
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: SCRUB_TRACK_PLAYED,
          borderWidth: 2,
          borderColor: '#FFFFFF',
          top: -4,
          marginLeft: -7,
        },
        contactTick: {
          position: 'absolute',
          left: '50%',
          marginLeft: -1,
          top: -3,
          width: 2,
          height: 12,
          borderRadius: 1,
          backgroundColor: '#FFFFFF',
        },
        timeLabel: {
          fontFamily: theme.semiBoldFont,
          fontSize: 11,
          color: 'rgba(200, 215, 230, 0.9)',
          minWidth: 72,
          textAlign: 'right',
        },
      }),
    [theme.semiBoldFont, width, videoH]
  )

  return (
    <View style={styles.outer} pointerEvents="box-none">
      <View style={styles.column} pointerEvents="box-none">
        <View style={styles.labelRow}>
          <Text allowFontScaling={false} style={styles.label}>
            {t('technique.current')}
          </Text>
          <Text allowFontScaling={false} style={styles.label}>
            {t('technique.corrected')}
          </Text>
        </View>

        <ProLibraryGradientFrame
          borderRadius={proLibraryChrome.radii.frameOuter}
          innerBorderRadius={proLibraryChrome.radii.frameInner}
          strokeWidth={Math.max(proLibraryChrome.frameStrokeWidth, 2)}
          gradientVariant="accent"
          innerShadow={false}
          innerStyle={{ backgroundColor: '#000000', padding: 0, overflow: 'hidden' }}
          style={styles.frame}
        >
          <View style={styles.shell}>
            <View style={styles.card}>
              <Video
                key={`corrected-${videoKey}`}
                ref={correctedRef}
                source={correctedSource}
                style={styles.fill}
                resizeMode={resizeMode}
                useNativeControls={false}
                isLooping
                isMuted
                progressUpdateIntervalMillis={250}
                onReadyForDisplay={(e) => onNaturalSize(e.naturalSize)}
                onPlaybackStatusUpdate={handleStatus}
              />
              <Animated.View style={[styles.beforeClip, beforeClipStyle]}>
                <Video
                  key={`original-${videoKey}`}
                  ref={originalRef}
                  source={originalSource}
                  style={styles.fill}
                  resizeMode={resizeMode}
                  onReadyForDisplay={(e) => {
                    const ns = e.naturalSize
                    if (!ns || ns.width <= 0 || ns.height <= 0) return
                    const next = ns.height / ns.width
                    setOriginalAspect((prev) =>
                      prev != null && Math.abs(prev - next) < 0.001 ? prev : next
                    )
                  }}
                  useNativeControls={false}
                  isLooping
                  isMuted
                />
              </Animated.View>
              <GestureDetector gesture={splitGesture}>
                <Animated.View style={[styles.sliderTrack, handleColumnStyle]}>
                  <View style={styles.dividerLine} />
                  <View style={styles.handle}>
                    <FeatherIcon name="chevron-left" size={14} color="#fff" />
                    <FeatherIcon name="chevron-right" size={14} color="#fff" />
                  </View>
                </Animated.View>
              </GestureDetector>
            </View>
          </View>
        </ProLibraryGradientFrame>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.playHit} onPress={togglePlay} hitSlop={12}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <GestureDetector gesture={scrubGesture}>
            <View
              style={styles.trackWrap}
              onLayout={(e) => {
                trackWidthRef.current = e.nativeEvent.layout.width
              }}
            >
              <View style={styles.trackBg}>
                <Animated.View style={[styles.trackFill, trackFillStyle]} />
                {showContact ? <View pointerEvents="none" style={styles.contactTick} /> : null}
                <Animated.View style={[styles.thumb, thumbStyle]} />
              </View>
            </View>
          </GestureDetector>
          <Text allowFontScaling={false} style={styles.timeLabel}>
            {formatClock(clock.positionMs)} / {formatClock(clock.durationMs)}
          </Text>
        </View>
      </View>
    </View>
  )
}
