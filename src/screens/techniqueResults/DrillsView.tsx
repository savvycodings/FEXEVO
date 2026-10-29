import { useContext, useEffect, useState } from 'react'
import { ActivityIndicator, BackHandler, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { LinearGradient } from 'expo-linear-gradient'
import { ThemeContext } from '../../context'
import { CARD_GLOW, GlowButton, UI } from '../../components/ui'
import { useDrills, type Drill, type DrillFocus, type DrillLevel } from '../../lib/drillsApi'
import { getThumbnailAsync } from '../../lib/videoThumbnails'

type Props = {
  videoUri: string | null
  shotLabel: string | null
  /** Most important first; the first two name the screen's focus line. */
  focus: DrillFocus[]
  /** Time of contact in the clip, for the card thumbnails. */
  thumbTimeMs: number
  onClose: () => void
}

const BODY_ART = require('../../../assets/smart3d/body.webp')
const LEVEL_TONE: Record<DrillLevel, { bg: string; fg: string }> = {
  beginner: { bg: 'rgba(52, 199, 89, 0.16)', fg: '#5BE38A' },
  intermediate: { bg: 'rgba(52, 199, 89, 0.16)', fg: '#5BE38A' },
  advanced: { bg: 'rgba(245, 160, 51, 0.16)', fg: '#F5A033' },
}

/** Suggested drills for this shot, from the backend catalogue. A card opens its steps. */
export function DrillsView({ videoUri, shotLabel, focus, thumbTimeMs, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const drills = useDrills(focus, shotLabel, i18n.language)
  const [thumb, setThumb] = useState<string | null>(null)
  const [open, setOpen] = useState<Drill | null>(null)

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (open) setOpen(null)
      else onClose()
      return true
    })
    return () => sub.remove()
  }, [onClose, open])

  useEffect(() => {
    if (!videoUri) return
    let cancelled = false
    getThumbnailAsync(videoUri, { time: Math.max(0, Math.round(thumbTimeMs)), quality: 0.6 })
      .then(({ uri }) => {
        if (!cancelled) setThumb(uri)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [videoUri, thumbTimeMs])

  const focusLine = focus
    .slice(0, 2)
    .map((f) => t(`analysis.drills.focus.${f}`))
    .join(' & ')

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: 96 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('analysis.back')}
        hitSlop={12}
        onPress={onClose}
        style={styles.back}
        testID="drills-back"
      >
        <Ionicons name="chevron-back" size={30} color="#86A7D2" />
      </Pressable>

      <View style={styles.shotRow}>
        <View style={[styles.shotRing, CARD_GLOW]}>
          <View style={styles.shotDisc}>
            <Image source={BODY_ART} style={styles.shotArt} resizeMode="cover" />
          </View>
        </View>
        <View style={styles.shotCopy}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.shotTitle, { fontFamily: theme.regularFont }]}>
            {shotLabel || t('analysis.drills.shotFallback')}
          </Text>
          {focusLine ? (
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.shotSub, { fontFamily: theme.regularFont }]}>
              {focusLine}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.heading}>
        <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.regularFont }]}>
          {t('analysis.drills.title')}
        </Text>
        <Text allowFontScaling={false} style={[styles.subtitle, { fontFamily: theme.regularFont }]}>
          {t('analysis.drills.subtitle')}
        </Text>
      </View>

      {drills.status === 'loading' && drills.drills.length === 0 ? (
        <ActivityIndicator color={UI.accent} style={styles.loading} />
      ) : drills.status === 'error' || drills.drills.length === 0 ? (
        <Text allowFontScaling={false} style={[styles.empty, { fontFamily: theme.regularFont }]}>
          {t(drills.status === 'error' ? 'analysis.drills.error' : 'analysis.drills.empty')}
        </Text>
      ) : (
        drills.drills.map((drill) => (
          <DrillCard key={drill.slug} drill={drill} thumb={thumb} onPress={() => setOpen(drill)} />
        ))
      )}

      <DrillSheet drill={open} onClose={() => setOpen(null)} />
    </ScrollView>
  )
}

function DrillCard({ drill, thumb, onPress }: { drill: Drill; thumb: string | null; onPress: () => void }) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const tone = LEVEL_TONE[drill.level] ?? LEVEL_TONE.beginner
  return (
    <Pressable
      testID={`drill-${drill.slug}`}
      accessibilityRole="button"
      accessibilityLabel={drill.title}
      onPress={onPress}
      style={[styles.card, CARD_GLOW]}
    >
      <View style={styles.cardThumb}>
        {thumb ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        <View style={styles.cardPlay}>
          <Ionicons name="play" size={30} color={UI.text} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardHead}>
          <Text allowFontScaling={false} numberOfLines={2} style={[styles.cardTitle, { fontFamily: theme.regularFont }]}>
            {drill.title}
          </Text>
          <View style={[styles.level, { backgroundColor: tone.bg }]}>
            <Text allowFontScaling={false} style={[styles.levelText, { color: tone.fg, fontFamily: theme.regularFont }]}>
              {t(`analysis.drills.level.${drill.level}`)}
            </Text>
          </View>
        </View>
        <Text allowFontScaling={false} numberOfLines={3} style={[styles.cardSummary, { fontFamily: theme.regularFont }]}>
          {drill.summary}
        </Text>
        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="bullseye-arrow" size={16} color={UI.textMuted} />
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.metaText, { fontFamily: theme.regularFont }]}>
              {drill.focusLabel}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={16} color={UI.textMuted} />
            <Text allowFontScaling={false} style={[styles.metaText, { fontFamily: theme.regularFont }]}>
              {t('analysis.drills.minutes', { count: drill.minutes })}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  )
}

