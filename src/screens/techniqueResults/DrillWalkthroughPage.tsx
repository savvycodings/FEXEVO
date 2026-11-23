import { useContext, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext } from '../../context'
import { PrimaryFill, UI } from '../../components/ui'
import { LocalSvgAsset, prefetchSvgAssets } from '../../components/LocalSvgAsset'
import { MockDrillPlayer } from './MockDrillPlayer'
import { getDrillMediaPack, type DrillMediaPack, type DrillStepMedia } from './drillMedia'

const TASK_SVG = require('../../../assets/drillspage/yourtasks.svg')
const FOCUS_SVG = require('../../../assets/drillspage/focusonblue.svg')
const PRACTICE_SVG = require('../../../assets/drillspage/practice.svg')
const CLOCK_SVG = require('../../../assets/drillspage/clock.svg')

prefetchSvgAssets([TASK_SVG, FOCUS_SVG, PRACTICE_SVG, CLOCK_SVG])

const CARD_BORDER = '#336AB3'
const CHECK_GREEN = '#00FFA6'
/** Per-digit optical nudge inside the hero ring (x right, y down). Narrow glyphs need a left nudge. */
const STEP_NUM_NUDGE: Record<number, { x: number; y: number }> = {
  1: { x: -1.5, y: -2 },
  2: { x: 0, y: -2 },
  3: { x: 0, y: -2 },
  4: { x: 0, y: -2 },
}

type Props = {
  onClose: () => void
  /** Back to the drill overview (Previous on step 0). */
  onBackToOverview: () => void
  /** Final-step Next → Drill Completed screen. */
  onComplete?: () => void
  /** Suggested-drills card id. */
  drillId?: string
  /** When set (e.g. local-catalogue synthetic pack), preferred over id lookup. */
  mediaPack?: DrillMediaPack | null
}

/**
 * Drill step walkthrough — opened from overview “Next”.
 * Same video chrome / pill CTAs as the overview; badges + Your Focus removed.
 */
