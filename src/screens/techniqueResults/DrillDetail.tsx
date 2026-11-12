import { useCallback, useContext, useMemo, useRef, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { LinearGradient } from 'expo-linear-gradient'
import { ResizeMode, Video, type AVPlaybackStatus } from 'expo-av'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { ThemeContext } from '../../context'
import { CARD_GLOW, UI } from '../../components/ui'
import type { Drill, DrillLevel } from '../../lib/drillsApi'

type Props = {
  drill: Drill
  /**
   * Clip for the player. Drills have no videos of their own yet, so this is the player's own
   * analyzed shot unless the drill carries a `videoUrl`.
   */
  videoUri: string | null
  /** Frame of the player's clip at contact, for the step cards. */
  thumb: string | null
  shotLabel: string | null
  /** "Elbow & Racket": the analysis focus the drills were picked for. */
  focusLine: string
  onOpenStep: (index: number) => void
  onClose: () => void
}

const BODY_ART = require('../../../assets/smart3d/body.webp')
export const LEVEL_TONE: Record<DrillLevel, { bg: string; fg: string }> = {
  beginner: { bg: 'rgba(52, 199, 89, 0.16)', fg: '#5BE38A' },
  intermediate: { bg: 'rgba(52, 199, 89, 0.16)', fg: '#5BE38A' },
  advanced: { bg: 'rgba(245, 160, 51, 0.16)', fg: '#F5A033' },
}
const VALUE_GREEN = '#5BE38A'
const STATUS_INTERVAL_MS = 100
/** Seek at most this often while dragging, so the decoder keeps up. */
const SCRUB_SEEK_MS = 80
const EXACT_SEEK = { toleranceMillisBefore: 0, toleranceMillisAfter: 0 }

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** One drill: header, the clip, its stats and numbered steps. Opened from a card in DrillsView. */
export function DrillDetail({ drill, videoUri, thumb, shotLabel, focusLine, onOpenStep, onClose }: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const tone = LEVEL_TONE[drill.level] ?? LEVEL_TONE.beginner
  const levelLabel = t(`analysis.drills.level.${drill.level}`)
  const clipUri = drill.videoUrl || videoUri

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: 96 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
      testID="drill-detail"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('analysis.back')}
        hitSlop={12}
        onPress={onClose}
        style={styles.back}
        testID="drill-detail-back"
      >
        <Ionicons name="chevron-back" size={30} color="#86A7D2" />
      </Pressable>

      <View style={styles.head}>
        <View style={[styles.ring, CARD_GLOW]}>
          <View style={styles.disc}>
            <Image source={BODY_ART} style={styles.art} resizeMode="cover" />
          </View>
        </View>
        <View style={styles.headCopy}>
          <View style={styles.titleRow}>
            <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.regularFont }]}>
              {drill.title}
            </Text>
            <View style={[styles.level, { backgroundColor: tone.bg }]}>
              <Text allowFontScaling={false} style={[styles.levelText, { color: tone.fg, fontFamily: theme.regularFont }]}>
                {levelLabel}
              </Text>
            </View>
          </View>
          <View style={styles.subRow}>
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.sub, { fontFamily: theme.regularFont }]}>
              {shotLabel || t('analysis.drills.shotFallback')}
            </Text>
            {focusLine ? (
              <>
                <View style={styles.subDivider} />
                <Text allowFontScaling={false} numberOfLines={1} style={[styles.sub, styles.subShrink, { fontFamily: theme.regularFont }]}>
                  {focusLine}
                </Text>
              </>
            ) : null}
          </View>
          <Text allowFontScaling={false} style={[styles.summary, { fontFamily: theme.regularFont }]}>
            {drill.summary}
          </Text>
        </View>
      </View>

      {clipUri ? <DrillPlayer uri={clipUri} poster={drill.videoUrl ? null : thumb} /> : null}

      <View style={styles.stats}>
        <Stat
          icon={<MaterialCommunityIcons name="bullseye-arrow" size={22} color={UI.text} />}
          label={t('analysis.drills.detail.focus')}
          value={drill.focusLabel}
        />
        <Stat
          icon={<MaterialCommunityIcons name="signal-cellular-3" size={22} color={UI.text} />}
          label={t('analysis.drills.detail.level')}
          value={levelLabel}
          valueColor={tone.fg}
        />
        <Stat
          icon={<Ionicons name="time-outline" size={22} color={UI.text} />}
          label={t('analysis.drills.detail.duration')}
          value={t('analysis.drills.minutes', { count: drill.minutes })}
          valueColor={VALUE_GREEN}
        />
      </View>

      <View style={styles.stepsHead}>
        <Text allowFontScaling={false} style={[styles.stepsTitle, { fontFamily: theme.regularFont }]}>
          {t('analysis.drills.detail.stepsTitle')}
        </Text>
        <Text allowFontScaling={false} style={[styles.stepsCount, { fontFamily: theme.regularFont }]}>
          {t('analysis.drills.detail.stepCount', { count: drill.steps.length })}
        </Text>
      </View>

      {drill.steps.map((step, i) => (
        <View key={i} style={styles.stepRow} testID={`drill-step-${i + 1}`}>
          <LinearGradient colors={['#0B1F57', '#041641']} style={styles.stepNum}>
            <Text allowFontScaling={false} style={[styles.stepNumText, { fontFamily: theme.regularFont }]}>
              {i + 1}
            </Text>
          </LinearGradient>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('analysis.drills.detail.playStep', { n: i + 1 })}
            onPress={() => onOpenStep(i)}
            style={[styles.stepCard, CARD_GLOW]}
          >
            {clipUri ? (
              <View style={styles.stepThumb}>
                {thumb ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
                <Ionicons name="play" size={26} color={UI.text} />
              </View>
            ) : null}
            <View style={styles.stepBody}>
              <Text allowFontScaling={false} style={[styles.stepTitle, { fontFamily: theme.regularFont }]}>
                {t('analysis.drills.detail.step', { n: i + 1 })}
              </Text>
              <Text allowFontScaling={false} style={[styles.stepText, { fontFamily: theme.regularFont }]}>
                {step}
              </Text>
            </View>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  )
}

function Stat({
  icon,
  label,
  value,
  valueColor = UI.text,
}: {
  icon: React.ReactNode
  label: string
  value: string
  valueColor?: string
}) {
  const { theme } = useContext(ThemeContext)
  return (
    <View style={[styles.stat, CARD_GLOW]}>
      {icon}
      <View style={styles.statCopy}>
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.statLabel, { fontFamily: theme.regularFont }]}>
          {label}
        </Text>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[styles.statValue, { color: valueColor, fontFamily: theme.regularFont }]}
        >
          {value}
        </Text>
      </View>
    </View>
  )
}

