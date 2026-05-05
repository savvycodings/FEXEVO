import React, { type ComponentProps } from 'react'
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Dimensions,
} from 'react-native'
import { LocalSvgAsset } from './LocalSvgAsset'
import { ShieldCoachCard } from './ShieldCoachCard'
import { fitShieldInBox } from './ShieldProportionalFrame'
import { proLibraryChrome } from '../theme/proLibraryChrome'

const SHARE_ICON_SVG = require('../../assets/coachs/shareicon.svg')

/** Min touch target + gutter for absolute share; shield stays centered in the row. */
const SHARE_TOUCH = 36
const SHARE_SVG = 28
const SHARE_HIT_TOP = 4
const DEFAULT_SHARE_SIDE_RESERVE = SHARE_TOUCH + 18

const { accent: ACCENT } = proLibraryChrome

const DEFAULT_MAX_HEIGHT_FRAC = 0.27
const DEFAULT_MAX_SHIELD_H_CAP = 300

export type ShieldHeroRowCardProps = Omit<
  ComponentProps<typeof ShieldCoachCard>,
  'width' | 'coachName' | 'coachImageUri'
>

export type ShieldHeroRowProps = {
  /** Full width of the hero row (typically content width inside horizontal padding). */
  rowWidth: number
  coachName: string
  coachImageUri?: string | null
  /** Renders top-right share; omit to hide and use the full row width for the shield. */
  onSharePress?: () => void
  shareAccessibilityLabel?: string
  /** Cap shield height as a fraction of window height (default 0.27). */
  maxHeightFrac?: number
  /** Upper bound for shield height in px before frac is applied (default 300). */
  maxShieldHeightCap?: number
  /** Override horizontal space reserved when share is shown (default touch + 18). */
  shareSideReserve?: number
  shieldCardProps?: ShieldHeroRowCardProps
}

/**
 * Centered shield with optional share control and the same sizing rules as Progress.
 * Reuse anywhere you need the hero shield without duplicating layout math.
 */
export function ShieldHeroRow({
  rowWidth,
  coachName,
  coachImageUri,
  onSharePress,
  shareAccessibilityLabel = 'Share',
  maxHeightFrac = DEFAULT_MAX_HEIGHT_FRAC,
  maxShieldHeightCap = DEFAULT_MAX_SHIELD_H_CAP,
  shareSideReserve = DEFAULT_SHARE_SIDE_RESERVE,
  shieldCardProps,
}: ShieldHeroRowProps) {
  const { height: winH } = useWindowDimensions()

  const shareReserve = onSharePress != null ? shareSideReserve : 0
  const maxShieldW = Math.max(1, rowWidth - shareReserve)
  const screenH = winH > 0 ? winH : Dimensions.get('window').height
  const maxShieldH = Math.min(maxShieldHeightCap, screenH * maxHeightFrac)
  const { width: shieldDisplayW, height: shieldDisplayH } = fitShieldInBox(maxShieldW, maxShieldH)

  return (
    <View style={[stylesStatic.hero, { width: rowWidth }]}>
      <View style={[stylesStatic.glow, { width: shieldDisplayW, height: shieldDisplayH }]}>
        <ShieldCoachCard
          coachName={coachName}
          coachImageUri={coachImageUri}
          width={shieldDisplayW}
          {...shieldCardProps}
        />
      </View>
      {onSharePress ? (
        <TouchableOpacity
          onPress={onSharePress}
          style={stylesStatic.shareHit}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={shareAccessibilityLabel}
        >
          <LocalSvgAsset assetModule={SHARE_ICON_SVG} width={SHARE_SVG} height={SHARE_SVG} />
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const stylesStatic = StyleSheet.create({
  hero: {
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 0,
    zIndex: 0,
  },
  glow: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    ...Platform.select({
      ios: {
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.75,
        shadowRadius: 6,
      },
      android: {
        elevation: 0,
      },
      default: {},
    }),
  },
  shareHit: {
    position: 'absolute',
    right: 0,
    top: SHARE_HIT_TOP,
    zIndex: 10,
    justifyContent: 'flex-start',
    alignItems: 'center',
    minWidth: SHARE_TOUCH + 12,
    minHeight: SHARE_TOUCH + 8,
    paddingTop: 0,
  },
})
