import { useContext, useState } from 'react'
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
import { ThemeContext } from '../../context'
import { UI } from '../../components/ui'
import { LocalSvgAsset, prefetchSvgAssets } from '../../components/LocalSvgAsset'
import { DrillOverviewPage } from './DrillOverviewPage'
import { DrillWalkthroughPage } from './DrillWalkthroughPage'
import { DrillCompletedPage } from './DrillCompletedPage'

const RACKET_SVG = require('../../../assets/drillspage/tennisracket.svg')
prefetchSvgAssets([RACKET_SVG])

const THUMB_BANDEJA = require('../../../assets/drillspage/bandejadrill.png')
const THUMB_OVERHEAD = require('../../../assets/drillspage/overheadpositining.png')
const THUMB_RECOVERY = require('../../../assets/drillspage/recoveryandbalance.png')

type MockDrill = {
  id: string
  title: string
  summary: string
  level?: 'beginner'
  thumb: ImageSourcePropType
}

const MOCK_DRILLS: MockDrill[] = [
  {
    id: 'bandeja-drill',
    title: 'Bandeja Drill',
    summary: 'Build a more consistent bandeja with the right preparation and contact.',
    level: 'beginner',
    thumb: THUMB_BANDEJA,
  },
  {
    id: 'overhead-positioning',
    title: 'Overhead Positioning',
    summary: 'Improve your overhead position and spacing',
    thumb: THUMB_OVERHEAD,
  },
  {
    id: 'recovery-balance',
    title: 'Recovery & Balance',
    summary: 'Recover after the overhead and get ready for the next shot.',
    thumb: THUMB_RECOVERY,
  },
]

/** Compact row height from the Figma cards — never let image aspect ratio stretch the row. */
const CARD_HEIGHT = 112
const THUMB_WIDTH = 112
const RACKET = 64

type Props = {
  onClose: () => void
  /** Shot name in the hero; mock defaults to Bandeja. */
  shotLabel?: string
  subtitle?: string
}

/**
 * Static Suggested Drills UI matched to the Figma mock (header racket + cards).
 * Renders inside the main shell (global Header + tab bar stay visible).
 */
