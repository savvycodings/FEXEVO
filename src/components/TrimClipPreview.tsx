import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  type ViewStyle,
} from 'react-native'
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ProLibraryGradientFrame } from './ProLibraryGradientFrame'
import { proLibraryChrome } from '../theme/proLibraryChrome'
import { useTranslation } from 'react-i18next'

const CONTROL_BG = '#0A1E5C'
const CONTROL_ICON = '#2A88F4'

/** "Preview Clip (0.5x)" speed; the play button uses normal speed. */
const PREVIEW_RATE = 0.5
const STEP_MS = 100
const LOOP_END_TOLERANCE_MS = 80

export type TrimClipPreviewHandle = {
  seekMs: (ms: number) => Promise<void>
  pause: () => Promise<void>
  playSelectionLoop: (startMs: number, endMs: number, rate?: number) => Promise<void>
}

export type TrimClipPreviewProps = {
  videoUri: string
  height: number
  selectionStartMs: number
  selectionEndMs: number
  style?: ViewStyle
  onNaturalSize?: (size: { w: number; h: number }) => void
  onDurationMs?: (durationMs: number) => void
  /** Fired while playing or after seek; parent syncs carousel playhead. */
  onPositionMsChange?: (positionMs: number) => void
  onReadyChange?: (ready: boolean) => void
}

