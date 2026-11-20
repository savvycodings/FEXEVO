import { useContext, useEffect, useMemo, useState } from 'react'
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
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../../context'
import { UI } from '../../components/ui'
import { LocalSvgAsset, prefetchSvgAssets } from '../../components/LocalSvgAsset'
import { localCatalogueDrills } from '../../lib/drillLocalCatalogue'
import type { Drill } from '../../lib/drillsApi'
import { stepText, stepTitle } from '../../lib/drillsApi'
import { DrillOverviewPage } from './DrillOverviewPage'
import { DrillWalkthroughPage } from './DrillWalkthroughPage'
import { DrillCompletedPage } from './DrillCompletedPage'
import {
  getNextSuggestedDrillId,
  mediaPacksForShot,
  type DrillMediaPack,
} from './drillMedia'

const RACKET_SVG = require('../../../assets/drillspage/tennisracket.svg')
prefetchSvgAssets([RACKET_SVG])

const THUMB_BANDEJA = require('../../../assets/drillspage/bandejadrill.png')
const THUMB_OVERHEAD = require('../../../assets/drillspage/overheadpositining.png')
const THUMB_RECOVERY = require('../../../assets/drillspage/recoveryandbalance.png')

type SuggestedDrillCard = {
  id: string
  title: string
  summary: string
  level?: 'beginner'
  thumb: ImageSourcePropType
  pack: DrillMediaPack
}

const THUMB_BY_ID: Record<string, ImageSourcePropType> = {
  'bandeja-drill': THUMB_BANDEJA,
  'overhead-positioning': THUMB_OVERHEAD,
  'topspin-smash': THUMB_OVERHEAD,
  'forehand-volley': THUMB_BANDEJA,
  'backhand-volley': THUMB_RECOVERY,
  'recovery-balance': THUMB_RECOVERY,
}

/** Compact row height from the Figma cards — never let image aspect ratio stretch the row. */
const CARD_HEIGHT = 112
const THUMB_WIDTH = 112
const RACKET = 64

type Props = {
  onClose: () => void
  /** Shot name in the hero. */
  shotLabel?: string | null
  /** Stroke preset from analysis (e.g. `backhand_drive`, `bandeja`). */
  strokePreset?: string | null
  subtitle?: string | null
}

function packToCard(pack: DrillMediaPack): SuggestedDrillCard {
  return {
    id: pack.id,
    title: pack.name,
    summary: pack.subtitle,
    level: pack.id === 'bandeja-drill' ? 'beginner' : undefined,
    thumb: THUMB_BY_ID[pack.id] ?? THUMB_RECOVERY,
    pack,
  }
}

/** Local catalogue rows → card + synthetic media pack (text steps, no Railway video). */
function localDrillToCard(drill: Drill): SuggestedDrillCard {
  const steps = drill.steps.map((step, i) => {
    const title = stepTitle(step) ?? `Step ${i + 1}`
    const summary = stepText(step)
    return {
      title,
      summary,
      task: summary,
      focus: [] as string[],
      practice: '3 sets x 8 repetitions',
      minutes: `~ ${Math.max(1, Math.round(drill.minutes / Math.max(1, drill.steps.length)))} min`,
      videoUri: drill.videoUrl,
    }
  })
  const pack: DrillMediaPack = {
    id: drill.slug,
    name: drill.title,
    shotLabel: drill.focusLabel,
    subtitle: drill.summary,
    focusParts: drill.focus,
    steps,
  }
  return {
    id: drill.slug,
    title: drill.title,
    summary: drill.summary,
    level: drill.level === 'beginner' ? 'beginner' : undefined,
    thumb: THUMB_RECOVERY,
    pack,
  }
}

/**
 * Suggested Drills UI matched to the Figma mock (header racket + cards).
 * Cards are filtered to the current shot — bandeja only when the shot is bandeja.
 */
