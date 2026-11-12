import { useContext, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LinearGradient } from 'expo-linear-gradient'
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av'
import { ThemeContext } from '../../context'
import { UI } from '../../components/ui'

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Compact clip with a reliable play / pause control. */
export function PlayableClip({
  uri,
  testID,
  accent,
}: {
  uri: string | null
  testID: string
  accent: string
}) {
  const { theme } = useContext(ThemeContext)
  const videoRef = useRef<Video>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)
  const playable = uri && !failed ? uri : null

  useEffect(() => {
    setPlaying(false)
    setPosition(0)
    setDuration(0)
    setFailed(false)
  }, [uri])

  function onStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) {
      if (status.error) setFailed(true)
      return
    }
    setPosition(status.positionMillis)
    setDuration(status.durationMillis ?? 0)
    setPlaying(status.isPlaying)
    if (status.didJustFinish) {
      setPlaying(false)
      void videoRef.current?.setPositionAsync(0)
    }
  }

  async function togglePlay() {
    const ref = videoRef.current
    if (!ref || !playable) return
    try {
      const status = await ref.getStatusAsync()
      if (!status.isLoaded) {
        await ref.playAsync()
        return
      }
      if (status.isPlaying) {
        await ref.pauseAsync()
      } else {
        if (status.durationMillis && status.positionMillis >= status.durationMillis - 80) {
          await ref.setPositionAsync(0)
        }
        await ref.playAsync()
      }
    } catch {
      // Ignore transient AV race; next tap retries.
    }
  }

  return (
    <View style={[styles.mediaFrame, { borderColor: accent }]} testID={testID}>
      {playable ? (
        <Video
          key={playable}
          ref={videoRef}
          source={{ uri: playable }}
          style={styles.media}
          resizeMode={ResizeMode.COVER}
          isMuted
          shouldPlay={false}
          useNativeControls={false}
          onPlaybackStatusUpdate={onStatus}
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={styles.proEmpty}>
          <Ionicons name="videocam-off-outline" size={28} color="#3D9DFF" />
        </View>
      )}
      {playable ? (
        <LinearGradient
          pointerEvents="box-none"
          colors={['rgba(20, 60, 200, 0)', 'rgba(8, 24, 58, 0.92)']}
          locations={[0, 0.55]}
          style={styles.clipControls}
        >
          <Pressable
            style={styles.play}
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause' : 'Play'}
            hitSlop={8}
            onPress={() => void togglePlay()}
            testID={`${testID}-play`}
          >
            <Ionicons
              name={playing ? 'pause' : 'play'}
              size={18}
              color={UI.text}
              style={playing ? undefined : styles.playIcon}
            />
          </Pressable>
          <Text allowFontScaling={false} style={[styles.time, { fontFamily: theme.mediumFont }]}>
            {clock(position)}/{clock(duration)}
          </Text>
        </LinearGradient>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  mediaFrame: {
    flex: 1,
    minHeight: 140,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderTopWidth: 0,
  },
  media: { ...StyleSheet.absoluteFillObject },
  proEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 140 },
  clipControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6, 16, 40, 0.72)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.92)',
  },
  playIcon: { marginLeft: 2 },
  time: { color: '#FFFFFF', fontSize: 12 },
})
