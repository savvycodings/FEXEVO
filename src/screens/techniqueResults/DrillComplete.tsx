import { useContext } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { ThemeContext } from '../../context'
import { CARD_GLOW, GlowButton, UI } from '../../components/ui'
import type { Drill } from '../../lib/drillsApi'
import { LEVEL_TONE } from './DrillDetail'

type Props = {
  drill: Drill
  /** The other suggested drills for this shot, for "Next Steps". */
  others: Drill[]
  onAgain: () => void
  onOpenDrill: (drill: Drill) => void
  onClose: () => void
}

const GREEN = '#5BE38A'
const BLUE = '#1F4BFF'

/** Shown after the last step of a drill. */
export function DrillComplete({ drill, others, onAgain, onOpenDrill, onClose }: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const steps = drill.steps.length

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: 96 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
      testID="drill-complete"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('analysis.back')}
        hitSlop={12}
        onPress={onClose}
        style={styles.back}
        testID="drill-complete-back"
      >
        <Ionicons name="chevron-back" size={30} color="#86A7D2" />
      </Pressable>

      <View style={styles.badge}>
        <Ionicons name="checkmark" size={84} color="#4DB8FF" />
      </View>

      <View style={styles.hero}>
        <Text allowFontScaling={false} style={[styles.heroTitle, { fontFamily: theme.boldFont ?? theme.semiBoldFont }]}>
          {t('analysis.drills.complete.title')}
        </Text>
        <Text allowFontScaling={false} style={[styles.heroSub, { fontFamily: theme.regularFont }]}>
          {t('analysis.drills.complete.subtitle')}
        </Text>
        <Text allowFontScaling={false} style={[styles.heroDrill, { fontFamily: theme.regularFont }]}>
          {drill.title}
        </Text>
      </View>

      <View style={styles.stats}>
        <Stat
          icon={<MaterialCommunityIcons name="bullseye-arrow" size={28} color={UI.text} />}
          value={`${steps} / ${steps}`}
          label={t('analysis.drills.complete.steps')}
        />
        <Stat
          icon={<Ionicons name="time-outline" size={28} color={UI.text} />}
          value={t('analysis.drills.minutes', { count: drill.minutes })}
          label={t('analysis.drills.complete.time')}
        />
        <Stat
          icon={<Ionicons name="checkmark-circle-outline" size={28} color={UI.text} />}
          value="100%"
          label={t('analysis.drills.complete.done')}
        />
      </View>

      <Text allowFontScaling={false} style={[styles.section, { fontFamily: theme.regularFont }]}>
        {t('analysis.drills.complete.improved')}
      </Text>
      <View style={styles.list}>
        {drill.steps.map((step, i) => (
          <View key={i} style={styles.listRow}>
            <View style={styles.check}>
              <Ionicons name="checkmark" size={18} color="#05210F" />
            </View>
            <Text allowFontScaling={false} style={[styles.listText, { fontFamily: theme.regularFont }]}>
              {step}
            </Text>
          </View>
        ))}
      </View>

      <GlowButton label={t('analysis.drills.complete.again')} onPress={onAgain} testID="drill-again" />

      {others.length ? (
        <>
          <Text allowFontScaling={false} style={[styles.section, { fontFamily: theme.regularFont }]}>
            {t('analysis.drills.complete.next')}
          </Text>
          {others.map((d) => {
            const tone = LEVEL_TONE[d.level] ?? LEVEL_TONE.beginner
            return (
              <Pressable
                key={d.slug}
                accessibilityRole="button"
                accessibilityLabel={d.title}
                onPress={() => onOpenDrill(d)}
                style={[styles.next, CARD_GLOW]}
                testID={`drill-next-${d.slug}`}
              >
                <View style={styles.nextCopy}>
                  <Text allowFontScaling={false} numberOfLines={1} style={[styles.nextTitle, { fontFamily: theme.regularFont }]}>
                    {d.title}
                  </Text>
                  <Text allowFontScaling={false} numberOfLines={2} style={[styles.nextSummary, { fontFamily: theme.regularFont }]}>
                    {d.summary}
                  </Text>
                </View>
                <View style={[styles.level, { backgroundColor: tone.bg }]}>
                  <Text allowFontScaling={false} style={[styles.levelText, { color: tone.fg, fontFamily: theme.regularFont }]}>
                    {t(`analysis.drills.level.${d.level}`)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="#86A7D2" />
              </Pressable>
            )
          })}
        </>
      ) : null}
    </ScrollView>
  )
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  const { theme } = useContext(ThemeContext)
  return (
    <View style={[styles.stat, CARD_GLOW]}>
      {icon}
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.statValue, { fontFamily: theme.regularFont }]}>
        {value}
      </Text>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[styles.statLabel, { fontFamily: theme.regularFont }]}
      >
        {label}
      </Text>
    </View>
  )
}

const BADGE = 180

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 18 },
  back: { alignSelf: 'flex-start', padding: 2 },
  badge: {
    alignSelf: 'center',
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderWidth: 3,
    borderColor: '#2F7BFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 0px 24px 4px #2F7BFF88, 0px 0px 24px 0px #2F7BFF55 inset',
  },
  hero: { alignItems: 'center', gap: 6 },
  heroTitle: { color: UI.text, fontSize: 30, textAlign: 'center' },
  heroSub: { color: UI.text, fontSize: 18, textAlign: 'center' },
  heroDrill: { color: '#4DB8FF', fontSize: 17, textAlign: 'center' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: BLUE,
    backgroundColor: '#041641',
  },
  statValue: { color: GREEN, fontSize: 18 },
  statLabel: { color: UI.text, fontSize: 12 },
  section: { color: UI.text, fontSize: 20, marginTop: 4 },
  list: { gap: 14 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  check: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#6EF0A0', alignItems: 'center', justifyContent: 'center' },
  listText: { flex: 1, color: UI.text, fontSize: 15, lineHeight: 20 },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: UI.radiusCard,
    borderWidth: 1.5,
    borderColor: UI.accentStrong,
    backgroundColor: UI.cardBg,
  },
  nextCopy: { flex: 1, gap: 2 },
  nextTitle: { color: UI.accent, fontSize: 16 },
  nextSummary: { color: UI.text, fontSize: 12, lineHeight: 16 },
  level: { borderRadius: UI.radiusPill, paddingHorizontal: 8, paddingVertical: 3 },
  levelText: { fontSize: 11 },
})