export function SuggestedDrillsPage({
  onClose,
  shotLabel = null,
  strokePreset = null,
  subtitle = null,
}: Props) {
  const { t, i18n } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const font = theme.regularFont
  const fontSemi = theme.semiBoldFont ?? theme.regularFont

  const displayShot =
    (typeof shotLabel === 'string' && shotLabel.trim()) ||
    (typeof strokePreset === 'string' && strokePreset.replace(/[_-]+/g, ' ').trim()) ||
    t('analysis.viewAnglesPage.shotFallback')

  const heroSubtitle =
    (typeof subtitle === 'string' && subtitle.trim()) ||
    t('analysis.suggestedDrillsSubtitle', {
      defaultValue: 'Targeted drills to improve this shot',
      shot: displayShot,
    })

  const drills = useMemo(() => {
    const packs = mediaPacksForShot(shotLabel, strokePreset)
    if (packs.length) return packs.map(packToCard)
    // No Railway pack for this family — shot-tagged local catalogue only (never dumps bandeja).
    const shotQuery =
      [shotLabel, strokePreset].filter(Boolean).join(' ').replace(/[_-]+/g, ' ').trim() || null
    return localCatalogueDrills([], shotQuery, i18n.language, 3, true).map(localDrillToCard)
  }, [shotLabel, strokePreset, i18n.language])

  const drillIds = useMemo(() => drills.map((d) => d.id), [drills])
  const packsById = useMemo(() => {
    const map: Record<string, DrillMediaPack> = {}
    for (const d of drills) map[d.id] = d.pack
    return map
  }, [drills])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [walkthroughOpen, setWalkthroughOpen] = useState(false)
  const [completedOpen, setCompletedOpen] = useState(false)
  /** Bump so Repeat / Do Again always remounts walkthrough at step 1. */
  const [walkthroughKey, setWalkthroughKey] = useState(0)

  useEffect(() => {
    setSelectedId(drills[0]?.id ?? null)
    setOverviewOpen(false)
    setWalkthroughOpen(false)
    setCompletedOpen(false)
  }, [drills])

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

  const activeDrillId = selectedId ?? drills[0]?.id ?? ''
  const activeDrill = drills.find((d) => d.id === activeDrillId) ?? drills[0] ?? null
  const activePack = activeDrill ? packsById[activeDrill.id] ?? activeDrill.pack : null

  if (completedOpen && activeDrill) {
    return (
      <DrillCompletedPage
        drillName={activeDrill.title}
        onDoAgain={restartWalkthroughFromStepOne}
        onDone={backToSuggestedDrills}
        onNextDrill={() => {
          backToSuggestedDrills()
          const next = getNextSuggestedDrillId(activeDrillId, drillIds, shotLabel, strokePreset)
          if (next) setSelectedId(next)
        }}
      />
    )
  }

  if (walkthroughOpen && activeDrillId) {
    return (
      <DrillWalkthroughPage
        key={walkthroughKey}
        drillId={activeDrillId}
        mediaPack={activePack}
        onClose={() => setWalkthroughOpen(false)}
        onBackToOverview={() => setWalkthroughOpen(false)}
        onComplete={() => {
          setWalkthroughOpen(false)
          setCompletedOpen(true)
        }}
      />
    )
  }

  if (overviewOpen && activeDrillId) {
    return (
      <DrillOverviewPage
        drillId={activeDrillId}
        mediaPack={activePack}
        shotLabel={activeDrill?.title ?? displayShot}
        subtitle={activeDrill?.summary ?? heroSubtitle}
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
              {displayShot}
            </Text>
            <Text allowFontScaling={false} style={[styles.heroSubtitle, { fontFamily: font }]}>
              {heroSubtitle}
            </Text>
          </View>
        </View>

        <Text allowFontScaling={false} style={[styles.sectionTitle, { fontFamily: fontSemi }]}>
          Suggested Drills
        </Text>

        <View style={styles.cardList}>
          {drills.length === 0 ? (
            <Text allowFontScaling={false} style={[styles.emptyCopy, { fontFamily: font }]}>
              {t('analysis.noSuggestedDrills', {
                defaultValue: 'No suggested drills for this shot yet.',
              })}
            </Text>
          ) : (
            drills.map((drill) => (
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
            ))
          )}
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
  drill: SuggestedDrillCard
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
  heroTitle: { color: '#FFFFFF', fontSize: 22 },
  heroSubtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 18 },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, marginBottom: 12 },
  emptyCopy: { color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 20, paddingVertical: 8 },
  cardList: { gap: 12 },
  cardOuter: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardOuterSelected: {
    borderColor: '#3D8BFF',
    boxShadow: '0px 0px 16px 0px rgba(47, 107, 255, 0.55)',
  },
  cardInner: {
    height: CARD_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#06102E',
  },
  cardInnerIdle: {
    borderWidth: 1.5,
    borderColor: '#062C7B',
  },
  cardInnerSelected: {
    borderWidth: 0,
  },
  thumbWrap: {
    width: THUMB_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#020814',
  },
  thumb: { width: '100%', height: '100%' },
  cardBody: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingRight: 28,
    justifyContent: 'center',
    gap: 4,
  },
  cardTitle: { color: '#FFFFFF', fontSize: 15 },
  cardSummary: { color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 16 },
  chevron: { position: 'absolute', right: 10, top: '50%', marginTop: -9 },
  levelPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(6, 16, 40, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(61, 139, 255, 0.55)',
  },
  levelText: { color: '#7AECFF', fontSize: 10 },
  glowOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
  },
  glowOverlayIdle: {
    boxShadow: '0px 0px 18px 0px #0048FF55 inset',
  },
  glowOverlaySelected: {
    boxShadow: '0px 0px 22px 0px #3D8BFF88 inset',
  },
})
