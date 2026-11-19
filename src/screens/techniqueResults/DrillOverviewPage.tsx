import { useContext } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext } from '../../context'
import { PrimaryFill, UI } from '../../components/ui'
import { LocalSvgAsset, prefetchSvgAssets } from '../../components/LocalSvgAsset'
import { MockDrillPlayer } from './MockDrillPlayer'

const RACKET_SVG = require('../../../assets/drillspage/tennisracket.svg')
const STEPS_SVG = require('../../../assets/drillspage/steps.svg')
const DURATION_SVG = require('../../../assets/drillspage/duration.svg')
const PARTNER_SVG = require('../../../assets/drillspage/partner.svg')
const FOCUS_SVG = require('../../../assets/drillspage/yourfocus.svg')
const STEP_THUMB = require('../../../assets/drillspage/overheadpositining.png')

prefetchSvgAssets([RACKET_SVG, STEPS_SVG, DURATION_SVG, PARTNER_SVG, FOCUS_SVG])

const RACKET = 64
const FOCUS_GOLD = '#FFBB00'
const FOCUS_BORDER = '#FFBB0080'
const FOCUS_DISC = '#FFBB0026'

type Step = {
  title: string
  summary: string
}

const STEPS: Step[] = [
  {
    title: 'Prepare without the racket',
    summary: 'Improve your overhead position and spacing',
  },
  {
    title: 'Without the racket',
    summary: 'Improve your overhead position and spacing',
  },
  {
    title: 'Add the ball',
    summary: 'Improve your overhead position and spacing',
  },
  {
    title: 'Put it together',
    summary: 'Improve your overhead position and spacing',
  },
]

type Props = {
  onClose: () => void
  /** Opens the step walkthrough (Figma “Next”). */
  onNext?: () => void
  shotLabel?: string
  subtitle?: string
}

/**
 * Figma drill overview (Bandeja): hero, video chrome, stats, progression, focus, CTAs.
 * Opened from SuggestedDrillsPage when a selected card is tapped again. No real media yet.
 */
