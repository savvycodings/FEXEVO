import React, { useContext } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { LocalSvgAsset, prefetchSvgAssets } from '../LocalSvgAsset'
import { ThemeContext } from '../../context'
import type { SocialProvider } from '../../lib/socialAuth'
import { UI, CARD_GLOW } from './tokens'

/** Rounded glass card used for grouped content (setup questions, sign-up prompt). */
export function GlassCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, CARD_GLOW, style]}>{children}</View>
}

/** Faint radial wash at the top of auth screens. `id` must be unique per mounted screen (web SVG ids are global). */
export function AuthBackdrop({ id }: { id: string }) {
  return (
    <Svg pointerEvents="none" style={styles.backdrop}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="-20%" rx="110%" ry="90%">
          <Stop offset="0%" stopColor={UI.pageGlow} stopOpacity={1} />
          <Stop offset="100%" stopColor={UI.pageGlow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  )
}

/** "—— Or log in with ——" */
export function OrDivider({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) {
  const { theme } = useContext(ThemeContext)
  return (
    <View style={[styles.dividerRow, style]}>
      <View style={styles.dividerLine} />
      <Text allowFontScaling={false} style={[styles.dividerText, { fontFamily: theme.regularFont }]}>
        {label}
      </Text>
      <View style={styles.dividerLine} />
    </View>
  )
}

/** Brand marks (full-color Google G, Facebook f, white Apple) from `assets/social`. */
const SOCIAL_ICON: Record<SocialProvider, { asset: number; width: number; height: number; spinner: string }> = {
  google: { asset: require('../../../assets/social/google.svg'), width: 28, height: 28, spinner: '#FFFFFF' },
  facebook: { asset: require('../../../assets/social/facebook.svg'), width: 28, height: 28, spinner: '#4F7BFF' },
  apple: { asset: require('../../../assets/social/apple.svg'), width: 22, height: 28, spinner: '#FFFFFF' },
}
prefetchSvgAssets(Object.values(SOCIAL_ICON).map((i) => i.asset))

/** Row of pill buttons, one per enabled provider. */
export function SocialAuthRow({
  providers,
  loading,
  disabled,
  onPress,
  style,
}: {
  providers: SocialProvider[]
  loading: SocialProvider | null
  disabled?: boolean
  onPress: (provider: SocialProvider) => void
  style?: StyleProp<ViewStyle>
}) {
  if (providers.length === 0) return null
  return (
    <View style={[styles.socialRow, style]}>
      {providers.map((provider) => {
        const icon = SOCIAL_ICON[provider]
        return (
          <TouchableOpacity
            key={provider}
            style={[styles.socialButton, (disabled || !!loading) && loading !== provider && styles.dim]}
            activeOpacity={0.85}
            onPress={() => onPress(provider)}
            disabled={disabled || !!loading}
            accessibilityRole="button"
            accessibilityLabel={provider}
          >
            {loading === provider ? (
              <ActivityIndicator color={icon.spinner} size="small" />
            ) : (
              <LocalSvgAsset assetModule={icon.asset} width={icon.width} height={icon.height} />
            )}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

/** Centered text link ("Forgot my password?", "Login"). */
export function TextLink({
  label,
  onPress,
  testID,
  disabled,
  muted = false,
  style,
}: {
  label: string
  onPress?: () => void
  testID?: string
  disabled?: boolean
  /** Muted grey-blue (welcome "Login") instead of the accent blue. */
  muted?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const { theme } = useContext(ThemeContext)
  return (
    <TouchableOpacity
      style={[styles.link, style]}
      onPress={onPress}
      testID={testID}
      disabled={disabled || !onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      hitSlop={{ top: 6, bottom: 6, left: 12, right: 12 }}
    >
      <Text
        allowFontScaling={false}
        style={[styles.linkText, { fontFamily: theme.mediumFont, color: muted ? UI.textMuted : UI.accent }]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: UI.cardBg,
    borderRadius: UI.radiusCard,
    paddingVertical: 24,
    paddingHorizontal: 19,
    gap: 10,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 460,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: UI.divider,
  },
  dividerText: {
    fontSize: 14,
    color: UI.textSubtle,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
  },
  socialButton: {
    flex: 1,
    height: 54,
    borderRadius: UI.radiusPill,
    backgroundColor: UI.surface,
    borderWidth: 1,
    borderColor: UI.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: {
    opacity: 0.55,
  },
  link: {
    alignSelf: 'center',
    paddingVertical: 6,
  },
  linkText: {
    fontSize: 15,
  },
})
