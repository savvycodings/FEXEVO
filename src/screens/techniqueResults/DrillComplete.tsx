import { useContext } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext } from '../../context'
import { CARD_GLOW, GlowButton, UI } from '../../components/ui'
import Svg, { Path } from 'react-native-svg'
import { stepText, stepTitle, type Drill } from '../../lib/drillsApi'
import { LEVEL_TONE } from './DrillDetail'
import { BackArrowIcon } from './BackArrowIcon'

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
        <BackArrowIcon />
      </Pressable>

      <View style={styles.badge}>
        <Svg width={63} height={48} viewBox="0 0 63 48" fill="none">
          <Path d="M1.5 27.1771L20.1105 45.5179L61.0536 1.5" stroke="#00B8FF" strokeWidth={3} strokeLinecap="round" />
        </Svg>
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
          icon={<StepsIcon />}
          value={`${steps} / ${steps}`}
          label={t('analysis.drills.complete.steps')}
        />
        <Stat
          icon={<ClockIcon />}
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
              {stepTitle(step) ?? stepText(step)}
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

/** Design "Steps Completed" icon (target with arrow). */
function StepsIcon({ size = 28, color = UI.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        fill={color}
        d="M14.8055 2.21322L13.1605 3.82089V6.83952H16.1791L17.7868 5.19447H16.0393C15.3579 5.19447 14.8055 4.64207 14.8055 3.96067V2.21322ZM14.3544 0.353865C15.1357 -0.409625 16.4506 0.143891 16.4506 1.23626V3.54941H18.7637C19.8561 3.54941 20.4097 4.8643 19.6461 5.64554L17.2346 8.11316C17.0025 8.3507 16.6843 8.48461 16.3522 8.48461H12.7492C12.7262 8.48461 12.7032 8.48395 12.6805 8.48272L10.452 10.7113C10.1308 11.0325 9.60993 11.0325 9.28874 10.7113C8.96754 10.39 8.96754 9.86925 9.28874 9.54806L11.5173 7.31947C11.5161 7.29673 11.5154 7.27383 11.5154 7.25079V3.64776C11.5154 3.31562 11.6493 2.99751 11.8869 2.76537L14.3544 0.353865ZM9.87035 1.90435C5.32764 1.90435 1.64506 5.58694 1.64506 10.1297C1.64506 14.6723 5.32764 18.3549 9.87035 18.3549C14.413 18.3549 18.0956 14.6723 18.0956 10.1297C18.0956 9.67538 18.4639 9.30714 18.9182 9.30714C19.3724 9.30714 19.7407 9.67538 19.7407 10.1297C19.7407 15.5809 15.3216 20 9.87035 20C4.4191 20 0 15.5809 0 10.1297C0 4.6784 4.4191 0.259299 9.87035 0.259299C10.3246 0.259299 10.6929 0.627553 10.6929 1.08183C10.6929 1.53609 10.3246 1.90435 9.87035 1.90435ZM9.87035 5.19447C7.14473 5.19447 4.93517 7.40402 4.93517 10.1297C4.93517 12.8553 7.14473 15.0648 9.87035 15.0648C12.596 15.0648 14.8055 12.8553 14.8055 10.1297C14.8055 9.67538 15.1738 9.30714 15.628 9.30714C16.0823 9.30714 16.4506 9.67538 16.4506 10.1297C16.4506 13.7638 13.5045 16.7099 9.87035 16.7099C6.23618 16.7099 3.29012 13.7638 3.29012 10.1297C3.29012 6.49548 6.23618 3.54941 9.87035 3.54941C10.3246 3.54941 10.6929 3.91766 10.6929 4.37194C10.6929 4.8262 10.3246 5.19447 9.87035 5.19447Z"
      />
    </Svg>
  )
}

/** Design "Total Time" clock icon. */
function ClockIcon({ size = 28, color = UI.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        fill={color}
        d="M13.5631 11.7659L10.7746 9.67449V5.41426C10.7746 4.9859 10.4283 4.63965 9.99996 4.63965C9.5716 4.63965 9.22535 4.9859 9.22535 5.41426V10.0618C9.22535 10.3058 9.34 10.5359 9.5352 10.6815L12.6336 13.0053C12.773 13.1099 12.9357 13.1602 13.0975 13.1602C13.3338 13.1602 13.5662 13.0541 13.718 12.8496C13.9752 12.508 13.9055 12.0223 13.5631 11.7659Z"
      />
      <Path
        fill={color}
        d="M10 0C4.48566 0 0 4.48566 0 10C0 15.5143 4.48566 20 10 20C15.5143 20 20 15.5143 20 10C20 4.48566 15.5143 0 10 0ZM10 18.4508C5.34082 18.4508 1.54918 14.6592 1.54918 10C1.54918 5.34082 5.34082 1.54918 10 1.54918C14.66 1.54918 18.4508 5.34082 18.4508 10C18.4508 14.6592 14.6592 18.4508 10 18.4508Z"
      />
    </Svg>
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
    borderWidth: 2,
    borderColor: '#00B8FF',
    backgroundColor: '#030A17',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 0px 20px 0px #0048FF, 0px 0px 20px 0px #0048FF inset',
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