export type DrillPlayerHandle = { playFrom: (ms: number) => void }

/** Plain player: play/pause, a draggable track, the clock and native full screen. */
export function DrillPlayer({
  uri,
  poster,
  handleRef,
}: {
  uri: string
  poster: string | null
  handleRef?: React.MutableRefObject<DrillPlayerHandle | null>
}) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const videoRef = useRef<Video>(null)
  const [frameW, setFrameW] = useState(0)
  const [trackW, setTrackW] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [scrubMs, setScrubMs] = useState<number | null>(null)
  const scrub = useRef({ wasPlaying: false, lastSeek: 0 })
  const frameH = frameW > 0 ? Math.round(frameW * (9 / 16)) : 200
  const shownMs = scrubMs ?? position
  const progress = duration > 0 ? Math.max(0, Math.min(1, shownMs / duration)) : 0

  function onStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) return
    setPosition(status.positionMillis)
    setDuration(status.durationMillis ?? 0)
    setPlaying(status.isPlaying)
  }

  function seekAndPlay(ms: number, play: boolean) {
    // At the very end, play restarts from the top instead of doing nothing.
    const next = play && duration > 0 && ms >= duration - 120 ? 0 : ms
    setPosition(next)
    setPlaying(play)
    void videoRef.current?.setStatusAsync({
      shouldPlay: play,
      positionMillis: next,
      seekMillisToleranceBefore: 0,
      seekMillisToleranceAfter: 80,
    })
  }

  if (handleRef) handleRef.current = { playFrom: (ms) => seekAndPlay(ms, true) }

  const msAt = useCallback(
    (x: number) => (duration > 0 && trackW > 0 ? Math.max(0, Math.min(1, x / trackW)) * duration : 0),
    [duration, trackW]
  )
  const scrubStart = useCallback(
    (x: number) => {
      scrub.current = { wasPlaying: playing, lastSeek: 0 }
      if (playing) void videoRef.current?.pauseAsync()
      setScrubMs(msAt(x))
    },
    [msAt, playing]
  )
  const scrubMove = useCallback(
    (x: number) => {
      const ms = msAt(x)
      setScrubMs(ms)
      const now = Date.now()
      if (now - scrub.current.lastSeek >= SCRUB_SEEK_MS) {
        scrub.current.lastSeek = now
        void videoRef.current?.setPositionAsync(ms, EXACT_SEEK)
      }
    },
    [msAt]
  )
  const scrubEnd = useCallback(
    (x: number) => {
      const ms = msAt(x)
      const video = videoRef.current
      setPosition(ms)
      void (async () => {
        try {
          await video?.setPositionAsync(ms, EXACT_SEEK)
          if (scrub.current.wasPlaying) await video?.playAsync()
        } finally {
          setScrubMs(null)
        }
      })()
    },
    [msAt]
  )
  const trackGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-4, 4])
      .failOffsetY([-14, 14])
      .onStart((e) => scrubStart(e.x))
      .onUpdate((e) => scrubMove(e.x))
      .onEnd((e) => scrubEnd(e.x))
    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd((e, success) => {
        if (!success) return
        scrubStart(e.x)
        scrubEnd(e.x)
      })
    return Gesture.Exclusive(pan, tap)
  }, [scrubStart, scrubMove, scrubEnd])

  return (
    <View style={[styles.playerBorder, CARD_GLOW]}>
      <View
        style={styles.playerFrame}
        onLayout={(e) => {
          const next = Math.floor(e.nativeEvent.layout.width)
          setFrameW((prev) => (prev === next ? prev : next))
        }}
      >
        {frameW > 0 ? (
          <Video
            ref={videoRef}
            source={{ uri }}
            style={{ width: frameW, height: frameH }}
            resizeMode={ResizeMode.COVER}
            posterSource={poster ? { uri: poster } : undefined}
            usePoster={!!poster}
            posterStyle={{ resizeMode: 'cover' }}
            onPlaybackStatusUpdate={onStatus}
            progressUpdateIntervalMillis={STATUS_INTERVAL_MS}
            testID="drill-video"
          />
        ) : (
          <View style={{ height: frameH }} />
        )}
        <Pressable
          style={styles.fullscreen}
          onPress={() => void videoRef.current?.presentFullscreenPlayer().catch(() => {})}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('analysis.fullscreen')}
        >
          <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
      <View style={styles.controls}>
        <Pressable
          style={styles.play}
          onPress={() => seekAndPlay(position, !playing)}
          accessibilityRole="button"
          accessibilityLabel={t(playing ? 'analysis.drills.detail.pause' : 'analysis.drills.detail.play')}
          testID="drill-video-play"
        >
          <Ionicons name={playing ? 'pause' : 'play'} size={18} color="#FFFFFF" style={playing ? undefined : styles.playIcon} />
        </Pressable>
        <GestureDetector gesture={trackGesture}>
          <View style={styles.trackHit} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)} accessibilityRole="adjustable">
            <View style={styles.track}>
              <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
              <View style={[styles.thumb, { left: `${progress * 100}%` }]} />
            </View>
          </View>
        </GestureDetector>
        <Text allowFontScaling={false} style={[styles.time, { fontFamily: theme.mediumFont }]}>
          {clock(shownMs)}/{clock(duration)}
        </Text>
      </View>
    </View>
  )
}

