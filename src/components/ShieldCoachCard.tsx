import { useCallback, useMemo, useState } from 'react'
import { Image, Platform, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import MaskedView from '@react-native-masked-view/masked-view'
import { LocalSvgAsset } from './LocalSvgAsset'
import { Asset } from 'expo-asset'
import { authClient } from '../lib/auth-client'
import type { TrainCategory } from '../lib/train-taxonomy'
import { TRAIN_CATEGORIES } from '../lib/train-taxonomy'
import {
  DEFAULT_SHIELD_FLAG,
  type ShieldFlagCode,
  shieldFlagSource,
} from './shieldCardFlags'
import { shieldLayout, type ShieldLayoutSpec, type ShieldLayoutVariant } from './shieldLayouts'
import { smallShieldLayout } from './smallShieldLayout'

export type { ShieldFlagCode } from './shieldCardFlags'
export { shieldLayout } from './shieldLayouts'
export { smallShieldLayout } from './smallShieldLayout'
export type { ShieldLayoutSpec, ShieldLayoutVariant } from './shieldLayouts'

const SHIELD_MASK = require('../../assets/shield-card/Shield_mask.png')
const SHIELD_OUTLINE = require('../../assets/shield-card/Shield_outline.png')
const PHOTO_TOP_MASK = require('../../assets/shield-card/photo-top-mask.svg')
const BACK_ELLIPSE = require('../../assets/shield-card/backelipse.png')
const BOTTOM_GRADIENT = require('../../assets/shield-card/Bottomgradientellipse.png')
const TOP_BLUE_LINE = require('../../assets/shield-card/topblueline.png')
const BACK_LINES = require('../../assets/shield-card/backlines.png')
const PHOTO_SHADOW = require('../../assets/shield-card/foto_shadow.png')
const FALLBACK_COACH = require('../../assets/mycoach/mycoachpfp.png')

const PILLAR_SCORE_COLOR = '#97CDFF'

/** Same five pillars as Profile rating row (excludes tactical specials). */
const PILLAR_ORDER: TrainCategory[] = [
  'save_return',
  'ground_strokes',
  'net_play',
  'defence_glass',
  'overhead',
]

const ABBR_BY_CATEGORY = Object.fromEntries(TRAIN_CATEGORIES.map((c) => [c.id, c.progressCode])) as Record<
  string,
  string
>

type ApiCategoryRow = { id: string; thisWeek: number; lastWeek: number }

function pillarScorePercent(thisWeekRaw: number): number {
  return Math.round(Math.max(0, Math.min(100, Number(thisWeekRaw) || 0)))
}

function defaultPillarDisplay(): { abbr: string; value: number }[] {
  return PILLAR_ORDER.map((id) => ({ abbr: ABBR_BY_CATEGORY[id] ?? id, value: 0 }))
}

function mapCategoriesToPillars(rows: ApiCategoryRow[]): { abbr: string; value: number }[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  return PILLAR_ORDER.map((id) => {
    const r = byId.get(id)
    return {
      abbr: ABBR_BY_CATEGORY[id] ?? id,
      value: pillarScorePercent(typeof r?.thisWeek === 'number' ? r.thisWeek : 0),
    }
  })
}

type Props = {
  coachName: string
  coachImageUri?: string | null
  scoreLabel?: string
  scoreValue?: string
  width?: number
  showScore?: boolean
  showName?: boolean
  /** Smaller secondary flag (upper area). */
  showFlag?: boolean
  /** Large crest where the Xevo logo used to sit. */
  showCrest?: boolean
  /** Bundled asset key — extend `SHIELD_FLAG_MODULES` in `shieldCardFlags.ts`. */
  flagCode?: ShieldFlagCode
  /**
   * Name on the back-ellipse band, above every layer including the outline.
   * If omitted, uses `coachName` (after trim). Pass `""` to hide while keeping `coachName` for the lower label.
   */
  topShieldName?: string
  showTopShieldName?: boolean
  /** SR / GS / NP / DG / OH row under the name; loads `/profile/rating-by-category` (this week → 0–100). */
  showPillarScores?: boolean
  /** Optional multiplier for the top name text only (e.g. 1.15). */
  topNameScale?: number
  /**
   * `small` uses `smallShieldLayout` from `smallShieldLayout.ts` — tune positions there without affecting Progress.
   */
  variant?: ShieldLayoutVariant
}

const BASE_W = 444
const BASE_H = 589
const SHADOW_ASPECT = 440 / 480
const BACK_ELLIPSE_ASPECT = 440 / 265
const BOTTOM_GRADIENT_ASPECT = 440 / 259
const TOP_LINE_ASPECT = 440 / 58
const BACK_LINES_ASPECT = 440 / 190
/** Typical rectangular flag (e.g. US 3:2); adjust if a bundled flag uses another ratio. */
const SHIELD_FLAG_ASPECT = 3 / 2

export function ShieldCoachCard({
  coachName,
  coachImageUri,
  scoreLabel = 'Score',
  scoreValue = '—',
  width = 112,
  showScore = true,
  showName = true,
  showFlag = true,
  showCrest = true,
  flagCode = DEFAULT_SHIELD_FLAG,
  topShieldName,
  showTopShieldName = true,
  showPillarScores = false,
  topNameScale = 1,
  variant = 'default',
}: Props) {
  const L: ShieldLayoutSpec = variant === 'small' ? (smallShieldLayout as ShieldLayoutSpec) : shieldLayout
  const styles = useMemo(() => createShieldStyles(L), [variant])

  const height = Math.round((width * BASE_H) / BASE_W)
  /** Scale vs design size (444×589); used for type — layer positions use `%` from `L` only so composition stays consistent. */
  const layoutScale = Math.max(0.35, Math.min(width / BASE_W, 1.5))
  const typeScale = Math.min(layoutScale, 1.2)
  const topNameBase = Math.max(9, Math.min(17, Math.round(17 * typeScale)))
  const topNameFontSizeRaw =
    variant === 'small' ? Math.min(19, Math.round(topNameBase * 1.12)) : topNameBase
  const topNameFontSize = Math.max(9, Math.round(topNameFontSizeRaw * topNameScale))
  const topNameLineHeight = Math.max(11, Math.round(topNameFontSize * 1.24))
  /** Spacing scales with card size (same ratio at any width/height). */
  const pillarRowMarginTop = Math.max(1, Math.round(5 * layoutScale))
  const pillarRowPadH = Math.max(0, Math.round(2 * layoutScale))
  const lowerNameFontSize = Math.max(8, Math.min(10, Math.round(10 * typeScale)))
  const scoreValueFontSize = Math.max(12, Math.min(18, Math.round(18 * typeScale)))
  const scoreLabelFontSize = Math.max(7, Math.min(9, Math.round(9 * typeScale)))

  const [pillarScores, setPillarScores] = useState<{ abbr: string; value: number }[] | null>(
    showPillarScores ? null : []
  )

  const loadPillarScores = useCallback(async () => {
    if (!showPillarScores) return
    try {
      const res = await authClient
        .$fetch<{ categories?: ApiCategoryRow[] }>('/profile/rating-by-category', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        .catch(() => null)
      const body: any = (res as any)?.data ?? res
      if (Array.isArray(body?.categories)) {
        setPillarScores(mapCategoriesToPillars(body.categories))
      } else {
        setPillarScores(defaultPillarDisplay())
      }
    } catch {
      setPillarScores(defaultPillarDisplay())
    }
  }, [showPillarScores])

  useFocusEffect(
    useCallback(() => {
      void loadPillarScores()
    }, [loadPillarScores])
  )
  const outlineScale = L.outline.scale
  const outlineW = Math.round(width * outlineScale)
  const outlineH = Math.round(height * outlineScale)
  const outlineLeft = (width - outlineW) / 2
  const outlineTop = (height - outlineH) / 2
  const photoSource: ImageSourcePropType = coachImageUri ? { uri: coachImageUri } : FALLBACK_COACH
  const flagSource = shieldFlagSource(flagCode)
  const topNameLabel = (topShieldName !== undefined ? topShieldName : coachName).trim()
  const isWeb = Platform.OS === 'web'
  const shieldMaskUri = isWeb ? Asset.fromModule(SHIELD_MASK).uri : null
  const photoTopMaskUri = isWeb ? Asset.fromModule(PHOTO_TOP_MASK).uri : null

  const webShieldMaskStyle =
    shieldMaskUri != null
      ? ({
          WebkitMaskImage: `url(${shieldMaskUri})`,
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          WebkitMaskSize: '100% 100%',
          maskImage: `url(${shieldMaskUri})`,
          maskRepeat: 'no-repeat',
          maskPosition: 'center',
          maskSize: '100% 100%',
          overflow: 'hidden',
        } as const)
      : null

  const outlineEl = (
    <Image
      source={SHIELD_OUTLINE}
      style={[styles.shieldOutline, { left: outlineLeft, top: outlineTop, width: outlineW, height: outlineH }]}
      resizeMode="stretch"
    />
  )

  const layersInner = (
    <>
      <View style={styles.baseBlue} />
      {!isWeb ? (
        <Image source={photoSource} style={styles.photoNative} resizeMode="cover" />
      ) : (
        <Image
          source={photoSource}
          style={[
            styles.photo,
            styles.photoWebMasked,
            photoTopMaskUri
              ? ({
                  WebkitMaskImage: `url(${photoTopMaskUri})`,
                  WebkitMaskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  WebkitMaskSize: '100% 100%',
                  maskImage: `url(${photoTopMaskUri})`,
                  maskRepeat: 'no-repeat',
                  maskPosition: 'center',
                  maskSize: '100% 100%',
                } as any)
              : null,
          ]}
          resizeMode="cover"
        />
      )}

      <Image
        source={PHOTO_SHADOW}
        style={[styles.shadowLayer, { aspectRatio: SHADOW_ASPECT }]}
        resizeMode="contain"
      />
      <Image
        source={BACK_ELLIPSE}
        style={[styles.backEllipseLayer, { aspectRatio: BACK_ELLIPSE_ASPECT }]}
        resizeMode="contain"
      />
      <Image
        source={BOTTOM_GRADIENT}
        style={[styles.bottomGradientLayer, { aspectRatio: BOTTOM_GRADIENT_ASPECT }]}
        resizeMode="contain"
      />
      <Image
        source={TOP_BLUE_LINE}
        style={[styles.topLineLayer, { aspectRatio: TOP_LINE_ASPECT }]}
        resizeMode="contain"
      />
      <Image
        source={BACK_LINES}
        style={[styles.backLinesLayer, { aspectRatio: BACK_LINES_ASPECT }]}
        resizeMode="contain"
      />

      {showCrest ? (
        <Image
          source={flagSource}
          style={[
            styles.crest,
            {
              aspectRatio: SHIELD_FLAG_ASPECT,
              bottom: L.crest.bottom,
            },
          ]}
          resizeMode="contain"
        />
      ) : null}
      {showFlag ? (
        <Image
          source={flagSource}
          style={[
            styles.flag,
            {
              aspectRatio: SHIELD_FLAG_ASPECT,
              bottom: L.flag.bottom,
            },
          ]}
          resizeMode="contain"
        />
      ) : null}

      {showScore ? (
        <View style={styles.scoreWrap}>
          <Text
            allowFontScaling={false}
            style={[styles.scoreValue, { fontSize: scoreValueFontSize, lineHeight: scoreValueFontSize }]}
          >
            {scoreValue}
          </Text>
          <Text
            allowFontScaling={false}
            style={[styles.scoreLabel, { fontSize: scoreLabelFontSize, lineHeight: scoreLabelFontSize + 1 }]}
          >
            {scoreLabel}
          </Text>
        </View>
      ) : null}
      {showName ? (
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.name, { fontSize: lowerNameFontSize, lineHeight: lowerNameFontSize + 2 }]}
        >
          {coachName}
        </Text>
      ) : null}
    </>
  )

  return (
    <View style={[styles.frame, { width, height }]}>
      {isWeb ? (
        <View style={[StyleSheet.absoluteFill, webShieldMaskStyle as any]}>{layersInner}</View>
      ) : (
        <MaskedView
          style={StyleSheet.absoluteFill}
          maskElement={
            <Image
              source={SHIELD_MASK}
              style={[styles.full, { width, height }]}
              resizeMode="stretch"
            />
          }
        >
          {layersInner}
        </MaskedView>
      )}
      {/*
        Rim must sit in a normal View above MaskedView — stacked MaskedViews + zero-height Svg
        wrappers made the outline invisible on native. Not re-masked: asset alpha defines the rim.
      */}
      <View
        style={[styles.outlineStack, { width, height }]}
        collapsable={false}
        pointerEvents="none"
      >
        {outlineEl}
      </View>
      {(showTopShieldName && topNameLabel.length > 0) || showPillarScores ? (
        <View
          style={[
            styles.shieldHeaderOverlay,
            { bottom: L.shieldTopName.bottom },
          ]}
          pointerEvents="none"
        >
          {showTopShieldName && topNameLabel.length > 0 ? (
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                styles.shieldTopNameText,
                {
                  fontSize: topNameFontSize,
                  lineHeight: topNameLineHeight,
                  textShadowRadius: Math.max(2, Math.round(4 * typeScale)),
                },
              ]}
              accessibilityRole="text"
            >
              {topNameLabel}
            </Text>
          ) : null}
          {showPillarScores ? (
            <View
              style={[
                styles.pillarScoresRow,
                { marginTop: pillarRowMarginTop, paddingHorizontal: pillarRowPadH },
              ]}
            >
              {(pillarScores ?? defaultPillarDisplay()).map((p) => {
                const abbrFs = Math.max(9, Math.min(11, Math.round(width * 0.032)))
                const valFs = Math.max(13, Math.min(22, Math.round(width * 0.058)))
                return (
                  <View key={p.abbr} style={styles.pillarCol}>
                    <Text
                      allowFontScaling={false}
                      {...(Platform.OS === 'android' ? { includeFontPadding: false } : {})}
                      style={[
                        styles.pillarAbbr,
                        {
                          fontSize: abbrFs,
                          lineHeight: abbrFs + 1,
                        },
                      ]}
                    >
                      {p.abbr}
                    </Text>
                    <Text
                      allowFontScaling={false}
                      {...(Platform.OS === 'android' ? { includeFontPadding: false } : {})}
                      style={[
                        styles.pillarValue,
                        {
                          fontSize: valFs,
                          lineHeight: valFs + 1,
                          marginTop: 1,
                        },
                      ]}
                    >
                      {pillarScores === null ? '—' : String(p.value)}
                    </Text>
                  </View>
                )
              })}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function createShieldStyles(L: ShieldLayoutSpec) {
  return StyleSheet.create({
    frame: {
      position: 'relative',
      overflow: 'visible',
    },
    full: {
      width: '100%',
      height: '100%',
    },
    baseBlue: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#0155F3',
      zIndex: 0,
    },
    photoWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: L.photo.height,
      zIndex: 1,
    },
    photo: {
      width: '100%',
      height: '100%',
    },
    photoNative: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: L.photo.bottom,
      height: L.photo.height,
      zIndex: 1,
    },
    photoWebMasked: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: L.photo.bottom,
      height: L.photo.height,
      zIndex: 1,
    },
    shadowLayer: {
      position: 'absolute',
      width: L.fotoShadow.width,
      left: L.fotoShadow.left,
      bottom: L.fotoShadow.bottom,
      zIndex: 2,
    },
    backEllipseLayer: {
      position: 'absolute',
      width: L.backEllipse.width,
      left: L.backEllipse.left,
      bottom: L.backEllipse.bottom,
      zIndex: 3,
    },
    bottomGradientLayer: {
      position: 'absolute',
      width: L.bottomGradient.width,
      left: L.bottomGradient.left,
      bottom: L.bottomGradient.bottom,
      zIndex: 4,
    },
    topLineLayer: {
      position: 'absolute',
      width: L.topBlueLine.width,
      left: L.topBlueLine.left,
      bottom: L.topBlueLine.bottom,
      zIndex: 5,
    },
    backLinesLayer: {
      position: 'absolute',
      width: L.backLines.width,
      left: L.backLines.left,
      bottom: L.backLines.bottom,
      zIndex: 6,
    },
    crest: {
      position: 'absolute',
      width: L.crest.width,
      left: L.crest.left,
      zIndex: 7,
    },
    flag: {
      position: 'absolute',
      width: L.flag.width,
      left: L.flag.left,
      zIndex: 8,
    },
    scoreWrap: {
      position: 'absolute',
      right: L.score.right,
      top: L.score.top,
      zIndex: 8,
      alignItems: 'center',
    },
    scoreValue: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    scoreLabel: {
      color: '#FFFFFF',
      fontWeight: '700',
      marginTop: 1,
    },
    name: {
      position: 'absolute',
      left: L.name.left,
      right: L.name.right,
      bottom: L.name.bottom,
      color: '#FFFFFF',
      textAlign: 'center',
      fontWeight: '700',
      zIndex: 8,
    },
    outlineStack: {
      position: 'absolute',
      left: 0,
      top: 0,
      zIndex: 9999,
      ...Platform.select({
        android: { elevation: 28 },
        default: {},
      }),
    },
    shieldOutline: {
      position: 'absolute',
      pointerEvents: 'none',
    },
    /** Name + optional pillar scores; `bottom` set in component (default uses width nudge). */
    shieldHeaderOverlay: {
      position: 'absolute',
      left: L.shieldTopName.left,
      right: L.shieldTopName.right,
      zIndex: 10000,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end',
      ...Platform.select({
        android: { elevation: 32 },
        default: {},
      }),
    },
    pillarScoresRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      width: '100%',
    },
    pillarCol: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
    },
    pillarAbbr: {
      color: PILLAR_SCORE_COLOR,
      fontWeight: '400',
      textAlign: 'center',
    },
    pillarValue: {
      color: PILLAR_SCORE_COLOR,
      fontWeight: '700',
      textAlign: 'center',
    },
    shieldTopNameText: {
      color: '#FFFFFF',
      textAlign: 'center',
      fontWeight: '700',
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 1 },
    },
  })
}
