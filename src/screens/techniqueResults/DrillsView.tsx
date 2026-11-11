import { useContext, useEffect, useState } from 'react'
import { ActivityIndicator, BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { ThemeContext } from '../../context'
import { CARD_GLOW, UI } from '../../components/ui'
import { useDrills, type Drill, type DrillFocus } from '../../lib/drillsApi'
import { getThumbnailAsync } from '../../lib/videoThumbnails'
import { DrillDetail, LEVEL_TONE } from './DrillDetail'
import { DrillStep, type DrillKeyPoint } from './DrillStep'
import { DrillComplete } from './DrillComplete'

/** Where the user is inside the drills flow. Kept by the parent so a trip to Smart 3D comes back here. */
export type DrillNav = { slug: string; page: 'detail' | 'done' | number } | null

type Props = {
  videoUri: string | null
  shotLabel: string | null
  /** Most important first; the first two name the screen's focus line. */
  focus: DrillFocus[]
  /** Time of contact in the clip, for the card thumbnails. */
  thumbTimeMs: number
  /** Pro clip for this shot, for "Your Movement vs Pro Reference" on a step. */
  proVideoUri?: string | null
  /** This shot's mistakes as tips: the Key Points on a step. */
  keyPoints?: DrillKeyPoint[]
  nav: DrillNav
  onNav: (nav: DrillNav) => void
  /** Opens Smart 3D from a step's "3D View" tab. */
  onSmart3d?: () => void
  onClose: () => void
}

const BODY_ART = require('../../../assets/smart3d/body.webp')

/** Suggested drills for this shot, from the backend catalogue. A card opens the drill, then its steps. */
export function DrillsView({
  videoUri,
  shotLabel,
  focus,
  thumbTimeMs,
  proVideoUri = null,
  keyPoints = [],
  nav,
  onNav,
  onSmart3d,
  onClose,
}: Props) {
  const { t, i18n } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const drills = useDrills(focus, shotLabel, i18n.language)
  const [thumb, setThumb] = useState<string | null>(null)
  const open = nav ? (drills.drills.find((d) => d.slug === nav.slug) ?? null) : null
  const page = open && nav ? nav.page : null
  const setOpen = (drill: Drill | null) => onNav(drill ? { slug: drill.slug, page: 'detail' } : null)

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!open) onClose()
      else if (typeof page === 'number') onNav(page === 0 ? { slug: open.slug, page: 'detail' } : { slug: open.slug, page: page - 1 })
      else onNav(null)
      return true
    })
    return () => sub.remove()
  }, [onClose, onNav, open, page])

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

  if (open && typeof page === 'number') {
    const index = Math.min(Math.max(0, page), Math.max(0, open.steps.length - 1))
    return (
      <DrillStep
        // A fresh page per step, so Next / Previous open it at the top.
        key={`${open.slug}-${index}`}
        drill={open}
        index={index}
        videoUri={videoUri}
        proVideoUri={proVideoUri}
        keyPoints={keyPoints}
        onBack={() => onNav({ slug: open.slug, page: 'detail' })}
        onGoTo={(i) => onNav({ slug: open.slug, page: i })}
        onFinish={() => onNav({ slug: open.slug, page: 'done' })}
        onSmart3d={onSmart3d}
      />
    )
  }

  if (open && page === 'done') {
    return (
      <DrillComplete
        drill={open}
        others={drills.drills.filter((d) => d.slug !== open.slug)}
        onAgain={() => onNav({ slug: open.slug, page: 0 })}
        onOpenDrill={(d) => setOpen(d)}
        onClose={() => onNav(null)}
      />
    )
  }

  if (open) {
    return (
      <DrillDetail
        drill={open}
        videoUri={videoUri}
        thumb={thumb}
        shotLabel={shotLabel}
        focusLine={focusLine}
        onOpenStep={(i) => onNav({ slug: open.slug, page: i })}
        onClose={() => setOpen(null)}
      />
    )
  }

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
})
