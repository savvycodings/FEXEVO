import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { LinearGradient } from 'expo-linear-gradient'
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av'
import { ThemeContext } from '../../context'
import { GlowButton, UI } from '../../components/ui'
import { useContactJoints, type ContactJoint } from '../../lib/jointsApi'
import { getThumbnailAsync } from '../../lib/videoThumbnails'

type Row = {
  id: string
  title: string
  /** Shown in place of the numbers when there is no pro value to compare against. */
  body: string
  you: string | null
  pro: string | null
  diff: number | null
  unit: string
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
  /** Row chevrons open the shot in Smart 3D. */
  onSmart3d: () => void
  /** "Drill exercises". Hidden when unset. */
  onDrills?: () => void
  /** For the server's per-joint you / pro readings. */
  analysisId?: string | null
  /** Contact time in the clip, for the row thumbnails. */
  contactMs?: number | null
}

const YOU = '#E5352B'
const PRO = '#5BE3C8'
const OFF = '#FF7A6B'
const GOOD = '#34C759'
const PRO_VALUE = '#7BE495'
/** Badge colours by how far off the pro: same scale as Biggest Mistakes. */
const BADGE = { high: '#E5482B', medium: '#E8A928', ok: '#34C759', none: UI.accentStrong }
/** Joints in the order the rows list them; titles match Biggest Mistakes where there is one. */
const JOINT_ROWS: { id: ContactJoint; titleKey: string }[] = [
  { id: 'elbow', titleKey: 'analysis.mistakeElbow' },
  { id: 'wrist', titleKey: 'analysis.mistakeWrist' },
  { id: 'torso', titleKey: 'analysis.viewAnglesPage.reading.torso' },
  { id: 'shoulder', titleKey: 'analysis.viewAnglesPage.reading.shoulder' },
  { id: 'knee', titleKey: 'analysis.mistakeKnee' },
]

