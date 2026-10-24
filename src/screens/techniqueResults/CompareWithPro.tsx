import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LinearGradient } from 'expo-linear-gradient'
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av'
import { ThemeContext } from '../../context'

type Row = {
  id: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  title: string
  body: string
  value: string | null
}

type Props = {
  videoUri: string | null
  referenceImage: ImageSourcePropType | null
  referenceVideoUri: string | null
  elbowDeg: number | null
  elbowDeltaDeg: number | null
  torsoDeg: number | null
  wristBodyPerS: number | null
  power: number | null
  errors: string[]
  onClose: () => void
  onSmart3d: () => void
}

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function signed(value: number) {
  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : ''}${rounded}`
}

function racketError(errors: string[]) {
  return errors.find((line) => /racket|raqueta|face|cara/i.test(line))?.trim() || null
}

export function CompareWithPro({
  videoUri,
  referenceImage,
  referenceVideoUri,
  elbowDeg,
  elbowDeltaDeg,
  torsoDeg,
  wristBodyPerS,
  power,
  errors,
  onClose,
  onSmart3d,
}: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [onClose])

  const rows = useMemo(() => {
    const next: Row[] = []
    if (elbowDeg != null && Number.isFinite(elbowDeg)) {
      next.push({
        id: 'elbow',
        icon: 'fitness-outline',
        color: '#FF4D6A',
        title: t('analysis.compareElbow'),
        body:
          elbowDeltaDeg != null && Number.isFinite(elbowDeltaDeg)
            ? t('analysis.compareElbowDelta', { value: signed(elbowDeltaDeg) })
            : t('analysis.compareElbowBody'),
        value: `${Math.round(elbowDeg)}°`,
      })
    }
    const racket = racketError(errors)
    if (racket) {
      const early = /earl|antes|tempran|pronto|opening/i.test(racket)
      next.push({
        id: 'racket',
        icon: 'tennisball-outline',
        color: '#2F80FF',
        title: t('analysis.compareRacket'),
        body: racket,
        value: early ? t('analysis.compareEarly') : null,
      })
    }
    if (torsoDeg != null && Number.isFinite(torsoDeg)) {
      next.push({
        id: 'torso',
        icon: 'body-outline',
        color: '#34C759',
        title: t('analysis.compareTorso'),
        body: t('analysis.compareTorsoBody'),
        value: `${signed(torsoDeg)}°`,
      })
    }
    if (power != null && Number.isFinite(power)) {
      next.push({
        id: 'power',
        icon: 'stats-chart',
        color: '#3D9DFF',
        title: t('analysis.comparePower'),
        body: t('analysis.comparePowerBody'),
        value: String(Math.round(power)),
      })
    }
    if (wristBodyPerS != null && Number.isFinite(wristBodyPerS) && wristBodyPerS > 0) {
      next.push({
        id: 'wrist',
        icon: 'flash-outline',
        color: '#FF9F0A',
        title: t('analysis.compareWrist'),
        body: t('analysis.compareWristBody'),
        value: wristBodyPerS.toFixed(1),
      })
    }
    return next
  }, [elbowDeg, elbowDeltaDeg, errors, power, t, torsoDeg, wristBodyPerS])

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
        <View style={styles.titleCopy}>
          <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.boldFont ?? theme.semiBoldFont }]}>
            {t('analysis.compareWithPro')}
          </Text>
          <Text allowFontScaling={false} style={[styles.subtitle, { fontFamily: theme.mediumFont }]}>
            {t('analysis.compareSubtitle')}
          </Text>
        </View>
      </View>

      <View style={styles.mediaRow}>
        <ClipCard
          label={t('analysis.yourShot')}
          icon="information-circle"
          accent="#FF4D6A"
          videoUri={videoUri}
        />
        <ClipCard
          label={t('analysis.proReference')}
          icon="ribbon"
          accent="#3EC8FF"
          videoUri={referenceVideoUri}
          image={referenceVideoUri ? null : referenceImage}
          emptyLabel={t('analysis.compareProEmpty')}
        />
      </View>

      <View style={styles.card}>
        <Text allowFontScaling={false} style={[styles.cardTitle, { fontFamily: theme.semiBoldFont }]}>
          {t('analysis.compareKeyDifferences')}
        </Text>
        {rows.length === 0 ? (
          <Text allowFontScaling={false} style={[styles.empty, { fontFamily: theme.regularFont }]}>
            {t('analysis.compareEmpty')}
          </Text>
        ) : (
          rows.map((row) => (
            <View key={row.id} style={styles.diff}>
              <View style={[styles.diffIcon, { backgroundColor: row.color }]}>
                <Ionicons name={row.icon} size={16} color="#FFFFFF" />
              </View>
              <View style={styles.diffCopy}>
                <Text allowFontScaling={false} style={[styles.diffTitle, { fontFamily: theme.semiBoldFont }]}>
                  {row.title}
                </Text>
                <Text allowFontScaling={false} style={[styles.diffBody, { fontFamily: theme.regularFont }]}>
                  {row.body}
                </Text>
              </View>
              {row.value ? (
                <Text allowFontScaling={false} style={[styles.diffValue, { fontFamily: theme.semiBoldFont }]}>
                  {row.value}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </View>

      <Pressable onPress={onSmart3d} accessibilityRole="button">
        <LinearGradient colors={['#3EC8FF', '#1A4FA8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.smartBorder}>
          <View style={styles.smartBtn}>
            <Ionicons name="cube-outline" size={18} color="#3EC8FF" />
            <Text allowFontScaling={false} style={[styles.smartLabel, { fontFamily: theme.semiBoldFont }]}>
              {t('analysis.smart3d')}
            </Text>
          </View>
        </LinearGradient>
      </Pressable>
    </ScrollView>
  )
}

function ClipCard({
  label,
  icon,
  accent,
  videoUri,
  image,
  emptyLabel,
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  accent: string
  videoUri: string | null
  image?: ImageSourcePropType | null
  emptyLabel?: string
}) {
  const { theme } = useContext(ThemeContext)
  const videoRef = useRef<Video>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)

  function onStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) return
    setPosition(status.positionMillis)
    setDuration(status.durationMillis ?? 0)
    setPlaying(status.isPlaying)
  }

  return (
    <View style={[styles.clip, { borderColor: accent }]}>
      {videoUri ? (
        <Video
          ref={videoRef}
          source={{ uri: videoUri }}
          style={styles.clipMedia}
          resizeMode={ResizeMode.COVER}
          isMuted
          onPlaybackStatusUpdate={onStatus}
        />
      ) : image ? (
        <Image source={image} style={styles.clipMedia} resizeMode="cover" />
      ) : (
        <View style={styles.clipEmpty}>
          <Ionicons name="body" size={28} color="#3D9DFF" />
          {emptyLabel ? (
            <Text allowFontScaling={false} style={[styles.clipEmptyText, { fontFamily: theme.regularFont }]}>
              {emptyLabel}
            </Text>
          ) : null}
        </View>
      )}
      <View style={styles.clipBadge}>
        <Ionicons name={icon} size={14} color={accent} />
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.clipLabel, { fontFamily: theme.mediumFont }]}>
          {label}
        </Text>
      </View>
      {videoUri ? (
        <View style={styles.clipControls}>
          <Pressable
            style={styles.play}
            onPress={() => {
              if (playing) void videoRef.current?.pauseAsync()
              else void videoRef.current?.playAsync()
            }}
          >
            <Ionicons name={playing ? 'pause' : 'play'} size={14} color="#FFFFFF" />
          </Pressable>
          <Text allowFontScaling={false} style={[styles.time, { fontFamily: theme.mediumFont }]}>
            {clock(position)}/{clock(duration)}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  back: { padding: 4, marginTop: 2 },
  titleCopy: { flex: 1, alignItems: 'center', paddingRight: 28 },
  title: { color: '#FFFFFF', fontSize: 22, textAlign: 'center' },
  subtitle: { color: '#3DB7FF', fontSize: 14, textAlign: 'center', marginTop: 2 },
  mediaRow: { flexDirection: 'row', gap: 10 },
  clip: {
    flex: 1,
    height: 230,
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: '#020814',
  },
  clipMedia: { width: '100%', height: '100%' },
  clipEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 10, gap: 8 },
  clipEmptyText: { color: '#86A7D2', fontSize: 11, textAlign: 'center', lineHeight: 15 },
  clipBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clipLabel: { color: '#FFFFFF', fontSize: 12, flexShrink: 1 },
  clipControls: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  play: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6, 16, 40, 0.72)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.92)',
  },
  time: { color: '#FFFFFF', fontSize: 11 },
  card: {
    borderRadius: 16,
    backgroundColor: '#071428',
    borderWidth: 1,
    borderColor: 'rgba(46, 130, 230, 0.35)',
    padding: 12,
    gap: 12,
  },
  cardTitle: { color: '#FFFFFF', fontSize: 16 },
  empty: { color: '#86A7D2', fontSize: 13, lineHeight: 18 },
  diff: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  diffIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  diffCopy: { flex: 1, gap: 2 },
  diffTitle: { color: '#FFFFFF', fontSize: 14 },
  diffBody: { color: '#9BB4D6', fontSize: 12, lineHeight: 16 },
  diffValue: { color: '#FF5A6A', fontSize: 16 },
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
})