export function SuggestedDrillsPage({
  onClose,
  shotLabel = 'Bandeja',
  subtitle = 'Targeted drills to improve your bandeja and overhead consistency',
}: Props) {
  const { theme } = useContext(ThemeContext)
  const font = theme.regularFont
  const fontSemi = theme.semiBoldFont ?? theme.regularFont
  const [selectedId, setSelectedId] = useState(MOCK_DRILLS[0]?.id ?? null)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [walkthroughOpen, setWalkthroughOpen] = useState(false)
  const [completedOpen, setCompletedOpen] = useState(false)
  /** Bump so Repeat / Do Again always remounts walkthrough at step 1. */
  const [walkthroughKey, setWalkthroughKey] = useState(0)

  function restartWalkthroughFromStepOne() {
    setCompletedOpen(false)
    setOverviewOpen(true)
    setWalkthroughKey((k) => k + 1)
    setWalkthroughOpen(true)
  }

  function backToSuggestedDrills() {
    setCompletedOpen(false)
    setWalkthroughOpen(false)
    setOverviewOpen(false)
  }

  if (completedOpen) {
    return (
      <DrillCompletedPage
        drillName="Bandeja Drill"
        onDoAgain={restartWalkthroughFromStepOne}
        onDone={backToSuggestedDrills}
        onNextDrill={() => {
          backToSuggestedDrills()
          setSelectedId('overhead-positioning')
        }}
      />
    )
  }

  if (walkthroughOpen) {
    return (
      <DrillWalkthroughPage
        key={walkthroughKey}
        onClose={() => setWalkthroughOpen(false)}
        onBackToOverview={() => setWalkthroughOpen(false)}
        onComplete={() => {
          setWalkthroughOpen(false)
          setCompletedOpen(true)
        }}
      />
    )
  }

  if (overviewOpen) {
    return (
      <DrillOverviewPage
        shotLabel={shotLabel}
        subtitle={subtitle}
        onClose={() => setOverviewOpen(false)}
        onNext={() => setWalkthroughOpen(true)}
      />
    )
  }

  return (
    <View style={[styles.shell, { backgroundColor: UI.pageBg }]}>
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
          testID="drills1-back"
        >
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </Pressable>

        <View style={styles.heroRow}>
          <View style={styles.racketBadge} accessibilityLabel="Shot icon">
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

        <Text allowFontScaling={false} style={[styles.sectionTitle, { fontFamily: fontSemi }]}>
          Suggested Drills
        </Text>

        <View style={styles.cardList}>
          {MOCK_DRILLS.map((drill) => (
            <DrillMockCard
              key={drill.id}
              drill={drill}
              selected={drill.id === selectedId}
              onSelect={() => {
                if (drill.id === selectedId) setOverviewOpen(true)
                else setSelectedId(drill.id)
              }}
              font={font}
              fontSemi={fontSemi}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

function DrillMockCard({
  drill,
  selected,
  onSelect,
  font,
  fontSemi,
}: {
  drill: MockDrill
  selected: boolean
  onSelect: () => void
  font: string
  fontSemi: string
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={drill.title}
      onPress={onSelect}
      style={[styles.cardOuter, selected ? styles.cardOuterSelected : null]}
      testID={`drills1-card-${drill.id}`}
    >
      <View style={[styles.cardInner, selected ? styles.cardInnerSelected : styles.cardInnerIdle]}>
        <View style={styles.thumbWrap}>
          <Image source={drill.thumb} style={styles.thumb} resizeMode="cover" />
        </View>
        <View style={styles.cardBody}>
          <Text
            allowFontScaling={false}
            numberOfLines={2}
            style={[styles.cardTitle, { fontFamily: fontSemi }]}
          >
            {drill.title}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={3}
            style={[styles.cardSummary, { fontFamily: font }]}
          >
            {drill.summary}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#86A7D2" style={styles.chevron} />
        {drill.level ? (
          <View style={styles.levelPill} pointerEvents="none">
            <Text allowFontScaling={false} style={[styles.levelText, { fontFamily: font }]}>
              Beginner
            </Text>
          </View>
        ) : null}
        {/* Inset glow on top of thumb + body so it reads through the image. */}
        <View
          pointerEvents="none"
          style={[styles.glowOverlay, selected ? styles.glowOverlaySelected : styles.glowOverlayIdle]}
        />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
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
    marginBottom: 24,
  },
  /** Figma racket badge: fill #07256D, border #00B8FF on the edge, sharp #0048FF inset + outer glow. */
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
  heroCopy: {
    flex: 1,
    gap: 4,
    paddingRight: 4,
  },
  heroTitle: {
    color: UI.text,
    fontSize: 28,
    lineHeight: 32,
  },
  heroSubtitle: {
    color: '#86A7D2',
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    color: UI.text,
    fontSize: 20,
    lineHeight: 24,
    marginBottom: 14,
  },
  cardList: {
    gap: 12,
  },
  /** Outer keeps the halo — overflow:hidden on the inner would clip it. */
  cardOuter: {
    borderRadius: 20,
  },
  cardOuterSelected: {
    boxShadow: '0px 0px 20px 0px #0048FF',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: CARD_HEIGHT,
    borderRadius: 20,
    backgroundColor: '#0048FF0D',
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  cardInnerSelected: {
    borderColor: '#00B8FF',
  },
  cardInnerIdle: {
    borderColor: '#07256D',
  },
  glowOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  glowOverlaySelected: {
    boxShadow: '0px 0px 30px 0px #0048FF inset',
  },
  glowOverlayIdle: {
    boxShadow: '0px 0px 30px 0px #0048FF80 inset',
  },
  /** Left slot fills card height; image covers the whole slot. */
  thumbWrap: {
    width: THUMB_WIDTH,
    height: '100%',
    backgroundColor: UI.surface,
    overflow: 'hidden',
  },
  thumb: {
    width: THUMB_WIDTH,
    height: CARD_HEIGHT,
  },
  cardBody: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 12,
    gap: 4,
    minWidth: 0,
  },
  cardTitle: {
    color: '#4DA6FF',
    fontSize: 15,
    lineHeight: 19,
  },
  /** Anchored to the card corner — not inline with the title. */
  levelPill: {
    position: 'absolute',
    top: 10,
    right: 12,
    zIndex: 2,
    borderRadius: UI.radiusPill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: '#00FFA626',
  },
  levelText: {
    color: '#00FFA6',
    fontSize: 12,
    lineHeight: 14,
  },
  cardSummary: {
    color: UI.text,
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.92,
  },
  chevron: {
    marginRight: 12,
    marginLeft: 2,
    alignSelf: 'center',
    zIndex: 2,
  },
})