function DrillSheet({ drill, onClose }: { drill: Drill | null; onClose: () => void }) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const tone = drill ? (LEVEL_TONE[drill.level] ?? LEVEL_TONE.beginner) : LEVEL_TONE.beginner
  return (
    <Modal visible={!!drill} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetScrim} onPress={onClose} accessibilityLabel={t('analysis.drills.close')} />
      {drill ? (
        <LinearGradient
          colors={['#0B1F57', UI.cardBg]}
          style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}
          testID="drill-sheet"
        >
          <View style={styles.sheetGrip} />
          <Text allowFontScaling={false} style={[styles.sheetTitle, { fontFamily: theme.mediumFont }]}>
            {drill.title}
          </Text>
          <View style={styles.sheetMeta}>
            <View style={[styles.level, { backgroundColor: tone.bg }]}>
              <Text allowFontScaling={false} style={[styles.levelText, { color: tone.fg, fontFamily: theme.regularFont }]}>
                {t(`analysis.drills.level.${drill.level}`)}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color={UI.textMuted} />
              <Text allowFontScaling={false} style={[styles.metaText, { fontFamily: theme.regularFont }]}>
                {t('analysis.drills.minutes', { count: drill.minutes })}
              </Text>
            </View>
          </View>
          <Text allowFontScaling={false} style={[styles.sheetSummary, { fontFamily: theme.regularFont }]}>
            {drill.summary}
          </Text>
          <Text allowFontScaling={false} style={[styles.sheetHeading, { fontFamily: theme.mediumFont }]}>
            {t('analysis.drills.steps')}
          </Text>
          {drill.steps.map((step, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepNum}>
                <Text allowFontScaling={false} style={[styles.stepNumText, { fontFamily: theme.mediumFont }]}>
                  {i + 1}
                </Text>
              </View>
              <Text allowFontScaling={false} style={[styles.stepText, { fontFamily: theme.regularFont }]}>
                {step}
              </Text>
            </View>
          ))}
          <GlowButton label={t('analysis.drills.close')} onPress={onClose} testID="drill-sheet-close" style={styles.sheetClose} />
        </LinearGradient>
      ) : null}
    </Modal>
  )
}

const RING = 72

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 14 },
  back: { alignSelf: 'flex-start', padding: 2 },
  shotRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  shotRing: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2,
    borderColor: UI.accentStrong,
    padding: 5,
  },
  shotDisc: { flex: 1, borderRadius: RING, overflow: 'hidden', backgroundColor: UI.surface },
  shotArt: { position: 'absolute', width: RING * 2.6, height: RING * 2.6 * (844 / 1024), left: -RING * 0.95, top: -RING * 0.25 },
  shotCopy: { flex: 1, gap: 2 },
  shotTitle: { color: UI.text, fontSize: 20 },
  shotSub: { color: UI.accent, fontSize: 14 },
  heading: { gap: 4 },
  title: { color: UI.text, fontSize: 20 },
  subtitle: { color: UI.text, fontSize: 13, opacity: 0.85 },
  loading: { marginTop: 24 },
  empty: { color: UI.textMuted, fontSize: 14, lineHeight: 20, marginTop: 8 },
  card: {
    flexDirection: 'row',
    minHeight: 104,
    borderRadius: UI.radiusCard,
    borderWidth: 1.5,
    borderColor: UI.accentStrong,
    backgroundColor: UI.cardBg,
    overflow: 'hidden',
  },
  cardThumb: { width: '34%', backgroundColor: UI.surface, alignItems: 'center', justifyContent: 'center' },
  cardPlay: { opacity: 0.95 },
  cardBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  cardTitle: { flex: 1, color: UI.accent, fontSize: 15, lineHeight: 19 },
  level: { borderRadius: UI.radiusPill, paddingHorizontal: 8, paddingVertical: 3 },
  levelText: { fontSize: 11 },
  cardSummary: { color: UI.text, fontSize: 12, lineHeight: 16 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  metaText: { color: UI.textMuted, fontSize: 12, flexShrink: 1 },
  sheetScrim: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: UI.trackBorder,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 10,
  },
  sheetGrip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: UI.surfaceBorder, marginBottom: 6 },
  sheetTitle: { color: UI.text, fontSize: 20 },
  sheetMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetSummary: { color: UI.textMuted, fontSize: 14, lineHeight: 20 },
  sheetHeading: { color: UI.text, fontSize: 15, marginTop: 4 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: UI.surface,
    borderWidth: 1,
    borderColor: UI.accentStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { color: UI.text, fontSize: 12 },
  stepText: { flex: 1, color: UI.text, fontSize: 14, lineHeight: 20 },
  sheetClose: { marginTop: 8 },
})
