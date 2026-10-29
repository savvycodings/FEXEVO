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
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext } from '../../context'
import { UI } from './tokens'

type BaseProps = {
  label: string
  onPress?: () => void
  disabled?: boolean
  loading?: boolean
  testID?: string
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}

/** Primary action: #00BBFF → #0022FF gradient with the spec glow, optional arrow badge on the right. */
export function GlowButton({
  label,
  onPress,
  disabled,
  loading,
  testID,
  style,
  accessibilityLabel,
  arrow = false,
  leadingIcon,
  height = UI.buttonHeight,
  radius = UI.radius,
}: BaseProps & {
  arrow?: boolean
  /** Icon in a dark circle on the left (e.g. `play` for "See the Correct Movement"). */
  leadingIcon?: React.ComponentProps<typeof Ionicons>['name']
  height?: number
  /** Corner radius; pass `UI.radiusPill` (or height / 2) for a pill. */
  radius?: number
}) {
  const { theme } = useContext(ThemeContext)
  const inactive = disabled || loading
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      disabled={inactive}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={[styles.outer, { height, borderRadius: radius }, disabled && styles.disabled, style]}
    >
      <LinearGradient
        colors={UI.gradient}
        locations={UI.gradientLocations}
        start={UI.gradientStart}
        end={UI.gradientEnd}
        style={[styles.fill, { paddingHorizontal: arrow || leadingIcon ? 56 : 16, borderRadius: radius - 1 }]}
      >
        {loading ? (
          <ActivityIndicator color={UI.text} />
        ) : (
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={[styles.label, { fontFamily: theme.mediumFont }]}
          >
            {label}
          </Text>
        )}
        {leadingIcon && !loading ? (
          <View style={[styles.leadingBadge, { left: (height - 36) / 2 }]} pointerEvents="none">
            <Ionicons name={leadingIcon} size={18} color={UI.text} style={styles.leadingIcon} />
          </View>
        ) : null}
        {arrow && !loading ? (
          <View style={[styles.arrowBadge, { right: (height - 40) / 2 }]} pointerEvents="none">
            <Ionicons name="arrow-forward" size={18} color={UI.text} />
          </View>
        ) : null}
      </LinearGradient>
      {/* Inset glow sits above the gradient (an inset boxShadow on the button itself would be covered by it). */}
      <View pointerEvents="none" style={[styles.innerGlow, { borderRadius: radius - 1 }]} />
    </TouchableOpacity>
  )
}

/** Secondary action on the dark navy surface (e.g. "Coach Signup"). */
export function SurfaceButton({ label, onPress, disabled, loading, testID, style, accessibilityLabel }: BaseProps) {
  const { theme } = useContext(ThemeContext)
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.surface, disabled && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={UI.text} />
      ) : (
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.label, { fontFamily: theme.mediumFont }]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  )
}

/** Square-ish back control that sits left of a primary button (setup steps). */
export function SurfaceIconButton({
  icon,
  onPress,
  accessibilityLabel,
  testID,
  size = UI.buttonHeight,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  onPress?: () => void
  accessibilityLabel: string
  testID?: string
  size?: number
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.iconBtn, { width: size + 4, height: size }]}
    >
      <Ionicons name={icon} size={26} color={UI.accent} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  outer: {
    alignSelf: 'stretch',
    borderRadius: UI.radius,
    borderWidth: 1,
    borderColor: 'rgba(53, 199, 255, 0.55)',
    boxShadow: '0px 0px 10px 0px #00B8FF, 0px 0px 15px 0px #0015D4',
  },
  fill: {
    flex: 1,
    borderRadius: UI.radius - 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: UI.radius - 1,
    boxShadow: '0px 0px 16px 0px #35C7FF inset',
  },
  label: {
    color: UI.text,
    fontSize: 17,
  },
  leadingBadge: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#050B1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadingIcon: { marginLeft: 2 },
  arrowBadge: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: UI.arrowBadge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surface: {
    alignSelf: 'stretch',
    height: UI.buttonHeight,
    borderRadius: UI.radius,
    backgroundColor: UI.surface,
    borderWidth: 1,
    borderColor: UI.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  iconBtn: {
    borderRadius: UI.radius,
    backgroundColor: UI.surface,
    borderWidth: 1,
    borderColor: UI.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
})
