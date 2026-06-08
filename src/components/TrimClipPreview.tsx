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

const PLAYBACK_RATE = 0.5
const STEP_MS = 100
const LOOP_END_TOLERANCE_MS = 80

export type TrimClipPreviewHandle = {
  seekMs: (ms: number) => Promise<void>
  pause: () => Promise<void>
  playSelectionLoop: (startMs: number, endMs: number) => Promise<void>
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

function formatTimeMs(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
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
    const positionEmitRafRef = useRef<number | null>(null)
    const lastEmittedPosRef = useRef(-1)

    const [isReady, setIsReady] = useState(false)
    const [isPlaying, setIsPlaying] = useState(false)
    const [positionMs, setPositionMs] = useState(0)
    const [seekHint, setSeekHint] = useState(false)

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
      setSeekHint(false)
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
          setSeekHint(true)
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
      async (startMs: number, endMs: number) => {
        const ref = videoRef.current
        if (!ref || !isReady) return
        const lo = Math.min(startMs, endMs)
        const hi = Math.max(startMs, endMs)
        loopRangeRef.current = { startMs: lo, endMs: hi }
        loopActiveRef.current = true
        try {
          await ref.setStatusAsync({
            positionMillis: lo,
            shouldPlay: true,
            rate: PLAYBACK_RATE,
            isMuted: true,
          })
          setPositionMs(lo)
          setIsPlaying(true)
          emitPosition(lo)
        } catch {
          setSeekHint(true)
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
                rate: PLAYBACK_RATE,
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

    const togglePlayPause = useCallback(async () => {
      if (isPlaying) {
        await pause()
        return
      }
      await playSelectionLoop(selectionLo, selectionHi)
    }, [isPlaying, pause, playSelectionLoop, selectionLo, selectionHi])

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
                  setSeekHint(true)
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
            <Ionicons name="play-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => void togglePlayPause()}
            hitSlop={10}
            accessibilityLabel={
              isPlaying ? t('techniqueExtra.pausePreview') : t('techniqueExtra.previewClip')
            }
          >
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={26} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => void stepBy(STEP_MS)}
            hitSlop={10}
            accessibilityLabel={t('techniqueExtra.stepForward')}
          >
            <Ionicons name="play-forward" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.previewClipBtn}
            onPress={() => void playSelectionLoop(selectionLo, selectionHi)}
            activeOpacity={0.85}
          >
            <Text allowFontScaling={false} style={styles.previewClipBtnText}>
              Preview clip (0.5×)
            </Text>
          </TouchableOpacity>
        </View>

        <Text allowFontScaling={false} style={styles.timeLine}>
          {formatTimeMs(positionMs)} · selection {formatTimeMs(selectionLo)}–{formatTimeMs(selectionHi)}
        </Text>
        {seekHint ? (
          <Text allowFontScaling={false} style={styles.warnLine}>
            Scrub may be slow on remote video; use the timeline below to adjust handles.
          </Text>
        ) : null}
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
    marginTop: 10,
    gap: 8,
    paddingHorizontal: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(22, 87, 207, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewClipBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 110, 255, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(0, 187, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  previewClipBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  timeLine: {
    marginTop: 6,
    paddingHorizontal: 4,
    fontSize: 12,
    color: 'rgba(200, 220, 255, 0.85)',
  },
  warnLine: {
    marginTop: 4,
    paddingHorizontal: 4,
    fontSize: 11,
    color: 'rgba(255, 200, 120, 0.95)',
  },
})
