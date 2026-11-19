import { useContext, type ReactNode } from 'react'
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import Svg, { Path } from 'react-native-svg'
import { ThemeContext } from '../../context'
import { PrimaryFill, UI } from '../../components/ui'
import { LocalSvgAsset, prefetchSvgAssets } from '../../components/LocalSvgAsset'

const STEPS_COMPLETE_SVG = require('../../../assets/drillspage/stepscomplete.svg')
const CLOCK_SVG = require('../../../assets/drillspage/clock.svg')
const COMPLETE_PNG = require('../../../assets/drillspage/complete.png')
const REPEAT_SVG = require('../../../assets/drillspage/repeatdrill.svg')
const DONE_SVG = require('../../../assets/drillspage/donefornow.svg')
prefetchSvgAssets([STEPS_COMPLETE_SVG, CLOCK_SVG, REPEAT_SVG, DONE_SVG])

const THUMB = require('../../../assets/drillspage/overheadpositining.png')

const CHECK_GREEN = '#00FFA6'
const ACCENT = '#4DA6FF'
const CARD_BORDER = '#336AB3'

const IMPROVEMENTS = [
  'Ready position and split step timing',
  'Movement and weight transfer',
  'Volley execution and contact',
  'Recovery and consistency',
] as const

type Props = {
  drillName?: string
  onDoAgain: () => void
  onDone: () => void
  /** Optional — Next Recommended Drill tap. */
  onNextDrill?: () => void
}

/**
 * Post-walkthrough “Drill Completed!” screen (Figma).
 * Opened when Next is pressed on the final walkthrough step.
 */