export const TrimClipPreview = forwardRef<TrimClipPreviewHandle, TrimClipPreviewProps>(
  function TrimClipPreview(
    {
      videoUri,
      height,
      selectionStartMs,
      selectionEndMs,
      style,
      onNaturalSize,
      onDurationMs,
      onPositionMsChange,
      onReadyChange,
    },
    ref
  ) {
    const { t } = useTranslation()
    const videoRef = useRef<Video | null>(null)
    const loopRangeRef = useRef({ startMs: 0, endMs: 0 })
    const loopActiveRef = useRef(false)
    const rateRef = useRef(1)
    const positionEmitRafRef = useRef<number | null>(null)
    const lastEmittedPosRef = useRef(-1)

    const [isReady, setIsReady] = useState(false)
    const [isPlaying, setIsPlaying] = useState(false)
    const [playingRate, setPlayingRate] = useState(1)
    const [positionMs, setPositionMs] = useState(0)

    const selectionLo = Math.min(selectionStartMs, selectionEndMs)
    const selectionHi = Math.max(selectionStartMs, selectionEndMs)

    const emitPosition = useCallback(
      (ms: number) => {
        if (Math.abs(ms - lastEmittedPosRef.current) < 8) return
        lastEmittedPosRef.current = ms
        onPositionMsChange?.(ms)
      },
      [onPositionMsChange]
    )

    const scheduleEmitPosition = useCallback(
      (ms: number) => {
        if (positionEmitRafRef.current != null) return
        positionEmitRafRef.current = requestAnimationFrame(() => {
          positionEmitRafRef.current = null
          emitPosition(ms)
        })
      },
      [emitPosition]
    )

    useEffect(
      () => () => {
        if (positionEmitRafRef.current != null) cancelAnimationFrame(positionEmitRafRef.current)
      },
      []
    )

    useEffect(() => {
      onReadyChange?.(isReady)
    }, [isReady, onReadyChange])

    useEffect(() => {
      setIsReady(false)
      setIsPlaying(false)
      loopActiveRef.current = false
      setPositionMs(0)
    }, [videoUri])

    const seekMs = useCallback(
      async (ms: number) => {
        const ref = videoRef.current
        if (!ref) return
        const clamped = Math.max(0, Math.round(ms))
        try {
          await ref.setStatusAsync({
            positionMillis: clamped,
            shouldPlay: false,
          })
          setPositionMs(clamped)
          setIsPlaying(false)
          loopActiveRef.current = false
          emitPosition(clamped)
        } catch {
          /* ignore seek failures */
        }
      },
      [emitPosition]
    )

    const pause = useCallback(async () => {
      const ref = videoRef.current
      if (!ref) return
      try {
        await ref.setStatusAsync({ shouldPlay: false })
      } catch {
        /* ignore */
      }
      setIsPlaying(false)
      loopActiveRef.current = false
    }, [])

    const playSelectionLoop = useCallback(
      async (startMs: number, endMs: number, rate = 1) => {
        const ref = videoRef.current
        if (!ref || !isReady) return
        const lo = Math.min(startMs, endMs)
        const hi = Math.max(startMs, endMs)
        loopRangeRef.current = { startMs: lo, endMs: hi }
        loopActiveRef.current = true
        rateRef.current = rate
        setPlayingRate(rate)
        try {
          await ref.setStatusAsync({
            positionMillis: lo,
            shouldPlay: true,
            rate,
            isMuted: true,
          })
          setPositionMs(lo)
          setIsPlaying(true)
          emitPosition(lo)
        } catch {
          loopActiveRef.current = false
          setIsPlaying(false)
        }
      },
      [isReady, emitPosition]
    )

    useImperativeHandle(
      ref,
      () => ({
        seekMs,
        pause,
        playSelectionLoop,
      }),
      [seekMs, pause, playSelectionLoop]
    )

    const handlePlaybackStatus = useCallback(
      (status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
          if ('error' in status && status.error) {
            console.log('[TrimClipPreview] playback error', status.error)
          }
          return
        }

        if (typeof status.durationMillis === 'number' && status.durationMillis > 0) {
          onDurationMs?.(status.durationMillis)
        }

        if (status.isLoaded && 'naturalSize' in status) {
          const ns = (
            status as { naturalSize?: { width: number; height: number } }
          ).naturalSize
          if (ns && ns.width > 0 && ns.height > 0) {
            onNaturalSize?.({ w: ns.width, h: ns.height })
          }
        }

        const pos = status.positionMillis ?? 0
        setPositionMs(pos)
        setIsPlaying(status.isPlaying === true)

        if (status.isPlaying) {
          scheduleEmitPosition(pos)
        }

        if (!loopActiveRef.current) return

        const { startMs, endMs } = loopRangeRef.current
        const atEnd =
          pos >= endMs - LOOP_END_TOLERANCE_MS ||
          (status.didJustFinish === true && pos >= startMs)

        if (atEnd && status.isPlaying) {
          void (async () => {
            try {
              await videoRef.current?.setStatusAsync({
                positionMillis: startMs,
                shouldPlay: true,
                rate: rateRef.current,
              })
              setPositionMs(startMs)
              emitPosition(startMs)
            } catch {
              loopActiveRef.current = false
              setIsPlaying(false)
            }
          })()
        }
      },
      [onDurationMs, onNaturalSize, scheduleEmitPosition, emitPosition]
    )

    /** Same control pauses when its own speed is playing; otherwise (re)starts the loop at that speed. */
    const togglePlayAt = useCallback(
      async (rate: number) => {
        if (isPlaying && playingRate === rate) {
          await pause()
          return
        }
        await playSelectionLoop(selectionLo, selectionHi, rate)
      },
      [isPlaying, playingRate, pause, playSelectionLoop, selectionLo, selectionHi]
    )
    const playingNormal = isPlaying && playingRate === 1
    const playingPreview = isPlaying && playingRate === PREVIEW_RATE

    const stepBy = useCallback(
      async (deltaMs: number) => {
        await pause()
        const next = Math.max(selectionLo, Math.min(selectionHi, positionMs + deltaMs))
        await seekMs(next)
      },
      [pause, positionMs, selectionLo, selectionHi, seekMs]
    )

    return (
      <View style={[styles.outer, style]}>
        <View style={[styles.playerSlot, { height }]}>
          <ProLibraryGradientFrame
            borderRadius={proLibraryChrome.radii.frameOuter}
            innerBorderRadius={proLibraryChrome.radii.frameInner}
            strokeWidth={2.5}
            gradientVariant="accent"
            innerShadow={false}
            stretchInner
            style={styles.frame}
            innerStyle={styles.frameInner}
          >
            <View style={styles.mediaStack}>
              <Video
                ref={videoRef}
                source={{ uri: videoUri }}
                style={styles.video}
                // Web: expo-av sizes the <video> to its intrinsic ratio unless told to fill.
                videoStyle={{ width: '100%', height: '100%' }}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={false}
                isMuted
                useNativeControls={false}
                onReadyForDisplay={(e) => {
                  const ns = e.naturalSize
                  if (ns?.width > 0 && ns?.height > 0) {
                    onNaturalSize?.({ w: ns.width, h: ns.height })
                  }
                  setIsReady(true)
                }}
                onPlaybackStatusUpdate={handlePlaybackStatus}
                onError={() => {
                  /* ignore */
                }}
              />
              {!isReady ? (
                <View style={styles.loadingOverlay} pointerEvents="none">
                  <ActivityIndicator color="#00BBFF" size="large" />
                </View>
              ) : null}
            </View>
          </ProLibraryGradientFrame>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => void stepBy(-STEP_MS)}
            hitSlop={10}
            accessibilityLabel={t('techniqueExtra.stepBack')}
          >
            <Ionicons name="play-skip-back" size={22} color={CONTROL_ICON} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => void togglePlayAt(1)}
            hitSlop={10}
            accessibilityLabel={playingNormal ? t('techniqueExtra.pausePreview') : t('techniqueExtra.playClip')}
            testID="trim-play"
          >
            <Ionicons name={playingNormal ? 'pause' : 'play'} size={30} color={CONTROL_ICON} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => void stepBy(STEP_MS)}
            hitSlop={10}
            accessibilityLabel={t('techniqueExtra.stepForward')}
          >
            <Ionicons name="play-skip-forward" size={22} color={CONTROL_ICON} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.previewClipBtn}
            onPress={() => void togglePlayAt(PREVIEW_RATE)}
            accessibilityRole="button"
            accessibilityLabel={playingPreview ? t('techniqueExtra.pausePreview') : t('techniqueExtra.previewClip')}
            testID="trim-preview-half"
          >
            {playingPreview ? (
              <Ionicons name="pause" size={22} color={CONTROL_ICON} />
            ) : (
              <Text allowFontScaling={false} numberOfLines={1} style={styles.previewClipBtnText}>
                {t('technique.setClipScreen.previewClip')}
              </Text>
            )}
          </TouchableOpacity>

        </View>

      </View>
    )
  }
)

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    marginBottom: 4,
  },
  playerSlot: {
    width: '100%',
  },
  frame: {
    flex: 1,
    width: '100%',
  },
  frameInner: {
    backgroundColor: '#000000',
    padding: 0,
    overflow: 'hidden',
  },
  mediaStack: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    position: 'relative',
    backgroundColor: '#000000',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 8,
  },
  iconBtn: {
    width: 48,
    height: 52,
    borderRadius: 18,
    backgroundColor: CONTROL_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewClipBtn: {
    flex: 1,
    marginLeft: 4,
    height: 52,
    borderRadius: 18,
    backgroundColor: CONTROL_BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  previewClipBtnText: {
    color: CONTROL_ICON,
    fontSize: 13,
    fontWeight: '500',
  },
})
