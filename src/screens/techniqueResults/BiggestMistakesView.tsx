import { useContext, useEffect, useRef, useState } from 'react'
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LinearGradient } from 'expo-linear-gradient'
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av'
import Svg, { Circle, Ellipse, Path } from 'react-native-svg'
import { ThemeContext } from '../../context'

type MistakeId = 'elbow' | 'racket' | 'torso' | 'foot'

type Mistake = {
  id: MistakeId
  n: number
  color: string
  titleKey: string
  bodyKey: string
  whyKey: string
  words: string[]
  marker: { left: `${number}%`; top: `${number}%` }
}

const MISTAKES: Mistake[] = [
  {
    id: 'elbow',
    n: 1,
    color: '#FF3B30',
    titleKey: 'analysis.mistakeElbow',
    bodyKey: 'analysis.mistakeElbowBody',
    whyKey: 'analysis.mistakeElbowWhy',
    words: ['elbow', 'codo'],
    marker: { left: '38%', top: '30%' },
  },
  {
    id: 'racket',
    n: 2,
    color: '#2F7BFF',
    titleKey: 'analysis.mistakeRacket',
    bodyKey: 'analysis.mistakeRacketBody',
    whyKey: 'analysis.mistakeRacketWhy',
    words: ['racket', 'raqueta'],
    marker: { left: '46%', top: '22%' },
  },
  {
    id: 'torso',
    n: 3,
    color: '#FF9A1A',
    titleKey: 'analysis.mistakeTorso',
    bodyKey: 'analysis.mistakeTorsoBody',
    whyKey: 'analysis.mistakeTorsoWhy',
    words: ['torso', 'rotation', 'rotación'],
    marker: { left: '52%', top: '48%' },
  },
  {
    id: 'foot',
    n: 4,
    color: '#34C759',
    titleKey: 'analysis.mistakeFoot',
    bodyKey: 'analysis.mistakeFootBody',
    whyKey: 'analysis.mistakeFootWhy',
    words: ['foot', 'feet', 'pie'],
    marker: { left: '44%', top: '70%' },
  },
]

type Props = {
  videoUri: string | null
  videoKey: string
  errors: string[]
  elbowDeg: number | null
  torsoDeg: number | null
  onClose: () => void
  onSmart3d: () => void
}

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function matchError(errors: string[], words: string[]) {
  const hit = errors.find((line) => words.some((word) => line.toLowerCase().includes(word)))
  return hit?.trim() || null
}

function rangeDiff(value: number, low: number, high: number) {
  if (value < low) return Math.round(value - low)
  if (value > high) return Math.round(value - high)
  return 0
}