function badgeColor(diff: number | null) {
  if (diff == null) return BADGE.none
  const d = Math.abs(diff)
  return d >= 15 ? BADGE.high : d > 5 ? BADGE.medium : BADGE.ok
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
  onDrills,
  analysisId = null,
  contactMs = null,
}: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const contact = useContactJoints(analysisId)
  const [thumb, setThumb] = useState<string | null>(null)

  useEffect(() => {
    if (!videoUri) return
    let cancelled = false
    getThumbnailAsync(videoUri, { time: Math.max(0, Math.round(contactMs ?? 0)), quality: 0.5 })
      .then(({ uri }) => {
        if (!cancelled) setThumb(uri)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [videoUri, contactMs])

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [onClose])

  const rows = useMemo(() => {
    const deg = (v: number) => `${Math.round(v)}°`
    const fin = (v: number | null | undefined): v is number => v != null && Number.isFinite(v)
    // Server readings first: they carry the pro's angle at contact.
    const served: Row[] = []
    for (const j of JOINT_ROWS) {
      const r = contact?.joints[j.id]
      if (!r || !fin(r.you) || !fin(r.pro)) continue
      served.push({
        id: j.id,
        title: t(j.titleKey),
        body: '',
        you: deg(r.you),
        pro: deg(r.pro),
        diff: fin(r.deltaDeg) ? r.deltaDeg : r.you - r.pro,
        unit: '°',
      })
    }
    if (served.length) return served.sort((a, b) => Math.abs(b.diff ?? 0) - Math.abs(a.diff ?? 0)).slice(0, 4)

    // Otherwise what biomechanics measured; only the elbow has a pro delta there.
    const next: Row[] = []
    if (fin(elbowDeg)) {
      const delta = fin(elbowDeltaDeg) ? elbowDeltaDeg : null
      next.push({
        id: 'elbow',
        title: t('analysis.mistakeElbow'),
        body: t('analysis.compareElbowBody'),
        you: deg(elbowDeg),
        pro: delta != null ? deg(elbowDeg - delta) : null,
        diff: delta,
        unit: '°',
      })
    }
    const racket = racketError(errors)
    if (racket) {
      next.push({ id: 'racket', title: t('analysis.mistakeRacket'), body: racket, you: null, pro: null, diff: null, unit: '' })
    }
    if (fin(torsoDeg)) {
      next.push({
        id: 'torso',
        title: t('analysis.mistakeTorso'),
        body: t('analysis.compareTorsoBody'),
        you: `${signed(torsoDeg)}°`,
        pro: null,
        diff: null,
        unit: '°',
      })
    }
    if (fin(power)) {
      next.push({
        id: 'power',
        title: t('analysis.comparePower'),
        body: t('analysis.comparePowerBody'),
        you: String(Math.round(power)),
        pro: null,
        diff: null,
        unit: '',
      })
    }
    if (fin(wristBodyPerS) && wristBodyPerS > 0) {
      next.push({
        id: 'wrist',
        title: t('analysis.compareWrist'),
        body: t('analysis.compareWristBody'),
        you: wristBodyPerS.toFixed(1),
        pro: null,
        diff: null,
        unit: '',
      })
    }
    return next
  }, [contact, elbowDeg, elbowDeltaDeg, errors, power, t, torsoDeg, wristBodyPerS])

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
          <Ionicons name="chevron-back" size={28} color="#86A7D2" />
        </Pressable>
        <View style={styles.titleCopy}>
          <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.boldFont ?? theme.semiBoldFont }]}>
            {t('analysis.compareWithPro')}
          </Text>
          <Text allowFontScaling={false} style={[styles.subtitle, { fontFamily: theme.regularFont }]}>
            <Text style={{ color: UI.accent }}>{t('analysis.compareSubtitleYou')}</Text>
            {t('analysis.compareSubtitlePro')}
          </Text>
        </View>
      </View>

      <View style={styles.mediaRow}>
        <ClipCard label={t('analysis.yourShot')} kind="you" accent={YOU} videoUri={videoUri} />
        <ClipCard
          label={t('analysis.proReference')}
          kind="pro"
          accent={PRO}
          videoUri={referenceVideoUri}
          image={referenceImage}
          emptyLabel={t('analysis.compareProEmpty')}
        />
      </View>

      {rows.length === 0 ? (
        <Text allowFontScaling={false} style={[styles.empty, { fontFamily: theme.regularFont }]}>
          {t('analysis.compareEmpty')}
        </Text>
      ) : (
        rows.map((row, i) => (
          <Pressable
            key={row.id}
            testID={`compare-row-${row.id}`}
            accessibilityRole="button"
            onPress={onSmart3d}
            style={styles.row}
          >
            <View style={[styles.rowBadge, { backgroundColor: badgeColor(row.diff) }]}>
              <Text allowFontScaling={false} style={[styles.rowBadgeNum, { fontFamily: theme.mediumFont }]}>
                {i + 1}
              </Text>
            </View>
            <View style={styles.rowThumb}>
              {thumb ? <Image source={{ uri: thumb }} style={styles.rowThumbImg} resizeMode="cover" /> : null}
            </View>
            <View style={styles.rowCopy}>
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.rowTitle, { fontFamily: theme.regularFont }]}>
                {row.title}
              </Text>
              {row.you ? (
                <View style={styles.rowValues}>
                  <Text allowFontScaling={false} // Red only means something next to a pro value.
                    style={[styles.rowValue, { color: row.pro ? OFF : UI.text, fontFamily: theme.regularFont }]}>
                    {row.you}
                  </Text>
                  {row.pro ? (
                    <Text allowFontScaling={false} style={[styles.rowValue, { color: PRO_VALUE, fontFamily: theme.regularFont }]}>
                      {row.pro}
                    </Text>
                  ) : null}
                  {row.diff != null ? (
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.rowValue,
                        { color: Math.abs(row.diff) > 5 ? OFF : GOOD, fontFamily: theme.regularFont },
                      ]}
                    >
                      {`${signed(row.diff)}${row.unit}`}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {!row.pro && row.body ? (
                <Text allowFontScaling={false} numberOfLines={2} style={[styles.rowBody, { fontFamily: theme.regularFont }]}>
                  {row.body}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))
      )}

      {onDrills ? (
        <GlowButton label={t('analysis.compareDrills')} onPress={onDrills} testID="compare-drills" arrow />
      ) : null}
    </ScrollView>
  )
}

const HEADER_H = 50
const KNOB = 16