export function DrillWalkthroughPage({
  onClose,
  onBackToOverview,
  onComplete,
  drillId,
  mediaPack,
}: Props) {
  const { theme } = useContext(ThemeContext)
  const font = theme.regularFont
  const fontSemi = theme.semiBoldFont ?? theme.regularFont
  const fontMed = theme.mediumFont ?? theme.regularFont
  const pack = mediaPack ?? getDrillMediaPack(drillId)
  const steps: DrillStepMedia[] = pack.steps
  const stepCount = steps.length
  const [stepIndex, setStepIndex] = useState(0)
  const [trackWidth, setTrackWidth] = useState(0)
  const scrollRef = useRef<ScrollView>(null)
  const step = steps[stepIndex] ?? steps[0]

  function scrollToTop() {
    scrollRef.current?.scrollTo({ y: 0, animated: true })
  }

  /** Line runs center→center only — never past the first/last balls. */
  const DOT_PAD = 6
  const DOT_SIZE = 24
  const firstCenter = DOT_PAD + DOT_SIZE / 2
  const lastCenter = Math.max(firstCenter, trackWidth - DOT_PAD - DOT_SIZE / 2)
  const railSpan = Math.max(0, lastCenter - firstCenter)
  const progress = stepCount <= 1 ? 0 : stepIndex / (stepCount - 1)
  const trailWidth = stepIndex <= 0 ? 0 : progress * railSpan

  function onTrackLayout(e: LayoutChangeEvent) {
    setTrackWidth(e.nativeEvent.layout.width)
  }

  function goPrev() {
    if (stepIndex <= 0) {
      onBackToOverview()
      return
    }
    setStepIndex((i) => i - 1)
    scrollToTop()
  }

  function goNext() {
    if (stepIndex >= stepCount - 1) {
      onComplete?.()
      return
    }
    setStepIndex((i) => i + 1)
    scrollToTop()
  }

  return (
    <View style={[styles.shell, { backgroundColor: UI.pageBg }]} testID="drill-walkthrough">
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={onClose}
            style={styles.back}
            testID="drill-walkthrough-back"
          >
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </Pressable>
          <View style={styles.dotsTrack} onLayout={onTrackLayout}>
            {/* Base rail + trail — both start at first-dot center, end at last/current center. */}
            {trackWidth > 0 ? (
              <View style={[styles.dotsLine, { left: firstCenter, width: railSpan }]} />
            ) : null}
            {trailWidth > 0 ? (
              <View style={[styles.dotsTrail, { left: firstCenter, width: trailWidth }]} />
            ) : null}
            {Array.from({ length: stepCount }, (_, i) => {
              if (i === stepIndex) {
                return (
                  <View key={i} style={styles.dotActiveOuter}>
                    <View style={styles.dotActiveMid}>
                      <View style={styles.dotActiveCenter} />
                    </View>
                  </View>
                )
              }
              if (i < stepIndex) {
                return <View key={i} style={styles.dotDone} />
              }
              return <View key={i} style={styles.dotIdle} />
            })}
          </View>
        </View>

        <View style={styles.heroRow}>
          <View style={styles.stepNum}>
            <Text
              allowFontScaling={false}
              style={[
                styles.stepNumText,
                { fontFamily: fontSemi },
                STEP_NUM_NUDGE[stepIndex + 1]
                  ? {
                      transform: [
                        { translateX: STEP_NUM_NUDGE[stepIndex + 1]!.x },
                        { translateY: STEP_NUM_NUDGE[stepIndex + 1]!.y },
                      ],
                    }
                  : null,
              ]}
            >
              {stepIndex + 1}
            </Text>
          </View>
          <View style={styles.heroCopy}>
            <Text allowFontScaling={false} style={[styles.heroTitle, { fontFamily: fontSemi }]}>
              {step.title}
            </Text>
            <Text allowFontScaling={false} style={[styles.heroSubtitle, { fontFamily: font }]}>
              {step.summary}
            </Text>
          </View>
        </View>

        <MockDrillPlayer
          key={`drill-player-${stepIndex}-${step.videoUri ?? 'none'}`}
          fontFamily={font}
          uri={step.videoUri}
          style={styles.playerSpacing}
          testID="drill-walkthrough-player"
        />

        <View style={styles.cardList}>
          <View style={styles.infoCard}>
            <LocalSvgAsset assetModule={TASK_SVG} width={24} height={24} />
            <View style={styles.cardCopy}>
              <Text allowFontScaling={false} style={[styles.cardTitle, { fontFamily: fontSemi }]}>
                Your Task
              </Text>
              <Text allowFontScaling={false} style={[styles.cardBody, { fontFamily: font }]}>
                {step.task}
              </Text>
            </View>
          </View>

          <View style={styles.focusCard}>
            <View style={styles.focusHeader}>
              <View style={styles.focusIconSlot}>
                <LocalSvgAsset assetModule={FOCUS_SVG} width={24} height={24} />
              </View>
              <Text allowFontScaling={false} style={[styles.cardTitle, { fontFamily: fontSemi }]}>
                Focus On
              </Text>
            </View>
            <View style={styles.focusList}>
              {step.focus.map((line) => (
                <View key={line} style={styles.focusRow}>
                  <View style={styles.focusIconSlot}>
                    <Ionicons name="checkmark-circle" size={20} color={CHECK_GREEN} />
                  </View>
                  <Text allowFontScaling={false} style={[styles.cardBody, styles.focusLine, { fontFamily: font }]}>
                    {line}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.infoCard}>
            <LocalSvgAsset assetModule={PRACTICE_SVG} width={24} height={24} />
            <View style={styles.cardCopy}>
              <View style={styles.practiceTitleRow}>
                <Text allowFontScaling={false} style={[styles.cardTitle, { fontFamily: fontSemi }]}>
                  Practice
                </Text>
                <View style={styles.timeBadge}>
                  <View pointerEvents="none" style={styles.timeBadgeGlow} />
                  <LocalSvgAsset assetModule={CLOCK_SVG} width={14} height={14} />
                  <Text allowFontScaling={false} style={[styles.timeBadgeText, { fontFamily: font }]}>
                    {step.minutes}
                  </Text>
                </View>
              </View>
              <Text allowFontScaling={false} style={[styles.cardBody, { fontFamily: font }]}>
                {step.practice}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start Practice"
            style={styles.startBtn}
            testID="drill-walkthrough-start"
          >
            <PrimaryFill radius={UI.radiusPill} />
            <View style={styles.startCluster}>
              <View style={styles.playBadge}>
                <Ionicons name="play" size={16} color="#FFFFFF" style={styles.playIcon} />
              </View>
              <Text allowFontScaling={false} style={[styles.startLabel, { fontFamily: fontSemi }]}>
                Start Practice
              </Text>
            </View>
          </Pressable>

          <View style={styles.navRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous"
              style={styles.navBtn}
              onPress={goPrev}
              testID="drill-walkthrough-prev"
            >
              <Ionicons name="arrow-back" size={18} color="#86A7D2" />
              <Text allowFontScaling={false} style={[styles.navLabel, { fontFamily: fontMed }]}>
                Previous
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next"
              style={styles.navBtn}
              onPress={goNext}
              testID="drill-walkthrough-next"
            >
              <Text allowFontScaling={false} style={[styles.navLabel, { fontFamily: fontMed }]}>
                Next
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#86A7D2" />
            </Pressable>
          </View>
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  back: {
    paddingVertical: 4,
    paddingRight: 4,
  },
  dotsTrack: {
    flex: 1,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    position: 'relative',
  },
  /** Same #07256D as idle nodes — width/left set in render to center→center. */
  dotsLine: {
    position: 'absolute',
    height: 4,
    backgroundColor: '#07256D',
    borderRadius: 2,
  },
  /** Completed path behind the active step — left set to first-dot center. */
  dotsTrail: {
    position: 'absolute',
    height: 4,
    backgroundColor: '#00B8FF',
    borderRadius: 2,
    zIndex: 0,
  },
  dotIdle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#07256D',
    zIndex: 1,
  },
  /** Completed steps behind the active marker. */
  dotDone: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00B8FF',
    zIndex: 1,
  },
  /** Outer ring — #00B8FF + inset/outset #0048FF glow. */
  dotActiveOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00B8FF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    boxShadow: '0px 0px 20px 0px #0048FF inset, 0px 0px 20px 0px #0048FF',
  },
  /** Second ring — 50% white with cyan inset glows. */
  dotActiveMid: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF80',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 0px 10px 0px #006EFF inset, 0px 0px 10px 0px #00B8FF inset',
  },
  /** Solid white center. */
  dotActiveCenter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },

  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 18,
  },
  stepNum: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#00B8FF',
    backgroundColor: '#030A17',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0px 0px 20px 0px #0048FF inset, 0px 0px 20px 0px #0048FF',
  },
  stepNumText: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    color: '#00B8FF',
    fontSize: 36,
    lineHeight: 52,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  heroCopy: { flex: 1, gap: 4, minWidth: 0 },
  heroTitle: { color: UI.text, fontSize: 20, lineHeight: 24 },
  heroSubtitle: { color: '#86A7D2', fontSize: 13, lineHeight: 18 },
  playerSpacing: { marginBottom: 14 },

  cardList: { gap: 12, marginBottom: 22 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: '#0048FF0D',
    boxShadow: '0px 0px 20px 0px #0048FF inset, 0px 0px 16px 0px #0048FF66',
  },
  /**
   * Compact Focus On — first check sits just under the target icon;
   * the two checkpoints stack almost flush (Figma).
   */
  focusCard: {
    gap: 4,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: '#0048FF0D',
    boxShadow: '0px 0px 20px 0px #0048FF inset, 0px 0px 16px 0px #0048FF66',
  },
  focusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  focusIconSlot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusList: { gap: 1 },
  cardCopy: { flex: 1, gap: 6, minWidth: 0 },
  cardTitle: {
    color: UI.text,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.3,
  },
  cardBody: {
    color: UI.text,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.92,
    letterSpacing: -0.2,
  },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 22,
  },
  focusLine: {
    flex: 1,
    lineHeight: 16,
  },
  practiceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  timeBadge: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: UI.radiusPill,
    backgroundColor: '#041641',
  },
  /** Inset glow on its own layer — same pattern as drill card overlays (boxShadow alone was invisible on the pill). */
  timeBadgeGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: UI.radiusPill,
    boxShadow: '0px 0px 20px 0px #0048FF inset',
  },
  timeBadgeText: {
    color: UI.text,
    fontSize: 12,
    letterSpacing: -0.2,
    zIndex: 1,
  },

  actions: { gap: 12 },
  startBtn: {
    width: '100%',
    height: UI.buttonHeight,
    borderRadius: UI.radiusPill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  startLabel: { color: UI.btnPrimaryText, fontSize: 18 },
  navRow: { flexDirection: 'row', gap: 10 },
  navBtn: {
    flex: 1,
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
  navLabel: { color: '#86A7D2', fontSize: 16 },
})