const RING = 84
const BLUE = '#1F4BFF'

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 18 },
  back: { alignSelf: 'flex-start', padding: 2 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2.5,
    borderColor: UI.accentStrong,
    padding: 6,
  },
  disc: { flex: 1, borderRadius: RING, overflow: 'hidden', backgroundColor: UI.surface },
  art: { position: 'absolute', width: RING * 2.6, height: RING * 2.6 * (844 / 1024), left: -RING * 0.95, top: -RING * 0.25 },
  headCopy: { flex: 1, gap: 4, paddingTop: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, color: UI.text, fontSize: 20, lineHeight: 25 },
  level: { borderRadius: UI.radiusPill, paddingHorizontal: 10, paddingVertical: 4 },
  levelText: { fontSize: 12 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sub: { color: '#4DA6FF', fontSize: 16 },
  subShrink: { flexShrink: 1 },
  subDivider: { width: 1.5, height: 18, backgroundColor: '#4DA6FF' },
  summary: { color: UI.text, fontSize: 13, lineHeight: 18, marginTop: 2 },
  playerBorder: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: BLUE,
    overflow: 'hidden',
    backgroundColor: '#0B1F57',
  },
  playerFrame: { backgroundColor: '#000' },
  fullscreen: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4, 16, 40, 0.7)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#13308F',
  },
  play: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#041641',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  playIcon: { marginLeft: 2 },
  trackHit: { flex: 1, justifyContent: 'center', height: 28 },
  track: { height: 6, borderRadius: 3, backgroundColor: '#3D7CFF', justifyContent: 'center' },
  trackFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3, backgroundColor: '#FFFFFF' },
  thumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    marginLeft: -8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  time: { color: '#FFFFFF', fontSize: 14, minWidth: 74, textAlign: 'right' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: BLUE,
    backgroundColor: '#041641',
  },
  statCopy: { flex: 1, minWidth: 0 },
  statLabel: { color: UI.text, fontSize: 12 },
  statValue: { fontSize: 13 },
  stepsHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 },
  stepsTitle: { color: UI.text, fontSize: 22 },
  stepsCount: { color: UI.textSubtle, fontSize: 18 },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  stepNum: {
    width: 46,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { color: '#4DA6FF', fontSize: 34 },
  stepCard: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 96,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: BLUE,
    backgroundColor: '#041641',
    overflow: 'hidden',
  },
  stepThumb: { width: '30%', backgroundColor: UI.surface, alignItems: 'center', justifyContent: 'center' },
  stepBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 4, justifyContent: 'center' },
  stepTitle: { color: '#4DA6FF', fontSize: 16 },
  stepText: { color: UI.text, fontSize: 13, lineHeight: 18 },
})
