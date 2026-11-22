import { useEffect, useRef, useState } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av'

/** Placeholder clip length when no real media URI is provided. */
export const VIDEO_DURATION_SEC = 8

function formatVideoClock(seconds: number, durationSec: number) {
  const clamped = Math.max(0, Math.min(durationSec, seconds))
  const whole = Math.floor(clamped)
  const mins = Math.floor(whole / 60)
  const secs = whole % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

type Props = {
  fontFamily: string
  /** Absolute video URL. Null/empty keeps the timer placeholder. */
  uri?: string | null
  /** Extra shell style (e.g. margin). */
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * Drill player — real expo-av Video when `uri` is set; otherwise 8s scrubber placeholder.
 * Shared by drill overview + walkthrough.
 */
export function MockDrillPlayer({ fontFamily, uri, style, testID }: Props) {
  const insets = useSafeAreaInsets()
  const hasUri = !!(uri && uri.trim())
  const videoRef = useRef<Video>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [durationSec, setDurationSec] = useState(hasUri ? 0 : VIDEO_DURATION_SEC)
  const [fullscreen, setFullscreen] = useState(false)
  const scrubWRef = useRef(0)
  const scrubLeftRef = useRef(0)
  const trackRef = useRef<View>(null)

  useEffect(() => {
    setPlaying(false)
    setCurrent(0)
    setDurationSec(hasUri ? 0 : VIDEO_DURATION_SEC)
  }, [uri, hasUri])

  useEffect(() => {
    if (hasUri || !playing) return
    const id = setInterval(() => {
      setCurrent((t) => {
        const next = t + 0.05
        if (next >= VIDEO_DURATION_SEC) {
          setPlaying(false)
          return VIDEO_DURATION_SEC
        }
        return next
      })
    }, 50)
    return () => clearInterval(id)
  }, [playing, hasUri])

  const effectiveDuration = durationSec > 0 ? durationSec : VIDEO_DURATION_SEC
  const pct = Math.max(0, Math.min(100, (current / effectiveDuration) * 100))
  const clockLabel = `${formatVideoClock(current, effectiveDuration)}/${formatVideoClock(
    effectiveDuration,
    effectiveDuration
  )}`

  function onPlaybackStatusUpdate(status: AVPlaybackStatus) {
    if (!status.isLoaded) return
    const dur = (status.durationMillis ?? 0) / 1000
    const pos = (status.positionMillis ?? 0) / 1000
    if (dur > 0) setDurationSec(dur)
    setCurrent(pos)
    setPlaying(status.isPlaying)
    if (status.didJustFinish) {
      setPlaying(false)
      setCurrent(dur > 0 ? dur : 0)
    }
  }

  async function togglePlay() {
    if (hasUri) {
      const ref = videoRef.current
      if (!ref) return
      const status = await ref.getStatusAsync()
      if (!status.isLoaded) {
        await ref.playAsync()
        return
      }
      if (status.didJustFinish || (status.durationMillis != null && status.positionMillis >= status.durationMillis - 50)) {
        await ref.setPositionAsync(0)
        await ref.playAsync()
        return
      }
      if (status.isPlaying) await ref.pauseAsync()
      else await ref.playAsync()
      return
    }
    if (current >= VIDEO_DURATION_SEC) {
      setCurrent(0)
      setPlaying(true)
      return
    }
    setPlaying((p) => !p)
  }

  async function seekFromPageX(pageX: number) {
    const w = scrubWRef.current
    if (w <= 0) return
    const ratio = Math.max(0, Math.min(1, (pageX - scrubLeftRef.current) / w))
    if (hasUri) {
      const ref = videoRef.current
      if (!ref) return
      const status = await ref.getStatusAsync()
      if (!status.isLoaded || !status.durationMillis) return
      await ref.setPositionAsync(ratio * status.durationMillis)
      return
    }
    setCurrent(ratio * VIDEO_DURATION_SEC)
  }

  function captureScrubGeometry(then?: (pageX: number) => void, pageX?: number) {
    trackRef.current?.measureInWindow((x, _y, width) => {
      scrubLeftRef.current = x
      scrubWRef.current = width
      if (then != null && pageX != null) then(pageX)
    })
  }

  function onScrubGrant(e: GestureResponderEvent) {
    const pageX = e.nativeEvent.pageX
    captureScrubGeometry((x) => {
      void seekFromPageX(x)
    }, pageX)
  }

  function onScrubMove(e: GestureResponderEvent) {
    void seekFromPageX(e.nativeEvent.pageX)
  }

  function renderStage(full: boolean, attachVideo: boolean) {
    return (
      <View style={[styles.playerStage, full ? styles.playerStageFull : null]}>
        {hasUri && attachVideo ? (
          <Video
            ref={videoRef}
            style={StyleSheet.absoluteFill}
            source={{ uri: uri!.trim() }}
            // Inline card matches analysis/PlayableClip: fill the frame (portrait no longer letterboxes).
            // Fullscreen keeps CONTAIN so the whole clip stays visible.
            resizeMode={full ? ResizeMode.CONTAIN : ResizeMode.COVER}
            useNativeControls={false}
            isLooping={false}
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            shouldPlay={false}
          />
        ) : null}
        <Pressable
          style={[
            styles.fullscreen,
            // Fullscreen modal is statusBarTranslucent — keep the exit control below the notch/Dynamic Island.
            full ? { top: Math.max(insets.top, 12) + 8, right: Math.max(insets.right, 10) } : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel={full ? 'Exit fullscreen' : 'Fullscreen'}
          hitSlop={12}
          onPress={() => setFullscreen((v) => !v)}
        >
          <Ionicons name={full ? 'close' : 'expand-outline'} size={full ? 18 : 16} color="#FFFFFF" />
        </Pressable>
        <View
          style={[
            styles.controls,
            full ? { paddingBottom: Math.max(insets.bottom, 12) + 8 } : null,
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause' : 'Play'}
            style={styles.playBtn}
            hitSlop={6}
            onPress={() => {
              void togglePlay()
            }}
          >
            <Ionicons
              name={playing ? 'pause' : 'play'}
              size={14}
              color="#FFFFFF"
              style={playing ? undefined : styles.playBtnIcon}
            />
          </Pressable>
          <View
            ref={trackRef}
            style={styles.track}
            onLayout={(e) => {
              scrubWRef.current = e.nativeEvent.layout.width
            }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
            onResponderGrant={onScrubGrant}
            onResponderMove={onScrubMove}
            accessibilityRole="adjustable"
            accessibilityLabel="Seek"
          >
            <View style={styles.trackRail} pointerEvents="none" />
            <View style={[styles.trackFill, { width: `${pct}%` }]} pointerEvents="none" />
            <View style={[styles.trackKnob, { left: `${pct}%` }]} pointerEvents="none" />
          </View>
          <Text allowFontScaling={false} style={[styles.clock, { fontFamily }]}>
            {clockLabel}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <>
      <View style={[styles.player, style]} testID={testID}>
        <View style={styles.playerClip}>{renderStage(false, !fullscreen)}</View>
      </View>
      <Modal
        visible={fullscreen}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setFullscreen(false)}
        statusBarTranslucent
      >
        <View style={styles.fsRoot} testID={testID ? `${testID}-fullscreen` : undefined}>
          {renderStage(true, fullscreen)}
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  player: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#0048FF',
    backgroundColor: '#041641',
    marginBottom: 12,
    boxShadow: '0px 0px 16px 0px #0048FF88',
  },
  playerClip: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  playerStage: {
    height: 200,
    backgroundColor: '#0A1630',
    position: 'relative',
  },
  playerStageFull: {
    flex: 1,
    height: undefined,
  },
  fsRoot: {
    flex: 1,
    backgroundColor: '#030A17',
  },
  fullscreen: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#041641',
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#07256DCC',
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#041641',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnIcon: { marginLeft: 2 },
  track: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
  },
  trackRail: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(77, 140, 255, 0.55)',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  trackKnob: {
    position: 'absolute',
    marginLeft: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },
  clock: { color: '#FFFFFF', fontSize: 12, minWidth: 58, textAlign: 'right' },
})