function ClipCard({
  label,
  kind,
  accent,
  videoUri,
  image,
  emptyLabel,
}: {
  label: string
  kind: 'you' | 'pro'
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
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [trackW, setTrackW] = useState(0)
  // A clip that can't load (e.g. its file is gone) falls back to the image or the empty state.
  const [failedUri, setFailedUri] = useState<string | null>(null)
  const playable = videoUri && videoUri !== failedUri ? videoUri : null
  const progress = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0

  // Clip pixel size, so the frame can be cover-cropped by hand (expo-av's cover doesn't fill on web).
  useEffect(() => {
    if (!playable) return
    let cancelled = false
    getThumbnailAsync(playable, { time: 0, quality: 0.3 })
      .then(({ width, height }) => {
        if (!cancelled && width > 0 && height > 0) setNatural({ w: width, h: height })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [playable])

  const cover = useMemo(() => {
    if (!box || !natural) return null
    const scale = Math.max(box.w / natural.w, box.h / natural.h)
    const w = natural.w * scale
    const h = natural.h * scale
    return { left: (box.w - w) / 2, top: (box.h - h) / 2, width: w, height: h }
  }, [box, natural])

  function onStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) return
    setPosition(status.positionMillis)
    setDuration(status.durationMillis ?? 0)
    setPlaying(status.isPlaying)
  }

  function seek(x: number) {
    if (duration <= 0 || trackW <= 0 || !Number.isFinite(x)) return
    const ms = Math.max(0, Math.min(duration, (x / trackW) * duration))
    setPosition(ms)
    void videoRef.current?.setPositionAsync(ms)
  }

  return (
    <View testID={`compare-clip-${kind}`} style={[styles.clip, { borderColor: accent }]}>
      <View style={[styles.clipHeader, { borderBottomColor: accent }]}>
        <View style={[styles.clipIcon, { backgroundColor: kind === 'you' ? OFF : PRO }]}>
          {kind === 'you' ? (
            <MaterialCommunityIcons name="human-male" size={18} color={UI.text} />
          ) : (
            <MaterialCommunityIcons name="crown" size={16} color={UI.cardBg} />
          )}
        </View>
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.clipLabel, { fontFamily: theme.regularFont }]}>
          {label}
        </Text>
      </View>
      <View style={styles.clipBody} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {playable ? (
          <Video
            ref={videoRef}
            source={{ uri: playable }}
            style={cover ? { position: 'absolute', ...cover } : StyleSheet.absoluteFill}
            resizeMode={cover ? ResizeMode.STRETCH : ResizeMode.COVER}
            isMuted
            onPlaybackStatusUpdate={onStatus}
            onError={() => setFailedUri(playable)}
          />
        ) : image ? (
          <Image source={image} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={styles.clipEmpty}>
            <Ionicons name="body" size={28} color={UI.accent} />
            {emptyLabel ? (
              <Text allowFontScaling={false} style={[styles.clipEmptyText, { fontFamily: theme.regularFont }]}>
                {emptyLabel}
              </Text>
            ) : null}
          </View>
        )}
        {playable ? (
          <LinearGradient
            pointerEvents="box-none"
            colors={['rgba(20, 60, 200, 0)', 'rgba(20, 60, 200, 0.85)']}
            locations={[0, 0.35]}
            style={styles.clipControls}
          >
            <View style={styles.playRow}>
              <Pressable
                style={styles.play}
                accessibilityRole="button"
                onPress={() => {
                  if (playing) void videoRef.current?.pauseAsync()
                  else void videoRef.current?.playAsync()
                }}
              >
                <Ionicons name={playing ? 'pause' : 'play'} size={18} color={UI.text} style={playing ? null : styles.playIcon} />
              </Pressable>
              <Text allowFontScaling={false} style={[styles.time, { fontFamily: theme.mediumFont }]}>
                {clock(position)}/{clock(duration)}
              </Text>
            </View>
            <View style={styles.trackHit} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
              <View style={styles.track}>
                <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
              </View>
              <View style={[styles.knob, { left: progress * Math.max(0, trackW - KNOB) }]} />
              <Pressable
                style={StyleSheet.absoluteFill}
                // Web clicks carry offsetX, not locationX.
                onPress={(e) => seek(e.nativeEvent.locationX ?? (e.nativeEvent as { offsetX?: number }).offsetX ?? NaN)}
              />
            </View>
          </LinearGradient>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  back: { padding: 2, marginTop: 4 },
  titleCopy: { flex: 1, gap: 2 },
  title: { color: UI.text, fontSize: 24 },
  subtitle: { color: UI.text, fontSize: 14 },
  mediaRow: { flexDirection: 'row', gap: 8 },
  clip: {
    flex: 1,
    /** Design card is 380 × 610. */
    aspectRatio: 0.62,
    borderRadius: UI.radiusCard,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: UI.pageBg,
  },
  clipHeader: {
    height: HEADER_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 2,
  },
  clipIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  clipLabel: { color: UI.text, fontSize: 13, flexShrink: 1 },
  clipBody: { flex: 1, overflow: 'hidden', backgroundColor: '#000' },
  clipEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 10, gap: 8, backgroundColor: UI.cardBg },
  clipEmptyText: { color: UI.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 15 },
  clipControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingTop: 24,
    paddingBottom: 8,
    gap: 6,
  },
  playRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: UI.text,
  },
  playIcon: { marginLeft: 2 },
  time: { color: UI.text, fontSize: 13 },
  trackHit: { height: 20, justifyContent: 'center' },
  track: { height: 5, borderRadius: 3, backgroundColor: UI.accentStrong, overflow: 'hidden' },
  trackFill: { height: 5, backgroundColor: UI.text },
  knob: {
    position: 'absolute',
    top: '50%',
    marginTop: -KNOB / 2,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: UI.text,
  },
  empty: { color: UI.textMuted, fontSize: 13, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: UI.radiusCard,
    borderWidth: 2,
    borderColor: '#1F3FC0',
    backgroundColor: '#050B1F',
    paddingHorizontal: 12,
    paddingVertical: 8,
    boxShadow: 'inset 0px 0px 14px rgba(47, 107, 255, 0.35)',
  },
  rowBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowBadgeNum: { color: UI.text, fontSize: 17 },
  rowThumb: { width: 64, height: 60, borderRadius: 10, overflow: 'hidden', backgroundColor: UI.surface },
  rowThumbImg: { width: '100%', height: '100%' },
  rowCopy: { flex: 1, gap: 0 },
  rowTitle: { color: UI.text, fontSize: 16 },
  rowValues: { flexDirection: 'row', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' },
  rowValue: { fontSize: 24, lineHeight: 30 },
  rowBody: { color: UI.textMuted, fontSize: 12, lineHeight: 16 },
})