export function BiggestMistakesView({
  videoUri,
  videoKey,
  errors,
  elbowDeg,
  torsoDeg,
  onClose,
  onSmart3d,
}: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const videoRef = useRef<Video>(null)
  const [selected, setSelected] = useState<MistakeId>('elbow')
  const [frameW, setFrameW] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const mistake = MISTAKES.find((item) => item.id === selected) ?? MISTAKES[0]!
  const matched = matchError(errors, mistake.words)
  const frameH = frameW > 0 ? Math.round(frameW * (9 / 16)) : 180
  const playProgress = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [onClose])

  function onStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) return
    setPosition(status.positionMillis)
    setDuration(status.durationMillis ?? 0)
    setPlaying(status.isPlaying)
  }

  const elbowValue = elbowDeg != null && Number.isFinite(elbowDeg) ? Math.round(elbowDeg) : null
  const torsoValue = torsoDeg != null && Number.isFinite(torsoDeg) ? Math.round(torsoDeg) : null
  const stats = [
    selected === 'elbow' && elbowValue != null
      ? {
          label: t('analysis.elbowAngle'),
          value: `${elbowValue}°`,
          target: t('analysis.mistakeElbowTarget'),
          diff: rangeDiff(elbowValue, 65, 95),
        }
      : null,
    selected === 'torso' && torsoValue != null
      ? {
          label: t('analysis.torsoRotation'),
          value: `${torsoValue}°`,
          target: t('analysis.mistakeTorsoTarget'),
          diff: rangeDiff(torsoValue, 20, 45),
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item != null)

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: 96 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.titleRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('analysis.back')}
          hitSlop={12}
          onPress={onClose}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={24} color="#86A7D2" />
        </Pressable>
        <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.boldFont ?? theme.semiBoldFont }]}>
          {t('analysis.biggestMistakes')}
        </Text>
      </View>

      <View style={styles.frameGlow}>
        <LinearGradient colors={['#7AECFF', '#2F6BFF', '#49D6FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.frameBorder}>
          <View
            style={styles.frame}
            onLayout={(event) => {
              const next = Math.floor(event.nativeEvent.layout.width)
              setFrameW((prev) => (prev === next ? prev : next))
            }}
          >
            {videoUri && frameW > 0 ? (
              <Video
                key={videoKey}
                ref={videoRef}
                source={{ uri: videoUri }}
                style={{ width: frameW, height: frameH }}
                resizeMode={ResizeMode.COVER}
                onPlaybackStatusUpdate={onStatus}
              />
            ) : (
              <View style={{ width: '100%', height: frameH, backgroundColor: '#000' }} />
            )}
            {MISTAKES.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setSelected(item.id)}
                style={[styles.marker, item.marker, selected === item.id && styles.markerOn]}
              >
                <View style={[styles.markerDot, { backgroundColor: item.color }]}>
                  <Text allowFontScaling={false} style={styles.markerNum}>
                    {item.n}
                  </Text>
                </View>
              </Pressable>
            ))}
            <Pressable
              style={styles.fullscreen}
              onPress={() => void videoRef.current?.presentFullscreenPlayer()}
              hitSlop={8}
            >
              <Ionicons name="scan-outline" size={16} color="#FFFFFF" />
            </Pressable>
            <View style={styles.controls}>
              <Pressable
                style={styles.play}
                onPress={() => {
                  if (playing) void videoRef.current?.pauseAsync()
                  else void videoRef.current?.playAsync()
                }}
              >
                <Ionicons name={playing ? 'pause' : 'play'} size={16} color="#FFFFFF" />
              </Pressable>
              <View style={styles.track}>
                <View style={[styles.trackFill, { width: `${playProgress * 100}%` }]} />
              </View>
              <Text allowFontScaling={false} style={[styles.time, { fontFamily: theme.mediumFont }]}>
                {clock(position)}/{clock(duration)}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.strip}>
        {MISTAKES.map((item) => {
          const on = item.id === selected
          return (
            <Pressable key={item.id} style={styles.thumbCol} onPress={() => setSelected(item.id)}>
              <View style={[styles.thumb, on && styles.thumbOn]}>
                {videoUri ? (
                  <Video
                    source={{ uri: videoUri }}
                    style={styles.thumbVideo}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={false}
                    isMuted
                  />
                ) : (
                  <View style={styles.thumbVideo} />
                )}
                <View style={[styles.thumbBadge, { backgroundColor: item.color }]}>
                  <Text allowFontScaling={false} style={styles.markerNum}>
                    {item.n}
                  </Text>
                </View>
              </View>
              <Text allowFontScaling={false} numberOfLines={2} style={[styles.thumbLabel, { fontFamily: theme.mediumFont }]}>
                {t(item.titleKey)}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <View style={styles.detail}>
        <View style={styles.detailHead}>
          <View style={[styles.detailBadge, { backgroundColor: mistake.color }]}>
            <Text allowFontScaling={false} style={[styles.detailBadgeNum, { fontFamily: theme.semiBoldFont }]}>
              {mistake.n}
            </Text>
          </View>
          <Text allowFontScaling={false} style={[styles.detailTitle, { fontFamily: theme.semiBoldFont }]}>
            {t(mistake.titleKey)}
          </Text>
          <View style={styles.priority}>
            <Text allowFontScaling={false} style={[styles.priorityText, { fontFamily: theme.mediumFont }]}>
              {t('analysis.mistakeHighPriority')}
            </Text>
          </View>
        </View>
        <Text allowFontScaling={false} style={[styles.detailBody, { fontFamily: theme.regularFont }]}>
          {matched || t(mistake.bodyKey)}
        </Text>
        {stats.length > 0 ? (
          <View style={styles.statRow}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.statCard}>
                <Text allowFontScaling={false} style={[styles.statLabel, { fontFamily: theme.mediumFont }]}>
                  {stat.label}
                </Text>
                <Text allowFontScaling={false} style={[styles.statValue, { color: mistake.color, fontFamily: theme.semiBoldFont }]}>
                  {stat.value}
                </Text>
                <Text allowFontScaling={false} style={[styles.statMeta, { fontFamily: theme.regularFont }]}>
                  {stat.target}
                </Text>
                <Text allowFontScaling={false} style={[styles.statMeta, { fontFamily: theme.regularFont }]}>
                  {t('analysis.mistakeDiff', { value: `${stat.diff > 0 ? '+' : ''}${stat.diff}°` })}
                </Text>
                <View style={styles.statArt}>
                  <JointArt />
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.why}>
        <View style={styles.whyIcon}>
          <Ionicons name="bulb-outline" size={18} color="#7AECFF" />
        </View>
        <View style={styles.whyCopy}>
          <Text allowFontScaling={false} style={[styles.whyTitle, { fontFamily: theme.semiBoldFont }]}>
            {t('analysis.mistakeWhy')}
          </Text>
          <Text allowFontScaling={false} style={[styles.whyBody, { fontFamily: theme.regularFont }]}>
            {t(mistake.whyKey)}
          </Text>
        </View>
      </View>

      <Pressable onPress={onSmart3d} accessibilityRole="button" style={styles.smartBorderWrap}>
        <LinearGradient colors={['#3EC8FF', '#1A4FA8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.smartBorder}>
          <View style={styles.smartBtn}>
            <Ionicons name="cube-outline" size={18} color="#3EC8FF" />
            <Text allowFontScaling={false} style={[styles.smartLabel, { fontFamily: theme.semiBoldFont }]}>
              {t('analysis.smart3d')}
            </Text>
          </View>
        </LinearGradient>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => void videoRef.current?.playAsync()}
        style={styles.correctGlow}
      >
        <LinearGradient colors={['#3EC8FF', '#2454FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.correctBtn}>
          <Ionicons name="play" size={16} color="#FFFFFF" />
          <Text allowFontScaling={false} style={[styles.correctLabel, { fontFamily: theme.semiBoldFont }]}>
            {t('analysis.seeCorrectMovement')}
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>
    </ScrollView>
  )
}

function JointArt() {
  return (
    <Svg width={54} height={54} viewBox="0 0 54 54">
      <Ellipse cx="27" cy="27" rx="18" ry="16" fill="#123A72" />
      <Path d="M14 34 C20 18 34 16 40 28" stroke="#7EB6FF" strokeWidth="6" fill="none" strokeLinecap="round" />
      <Circle cx="30" cy="24" r="7" fill="rgba(255,59,48,0.45)" />
      <Circle cx="30" cy="24" r="3" fill="#FF5A4A" />
    </Svg>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { padding: 4 },
  title: { color: '#FFFFFF', fontSize: 22, flex: 1 },
  frameGlow: {
    borderRadius: 22,
    padding: 3,
    backgroundColor: 'rgba(0, 184, 255, 0.22)',
  },
  frameBorder: { borderRadius: 19, padding: 2 },
  frame: { borderRadius: 17, overflow: 'hidden', backgroundColor: '#000' },
  marker: { position: 'absolute' },
  markerOn: { transform: [{ scale: 1.15 }] },
  markerDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  markerNum: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  fullscreen: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4, 16, 40, 0.55)',
    borderWidth: 1.5,
    borderColor: '#3EC8FF',
  },
  controls: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(8, 24, 58, 0.72)' },
  trackFill: { height: 6, borderRadius: 3, backgroundColor: '#7AECFF' },
  time: { color: '#FFFFFF', fontSize: 12, minWidth: 68, textAlign: 'right' },
  strip: { flexDirection: 'row', gap: 8 },
  thumbCol: { flex: 1, gap: 6 },
  thumb: {
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#071428',
    borderWidth: 1,
    borderColor: 'rgba(46, 130, 230, 0.35)',
  },
  thumbOn: { borderColor: '#3EC8FF', borderWidth: 2 },
  thumbVideo: { width: '100%', height: '100%', backgroundColor: '#000' },
  thumbBadge: {
    position: 'absolute',
    left: 6,
    top: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbLabel: { color: '#D5E4FF', fontSize: 11, textAlign: 'center' },
  detail: {
    borderRadius: 16,
    backgroundColor: '#071428',
    borderWidth: 1,
    borderColor: 'rgba(46, 130, 230, 0.35)',
    padding: 12,
    gap: 10,
  },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  detailBadgeNum: { color: '#FFFFFF', fontSize: 14 },
  detailTitle: { color: '#FFFFFF', fontSize: 16, flex: 1 },
  priority: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FF5A4A',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priorityText: { color: '#FF5A4A', fontSize: 11 },
  detailBody: { color: 'rgba(231,242,255,0.82)', fontSize: 14, lineHeight: 20 },
  statRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#04122C',
    padding: 10,
    minHeight: 108,
    overflow: 'hidden',
  },
  statLabel: { color: '#9BB4D6', fontSize: 12 },
  statValue: { fontSize: 28, marginTop: 2 },
  statMeta: { color: '#9BB4D6', fontSize: 11, marginTop: 2 },
  statArt: { position: 'absolute', right: 4, bottom: 4 },
  why: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 16,
    backgroundColor: '#071428',
    borderWidth: 1,
    borderColor: 'rgba(46, 130, 230, 0.35)',
    padding: 12,
  },
  whyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(62, 200, 255, 0.12)',
  },
  whyCopy: { flex: 1, gap: 4 },
  whyTitle: { color: '#FFFFFF', fontSize: 15 },
  whyBody: { color: 'rgba(231,242,255,0.78)', fontSize: 13, lineHeight: 18 },
  smartBorderWrap: { borderRadius: 16 },
  smartBorder: { borderRadius: 16, padding: 1.5 },
  smartBtn: {
    height: 50,
    borderRadius: 14.5,
    backgroundColor: '#04122C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  smartLabel: { color: '#FFFFFF', fontSize: 16 },
  correctGlow: { borderRadius: 16 },
  correctBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  correctLabel: { color: '#FFFFFF', fontSize: 16 },
})