export function DrillCompletedPage({
  drillName = 'Bandeja Drill',
  onDoAgain,
  onDone,
  onNextDrill,
}: Props) {
  const { theme } = useContext(ThemeContext)
  const font = theme.regularFont
  const fontSemi = theme.semiBoldFont ?? theme.regularFont
  const fontMed = theme.mediumFont ?? theme.regularFont

  return (
    <View style={[styles.shell, { backgroundColor: UI.pageBg }]} testID="drill-completed">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.checkBadge}>
            {/* Figma check stroke: 3px solid #00B8FF — sized to fill ~half the ring. */}
            <Svg width={88} height={88} viewBox="0 0 40 40">
              <Path
                d="M8 20.5 L16.5 29 L32 11"
                stroke="#00B8FF"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </View>
          <Text allowFontScaling={false} style={[styles.heroTitle, { fontFamily: fontSemi }]}>
            Drill Completed!
          </Text>
          <Text allowFontScaling={false} style={[styles.heroSub, { fontFamily: font }]}>
            Great work. You've completed
          </Text>
          <Text allowFontScaling={false} style={[styles.heroDrill, { fontFamily: fontSemi }]}>
            {drillName}
          </Text>
        </View>

        <View style={styles.statRow}>
          <StatChip
            icon={<LocalSvgAsset assetModule={STEPS_COMPLETE_SVG} width={24} height={24} />}
            value="4 / 4"
            label="Steps Completed"
            font={font}
            fontSemi={fontSemi}
          />
          <StatChip
            icon={<LocalSvgAsset assetModule={CLOCK_SVG} width={22} height={22} />}
            value="8 min"
            label="Total Time"
            font={font}
            fontSemi={fontSemi}
          />
          <StatChip
            icon={<Image source={COMPLETE_PNG} style={styles.completeIcon} resizeMode="contain" />}
            value="100%"
            label="Completed"
            font={font}
            fontSemi={fontSemi}
          />
        </View>

        <Text allowFontScaling={false} style={[styles.sectionTitle, { fontFamily: fontSemi }]}>
          What You Improved
        </Text>
        <View style={styles.improveList}>
          {IMPROVEMENTS.map((line) => (
            <View key={line} style={styles.improveRow}>
              <Ionicons name="checkmark-circle" size={32} color={CHECK_GREEN} />
              <Text allowFontScaling={false} style={[styles.improveText, { fontFamily: font }]}>
                {line}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Do Drill Again"
            style={styles.primaryBtn}
            onPress={onDoAgain}
            testID="drill-completed-again"
          >
            <PrimaryFill radius={UI.radiusPill} />
            <Text allowFontScaling={false} style={[styles.primaryLabel, { fontFamily: fontSemi }]}>
              Do Drill Again
            </Text>
          </Pressable>

          <View style={styles.secondaryRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Repeat Drill"
              style={styles.secondaryBtn}
              onPress={onDoAgain}
              testID="drill-completed-repeat"
            >
              <LocalSvgAsset assetModule={REPEAT_SVG} width={30} height={30} />
              <Text allowFontScaling={false} style={[styles.secondaryLabel, { fontFamily: fontMed }]}>
                Repeat Drill
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done for Now"
              style={styles.secondaryBtn}
              onPress={onDone}
              testID="drill-completed-done"
            >
              <LocalSvgAsset assetModule={DONE_SVG} width={30} height={30} />
              <Text allowFontScaling={false} style={[styles.secondaryLabel, { fontFamily: fontMed }]}>
                Done for Now
              </Text>
            </Pressable>
          </View>
        </View>

        <Text allowFontScaling={false} style={[styles.sectionTitle, styles.nextTitle, { fontFamily: fontSemi }]}>
          Next Recommended Drill
        </Text>
        <RecommendedDrillCard
          title="Overhead Positioning"
          summary="Improve your overhead position and spacing"
          level="Intermediate"
          thumb={THUMB}
          font={font}
          fontSemi={fontSemi}
          onPress={onNextDrill}
        />
      </ScrollView>
    </View>
  )
}

function StatChip({
  icon,
  value,
  label,
  font,
  fontSemi,
}: {
  icon: ReactNode
  value: string
  label: string
  font: string
  fontSemi: string
}) {
  return (
    <View style={styles.statChip}>
      <View style={styles.statIcon}>{icon}</View>
      <Text allowFontScaling={false} style={[styles.statValue, { fontFamily: fontSemi }]}>
        {value}
      </Text>
      <Text allowFontScaling={false} numberOfLines={2} style={[styles.statLabel, { fontFamily: font }]}>
        {label}
      </Text>
    </View>
  )
}

function RecommendedDrillCard({
  title,
  summary,
  level,
  thumb,
  font,
  fontSemi,
  onPress,
}: {
  title: string
  summary: string
  level: string
  thumb: ImageSourcePropType
  font: string
  fontSemi: string
  onPress?: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={styles.recOuter}
      testID="drill-completed-next-drill"
    >
      <View style={styles.recInner}>
        <View style={styles.recThumbWrap}>
          <Image source={thumb} style={styles.recThumb} resizeMode="cover" />
        </View>
        <View style={styles.recBody}>
          <Text allowFontScaling={false} numberOfLines={2} style={[styles.recTitle, { fontFamily: fontSemi }]}>
            {title}
          </Text>
          <Text allowFontScaling={false} numberOfLines={2} style={[styles.recSummary, { fontFamily: font }]}>
            {summary}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#86A7D2" style={styles.recChevron} />
        <View style={styles.recLevel} pointerEvents="none">
          <Text allowFontScaling={false} style={[styles.recLevelText, { fontFamily: font }]}>
            {level}
          </Text>
        </View>
        <View pointerEvents="none" style={styles.recGlow} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 40,
  },

  hero: {
    alignItems: 'center',
    marginBottom: 22,
    gap: 8,
  },
  checkBadge: {
    width: 152,
    height: 152,
    borderRadius: 76,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: '#00B8FF',
    backgroundColor: '#030A17',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    boxShadow: '0px 0px 20px 0px #0048FF inset, 0px 0px 24px 0px #0048FF',
  },
  heroTitle: {
    color: UI.text,
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
  },
  heroSub: {
    color: UI.text,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    opacity: 0.95,
    paddingHorizontal: 12,
  },
  heroDrill: {
    color: ACCENT,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },

  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 26,
  },
  statChip: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#0048FF',
    backgroundColor: '#0048FF26',
    boxShadow: '0px 0px 30px 0px #0048FF80 inset',
  },
  statIcon: {
    marginBottom: 2,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeIcon: {
    width: 24,
    height: 24,
  },
  statValue: {
    color: CHECK_GREEN,
    fontSize: 15,
    lineHeight: 18,
    textAlign: 'center',
  },
  statLabel: {
    color: UI.text,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
    opacity: 0.92,
  },

  sectionTitle: {
    color: UI.text,
    fontSize: 20,
    lineHeight: 24,
    marginBottom: 14,
  },
  /** ~2–4px between circles so they nearly touch (Figma). */
  improveList: {
    gap: 3,
    marginBottom: 26,
  },
  improveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  improveText: {
    flex: 1,
    color: UI.text,
    fontSize: 14,
    lineHeight: 20,
  },

  actions: {
    gap: 12,
    marginBottom: 28,
  },
  primaryBtn: {
    width: '100%',
    height: UI.buttonHeight,
    borderRadius: UI.radiusPill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    color: UI.btnPrimaryText,
    fontSize: 18,
    zIndex: 1,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  /** Rounded boxes (not pills) — icon stacked above centered label. */
  secondaryBtn: {
    flex: 1,
    minHeight: 72,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: UI.btnSecondaryBg,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    boxShadow: '0px 0px 20px 0px #0048FF inset',
  },
  secondaryLabel: {
    color: '#86A7D2',
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },

  nextTitle: {
    marginBottom: 14,
  },
  recOuter: {
    borderRadius: 20,
  },
  recInner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 112,
    borderRadius: 20,
    backgroundColor: '#0048FF0D',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#07256D',
    position: 'relative',
  },
  recThumbWrap: {
    width: 112,
    height: 112,
    backgroundColor: UI.surface,
    overflow: 'hidden',
  },
  recThumb: {
    width: 112,
    height: 112,
  },
  recBody: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 12,
    gap: 4,
    minWidth: 0,
  },
  recTitle: {
    color: ACCENT,
    fontSize: 15,
    lineHeight: 19,
  },
  recSummary: {
    color: UI.text,
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.92,
  },
  recChevron: {
    marginRight: 12,
    marginLeft: 2,
    zIndex: 2,
  },
  recLevel: {
    position: 'absolute',
    top: 10,
    right: 12,
    zIndex: 2,
    borderRadius: UI.radiusPill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: '#00FFA626',
  },
  recLevelText: {
    color: CHECK_GREEN,
    fontSize: 12,
    lineHeight: 14,
  },
  recGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    boxShadow: '0px 0px 30px 0px #0048FF80 inset',
  },
})
