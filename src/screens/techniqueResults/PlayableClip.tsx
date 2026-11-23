import { useContext, useEffect, useRef, useState } from 'react'
import { BackHandler, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { FullscreenSafeArea } from '../../components/FullscreenSafeArea'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LinearGradient } from 'expo-linear-gradient'
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av'
import { ThemeContext } from '../../context'
import { UI } from '../../components/ui'

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Compact clip with a reliable play / pause control. Optional tap-to-fullscreen. */
export function PlayableClip({
  uri,
  testID,
  accent,
  allowFullscreen = false,
}: {
  uri: string | null
  testID: string
  accent: string
  /** When true, tapping the video (not the play button) opens a fullscreen player. */
  allowFullscreen?: boolean
}) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const videoRef = useRef<Video>(null)
  const fullRef = useRef<Video>(null)
  const [playing, setPlaying] = useState(false)
  const [fullPlaying, setFullPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const playable = uri && !failed ? uri : null

  useEffect(() => {
    setPlaying(false)
    setFullPlaying(false)
    setPosition(0)
    setDuration(0)
    setFailed(false)
    setFullscreen(false)
  }, [uri])

  useEffect(() => {
    if (!fullscreen) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setFullscreen(false)
      return true
    })
    return () => sub.remove()
  }, [fullscreen])

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

  function onFullStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) return
    setPosition(status.positionMillis)
    setDuration(status.durationMillis ?? 0)
    setFullPlaying(status.isPlaying)
    if (status.didJustFinish) {
      setFullPlaying(false)
      void fullRef.current?.setPositionAsync(0)
    }
  }

  async function togglePlay(target: 'inline' | 'full') {
    const ref = target === 'full' ? fullRef.current : videoRef.current
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

  async function openFullscreen() {
    if (!playable || !allowFullscreen) return
    try {
      await videoRef.current?.pauseAsync()
    } catch {
      // ignore
    }
    setPlaying(false)
    setFullscreen(true)
  }

  function closeFullscreen() {
    setFullscreen(false)
    setFullPlaying(false)
    void videoRef.current?.setPositionAsync(position).catch(() => undefined)
  }

  return (
    <View style={[styles.mediaFrame, { borderColor: accent }]} testID={testID}>
      {playable ? (
        <Pressable
          style={styles.mediaPress}
          accessibilityRole={allowFullscreen ? 'button' : undefined}
          accessibilityLabel={allowFullscreen ? t('analysis.fullscreen') : undefined}
          disabled={!allowFullscreen}
          onPress={() => void openFullscreen()}
        >
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
        </Pressable>
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
            onPress={() => void togglePlay('inline')}
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
          {allowFullscreen ? (
            <Pressable
              style={styles.expand}
              accessibilityRole="button"
              accessibilityLabel={t('analysis.fullscreen')}
              hitSlop={8}
              onPress={() => void openFullscreen()}
              testID={`${testID}-fullscreen`}
            >
              <Ionicons name="expand-outline" size={16} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </LinearGradient>
      ) : null}

      <Modal
        visible={fullscreen && !!playable}
        animationType="fade"
        onRequestClose={closeFullscreen}
        supportedOrientations={['portrait']}
      >
        <FullscreenSafeArea style={styles.fullRoot}>
          <View style={styles.fullBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('analysis.back')}
              onPress={closeFullscreen}
              hitSlop={12}
              style={styles.fullBack}
              testID={`${testID}-fullscreen-back`}
            >
              <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
              <Text allowFontScaling={false} style={[styles.fullBackLabel, { fontFamily: theme.semiBoldFont }]}>
                {t('analysis.back')}
              </Text>
            </Pressable>
          </View>
          <View style={styles.fullStage}>
            {playable ? (
              <Video
                key={`${playable}-full`}
                ref={fullRef}
                source={{ uri: playable }}
                style={StyleSheet.absoluteFill}
                resizeMode={ResizeMode.CONTAIN}
                isMuted
                shouldPlay
                useNativeControls={false}
                onLoad={() => {
                  const at = Math.max(0, position)
                  void fullRef.current?.setStatusAsync({
                    shouldPlay: true,
                    positionMillis: at,
                    seekMillisToleranceBefore: 0,
                    seekMillisToleranceAfter: 80,
                  })
                }}
                onPlaybackStatusUpdate={onFullStatus}
              />
            ) : null}
          </View>
          <View style={styles.fullControls}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void togglePlay('full')}
              style={styles.play}
            >
              <Ionicons
                name={fullPlaying ? 'pause' : 'play'}
                size={18}
                color="#FFFFFF"
                style={fullPlaying ? undefined : styles.playIcon}
              />
            </Pressable>
            <Text allowFontScaling={false} style={[styles.time, { fontFamily: theme.mediumFont }]}>
              {clock(position)}/{clock(duration)}
            </Text>
          </View>
        </FullscreenSafeArea>
      </Modal>
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
  mediaPress: { ...StyleSheet.absoluteFillObject },
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
  time: { color: '#FFFFFF', fontSize: 12, flex: 1 },
  expand: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6, 16, 40, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  fullRoot: { flex: 1, backgroundColor: '#000' },
  fullBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fullBack: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  fullBackLabel: { color: '#FFFFFF', fontSize: 17 },
  fullStage: { flex: 1, backgroundColor: '#000' },
  fullControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
})