export function DrillOverviewPage({
  onClose,
  onNext,
  shotLabel = 'Bandeja',
  subtitle = 'Targeted drills to improve your bandeja and overhead consistency',
}: Props) {
  const { theme } = useContext(ThemeContext)
  const font = theme.regularFont
  const fontSemi = theme.semiBoldFont ?? theme.regularFont
  const fontMed = theme.mediumFont ?? theme.regularFont

  return (
    <View style={[styles.shell, { backgroundColor: UI.pageBg }]} testID="drill-overview">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          onPress={onClose}
          style={styles.back}
          testID="drill-overview-back"
        >
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </Pressable>

        <View style={styles.heroRow}>
          <View style={styles.racketBadge}>
            <LocalSvgAsset assetModule={RACKET_SVG} width={32} height={32} />
          </View>
          <View style={styles.heroCopy}>
            <Text allowFontScaling={false} style={[styles.heroTitle, { fontFamily: fontSemi }]}>
              {shotLabel}
            </Text>
            <Text allowFontScaling={false} style={[styles.heroSubtitle, { fontFamily: font }]}>
              {subtitle}
            </Text>
          </View>
        </View>

        <MockDrillPlayer fontFamily={font} testID="drill-overview-player" />

        <View style={styles.statRow}>
          <View style={styles.statChip}>
            <View style={styles.statInner}>
              <LocalSvgAsset assetModule={STEPS_SVG} width={26} height={26} />
              <Text allowFontScaling={false} style={[styles.statText, { fontFamily: font }]}>
                4 Steps
              </Text>
            </View>
          </View>
          <View style={styles.statChip}>
            <View style={styles.statInner}>
              <LocalSvgAsset assetModule={DURATION_SVG} width={26} height={26} />
              <View style={styles.statStack}>
                <Text allowFontScaling={false} style={[styles.statText, { fontFamily: font }]}>
                  Duration
                </Text>
                <Text allowFontScaling={false} style={[styles.statAccent, { fontFamily: fontSemi }]}>
                  8 min
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.statChip}>
            <View style={styles.statInnerFill}>
              <LocalSvgAsset assetModule={PARTNER_SVG} width={26} height={26} />
              <Text
                allowFontScaling={false}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={[styles.statPartnerText, { fontFamily: font }]}
              >
                {'Partner or ball\nmachine'}
              </Text>
            </View>
          </View>
        </View>

        <Text allowFontScaling={false} style={[styles.sectionTitle, { fontFamily: fontSemi }]}>
          Drill Progression
        </Text>

        <View style={styles.stepList}>
          {STEPS.map((step, i) => (
            <Pressable
              key={step.title}
              accessibilityRole="button"
              accessibilityLabel={`Step ${i + 1}: ${step.title}`}
              style={styles.stepCard}
              testID={`drill-overview-step-${i + 1}`}
            >
              <View style={styles.stepNum}>
                <Text allowFontScaling={false} style={[styles.stepNumText, { fontFamily: fontSemi }]}>
                  {i + 1}
                </Text>
              </View>
              <View style={styles.stepCopy}>
                <Text
                  allowFontScaling={false}
                  numberOfLines={2}
                  style={[styles.stepTitle, { fontFamily: fontMed }]}
                >
                  {step.title}
                </Text>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={[styles.stepSummary, { fontFamily: font }]}
                >
                  {step.summary}
                </Text>
              </View>
              <View style={styles.stepThumb}>
                <Image source={STEP_THUMB} style={styles.stepThumbImage} resizeMode="cover" />
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.focusBox}>
          <View style={styles.focusIconDisc}>
            <LocalSvgAsset assetModule={FOCUS_SVG} width={34} height={34} />
          </View>
          <View style={styles.focusCopy}>
            <Text allowFontScaling={false} style={[styles.focusLabel, { fontFamily: fontSemi }]}>
              Your focus
            </Text>
            <Text allowFontScaling={false} style={[styles.focusBody, { fontFamily: font }]}>
              Improve your contact position and movement for a more consistent bandeja
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start Full Drill"
            style={styles.startBtn}
            testID="drill-overview-start"
          >
            <PrimaryFill radius={UI.radiusPill} />
            <View style={styles.startCluster}>
              <View style={styles.playBadge}>
                <Ionicons name="play" size={16} color="#FFFFFF" style={styles.playIcon} />
              </View>
              <Text allowFontScaling={false} style={[styles.startLabel, { fontFamily: fontSemi }]}>
                Start Full Drill
              </Text>
              <Ionicons name="arrow-forward" size={22} color={UI.btnPrimaryText} />
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next"
            style={styles.nextBtn}
            onPress={onNext}
            testID="drill-overview-next"
          >
            <Text allowFontScaling={false} style={[styles.nextLabel, { fontFamily: fontMed }]}>
              Next
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#86A7D2" />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  back: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingRight: 8,
    marginBottom: 8,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  racketBadge: {
    width: RACKET,
    height: RACKET,
    borderRadius: RACKET / 2,
    backgroundColor: '#07256D',
    borderWidth: 2.5,
    borderColor: '#00B8FF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 0px 20px 0px #0048FF inset, 0px 0px 20px 0px #0048FF',
  },
  heroCopy: { flex: 1, gap: 4, paddingRight: 4 },
  heroTitle: { color: UI.text, fontSize: 28, lineHeight: 32 },
  heroSubtitle: { color: '#86A7D2', fontSize: 13, lineHeight: 18 },

  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 22,
  },
  /**
   * Three equal boxes. Content cluster is centered in the chip (not left-pinned).
   */
  statChip: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#0048FF',
    backgroundColor: '#041641',
  },
  /** Icon + text as one centered group (steps / duration). */
  statInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  /** Partner: use full chip width, still vertically centered. */
  statInnerFill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    paddingHorizontal: 2,
  },
  statStack: {
    justifyContent: 'center',
    gap: 0,
  },
  statText: { color: UI.text, fontSize: 11, lineHeight: 14 },
  /** Forced two lines via `\n` — won’t wrap into a third line. */
  statPartnerText: {
    flex: 1,
    minWidth: 0,
    color: UI.text,
    fontSize: 11,
    lineHeight: 14,
  },
  statAccent: { color: '#5BE8C8', fontSize: 12, lineHeight: 14 },

  sectionTitle: {
    color: UI.text,
    fontSize: 20,
    lineHeight: 24,
    marginBottom: 14,
  },
  stepList: { gap: 12, marginBottom: 18 },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    /** Tighter vertical pad — content sizes unchanged, box a bit shorter. */
    paddingVertical: 6,
    paddingLeft: 16,
    paddingRight: 12,
    borderRadius: 20,
    backgroundColor: '#0048FF0D',
    borderWidth: 1,
    borderColor: '#07256D',
    boxShadow: '0px 0px 30px 0px #0048FF80 inset',
  },
  stepNum: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#00B8FF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#07256D',
    boxShadow: '0px 0px 10px 0px #0048FF',
    /** Extra air between the circle and the title copy. */
    marginRight: 4,
  },
  stepNumText: { color: '#FFFFFF', fontSize: 18 },
  stepCopy: { flex: 1, gap: 1, minWidth: 0 },
  stepTitle: { color: UI.text, fontSize: 15, lineHeight: 19 },
  stepSummary: { color: UI.text, fontSize: 13, lineHeight: 16 },
  stepThumb: {
    width: 64,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#0B1F57',
    overflow: 'hidden',
  },
  stepThumbImage: {
    width: '100%',
    height: '100%',
  },

  focusBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: FOCUS_BORDER,
    /** Same as page — no separate fill. */
    backgroundColor: UI.pageBg,
    marginBottom: 22,
  },
  focusIconDisc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: FOCUS_DISC,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Tight gap so a larger heading grows into the space below, not above the icon. */
  focusCopy: { flex: 1, gap: 2, minWidth: 0 },
  focusLabel: { color: FOCUS_GOLD, fontSize: 19, lineHeight: 22 },
  focusBody: { color: UI.text, fontSize: 13, lineHeight: 17 },

  actions: { gap: 12 },
  startBtn: {
    width: '100%',
    height: UI.buttonHeight,
    borderRadius: UI.radiusPill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Play + label + arrow as one centered cluster (not pinned to the left edge). */
  startCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 1,
  },
  playBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#050B1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { marginLeft: 2 },
  startLabel: {
    color: UI.btnPrimaryText,
    fontSize: 18,
  },
  nextBtn: {
    height: UI.buttonHeight,
    borderRadius: UI.radiusPill,
    borderWidth: 1,
    borderColor: '#336AB3',
    backgroundColor: UI.btnSecondaryBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0px 0px 20px 0px #0048FF inset',
  },
  nextLabel: { color: '#86A7D2', fontSize: 18 },
})
