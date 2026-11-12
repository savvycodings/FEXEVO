import { useContext, useRef } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { ThemeContext } from '../../context'
import { CARD_GLOW, GlowButton, SegmentedToggle, SurfaceButton, UI } from '../../components/ui'
import type { Drill, DrillFocus } from '../../lib/drillsApi'
import { DrillPlayer } from './DrillDetail'
import { ClipCard, PRO, YOU } from './CompareWithPro'

export type DrillKeyPoint = { focus: DrillFocus | null; text: string }

type Props = {
  drill: Drill
  index: number
  /** Player's analyzed clip (drills have no videos of their own yet). */
  videoUri: string | null
  /** Pro clip for the same shot, when the library has one. */
  proVideoUri: string | null
  /** This shot's mistakes as tips. The same list on every step until drills carry their own. */
  keyPoints: DrillKeyPoint[]
  onBack: () => void
  onGoTo: (index: number) => void
  /** After the last step. */
  onFinish: () => void
  onSmart3d?: () => void
}

const FOCUS_ICON: Record<DrillFocus, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  elbow: 'arm-flex-outline',
  racket: 'tennis',
  torso: 'human',
  foot: 'shoe-sneaker',
}
const DONE = '#4DB8FF'
const BLUE = '#1F4BFF'

type Tab = 'video' | 'keyPoints' | 'smart3d'

/** One drill step: progress dots, the clip, key points and you vs pro. Previous / Next walk the steps. */
export function DrillStep({ drill, index, videoUri, proVideoUri, keyPoints, onBack, onGoTo, onFinish, onSmart3d }: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)
  const sections = useRef<{ video: number; keyPoints: number }>({ video: 0, keyPoints: 0 })
  const total = drill.steps.length
  const last = index >= total - 1
  const clipUri = drill.videoUrl || videoUri

  const tabs = [
    { value: 'video' as const, label: t('analysis.drills.step.tabVideo'), testID: 'drill-step-tab-video' },
    ...(keyPoints.length
      ? [{ value: 'keyPoints' as const, label: t('analysis.drills.step.tabKeyPoints'), testID: 'drill-step-tab-key-points' }]
      : []),
    ...(onSmart3d ? [{ value: 'smart3d' as const, label: t('analysis.drills.step.tab3d'), testID: 'drill-step-tab-3d' }] : []),
  ]

  const onTab = (tab: Tab) => {
    if (tab === 'smart3d') return onSmart3d?.()
    scrollRef.current?.scrollTo({ y: Math.max(0, sections.current[tab] - 12), animated: true })
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: 96 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
      testID={`drill-step-page-${index + 1}`}
    >
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('analysis.back')}
          hitSlop={12}
          onPress={onBack}
          testID="drill-step-back"
        >
          <Ionicons name="chevron-back" size={30} color="#86A7D2" />
        </Pressable>
        <Stepper total={total} index={index} onGoTo={onGoTo} />
      </View>

      <View style={styles.head}>
        <View style={[styles.numRing, CARD_GLOW]}>
          <Text allowFontScaling={false} style={[styles.numText, { fontFamily: theme.regularFont }]}>
            {index + 1}
          </Text>
        </View>
        <View style={styles.headCopy}>
          <View style={styles.titleRow}>
            <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.regularFont }]}>
              {t('analysis.drills.detail.step', { n: index + 1 })}
            </Text>
            <Text allowFontScaling={false} style={[styles.of, { fontFamily: theme.regularFont }]}>
              {t('analysis.drills.step.of', { n: index + 1, total })}
            </Text>
          </View>
          <Text allowFontScaling={false} style={[styles.sub, { fontFamily: theme.regularFont }]}>
            {drill.steps[index]}
          </Text>
        </View>
      </View>

      {tabs.length > 1 ? (
        <SegmentedToggle<Tab> options={tabs} value="video" onChange={onTab} accessibilityLabel={drill.title} />
      ) : null}

      <View onLayout={(e) => (sections.current.video = e.nativeEvent.layout.y)}>
        {clipUri ? <DrillPlayer key={`${drill.slug}-${index}`} uri={clipUri} poster={null} /> : null}
      </View>

      {keyPoints.length ? (
        <View
          style={[styles.panel, CARD_GLOW]}
          onLayout={(e) => (sections.current.keyPoints = e.nativeEvent.layout.y)}
          testID="drill-step-key-points"
        >
          <Text allowFontScaling={false} style={[styles.panelTitle, { fontFamily: theme.regularFont }]}>
            {t('analysis.drills.step.keyPoints')}
          </Text>
          {keyPoints.map((kp, i) => (
            <View key={i} style={styles.kpRow}>
              <View style={[styles.kpIcon, CARD_GLOW]}>
                <MaterialCommunityIcons name={kp.focus ? FOCUS_ICON[kp.focus] : 'lightbulb-outline'} size={26} color="#4DB8FF" />
              </View>
              <View style={[styles.kpCard, CARD_GLOW]}>
                <Text allowFontScaling={false} style={[styles.kpTitle, { fontFamily: theme.regularFont }]}>
                  {kp.focus ? t(`analysis.drills.focus.${kp.focus}`) : t('analysis.drills.step.keyPoint')}
                </Text>
                <Text allowFontScaling={false} style={[styles.kpText, { fontFamily: theme.regularFont }]}>
                  {kp.text}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {videoUri ? (
        <View style={styles.compare}>
          <Text allowFontScaling={false} style={[styles.compareTitle, { fontFamily: theme.regularFont }]}>
            {t('analysis.drills.step.compareTitle')}
          </Text>
          <View style={styles.compareRow}>
            <ClipCard label={t('analysis.yourMovement')} kind="you" accent={YOU} videoUri={videoUri} />
            <ClipCard
              label={t('analysis.drills.step.correctMovement')}
              kind="pro"
              accent={PRO}
              videoUri={proVideoUri}
              emptyLabel={t('analysis.compareProEmpty')}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.nav}>
        <SurfaceButton
          label={`←  ${t('analysis.drills.step.previous')}`}
          onPress={() => (index === 0 ? onBack() : onGoTo(index - 1))}
          style={styles.navBtn}
          paddingX={12}
          testID="drill-step-previous"
        />
        <GlowButton
          label={last ? t('analysis.drills.step.finish') : t('analysis.drills.step.next')}
          arrow
          onPress={() => (last ? onFinish() : onGoTo(index + 1))}
          style={styles.navBtn}
          paddingX={12}
          testID="drill-step-next"
        />
      </View>
    </ScrollView>
  )
}

/** Dots joined by a line: done steps filled, the current one ringed and glowing. Tap a dot to jump. */
function Stepper({ total, index, onGoTo }: { total: number; index: number; onGoTo: (i: number) => void }) {
  const { t } = useTranslation()
  return (
    <View style={styles.stepper} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: total, now: index + 1 }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.stepperCell, i === total - 1 && styles.stepperCellLast]}>
          {i < total - 1 ? <View style={[styles.stepperLine, i < index && styles.stepperLineDone]} /> : null}
          <Pressable
            onPress={() => onGoTo(i)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('analysis.drills.detail.playStep', { n: i + 1 })}
            style={[styles.dot, i < index && styles.dotDone, i === index && styles.dotCurrent]}
          >
            {i === index ? <View style={styles.dotCore} /> : null}
          </Pressable>
        </View>
      ))}
    </View>
  )
}

const RING = 76
const DOT = 26

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 18 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  stepper: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingRight: 4 },
  stepperCell: { flex: 1, justifyContent: 'center' },
  stepperCellLast: { flex: 0 },
  stepperLine: { position: 'absolute', left: DOT / 2, right: -DOT / 2, height: 3, backgroundColor: '#13308F' },
  stepperLineDone: { backgroundColor: DONE },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: '#13308F', alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: DONE },
  dotCurrent: {
    backgroundColor: '#2F7BFF',
    boxShadow: '0px 0px 14px 2px #2F7BFFAA',
  },
  dotCore: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  numRing: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2.5,
    borderColor: UI.accentStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { color: '#4DB8FF', fontSize: 40 },
  headCopy: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, color: UI.text, fontSize: 22 },
  of: { color: UI.text, fontSize: 14, marginTop: 4 },
  sub: { color: '#4DB8FF', fontSize: 15, lineHeight: 20 },
  panel: {
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#0B2A7A',
    backgroundColor: '#030A17',
    padding: 14,
    gap: 12,
  },
  panelTitle: { color: UI.text, fontSize: 20 },
  kpRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  kpIcon: {
    width: 64,
    borderRadius: 18,
    backgroundColor: '#0B1F57',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
  },
  kpCard: { flex: 1, borderRadius: 18, backgroundColor: '#0B1F57', paddingHorizontal: 14, paddingVertical: 12, gap: 2, justifyContent: 'center' },
  kpTitle: { color: '#4DB8FF', fontSize: 16 },
  kpText: { color: UI.text, fontSize: 13, lineHeight: 18 },
  compare: { gap: 12 },
  compareTitle: { color: UI.text, fontSize: 20 },
  compareRow: { flexDirection: 'row', gap: 10 },
  nav: { flexDirection: 'row', gap: 10, marginTop: 4 },
  navBtn: { flex: 1, borderWidth: 0, borderColor: BLUE },
})
