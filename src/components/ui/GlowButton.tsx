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
import Svg, { Path } from 'react-native-svg'
import { ThemeContext } from '../../context'
import { SECONDARY_BUTTON, UI } from './tokens'

type BaseProps = {
  label: string
  onPress?: () => void
  disabled?: boolean
  loading?: boolean
  testID?: string
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
  /** Side padding. Defaults to the spec's 35px; pass less when two buttons share a row (e.g. a confirm dialog). */
  paddingX?: number
}

/** Arrow after the primary label (design SVG, 32×32, navy stroke). */
function ArrowIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
      <Path
        d="M24.6695 16L6.66943 16"
        stroke={UI.btnPrimaryText}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17.3359 8C17.3359 8 25.3358 13.8919 25.3359 16C25.3359 18.1083 17.3359 24 17.3359 24"
        stroke={UI.btnPrimaryText}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** The primary-button gradient as an absolute fill. Use it for any custom-shaped primary control (pills, round icon buttons). */
export function PrimaryFill({ radius }: { radius?: number }) {
  return (
    <LinearGradient
      colors={UI.btnPrimaryGradient}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, radius != null && { borderRadius: radius }]}
    />
  )
}

/** Primary action: `#A9D8FF → #4DA6FF` vertical gradient with a dark navy label, optional arrow badge on the right. */
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
  radius = UI.btnRadius,
  paddingX = UI.btnPaddingX,
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
        colors={UI.btnPrimaryGradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.fill, { paddingHorizontal: leadingIcon ? 56 : paddingX, borderRadius: radius }]}
      >
        {loading ? (
          <ActivityIndicator color={UI.btnPrimaryText} />
        ) : (
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            style={[styles.label, styles.primaryLabel, { fontFamily: theme.semiBoldFont }]}
          >
            {label}
          </Text>
        )}
        {/* Design: the arrow sits right after the label (10px gap), centred together, no badge. */}
        {arrow && !loading ? (
          <View style={styles.arrowSlot} pointerEvents="none">
            <ArrowIcon />
          </View>
        ) : null}
        {leadingIcon && !loading ? (
          <View style={[styles.leadingBadge, { left: (height - 36) / 2 }]} pointerEvents="none">
            <Ionicons name={leadingIcon} size={18} color={UI.text} style={styles.leadingIcon} />
          </View>
        ) : null}
      </LinearGradient>
    </TouchableOpacity>
  )
}

/** Secondary action on the dark navy surface (e.g. "Coach Signup"). */
export function SurfaceButton({
  label,
  onPress,
  disabled,
  loading,
  testID,
  style,
  accessibilityLabel,
  paddingX = UI.btnPaddingX,
}: BaseProps) {
  const { theme } = useContext(ThemeContext)
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.surface, { paddingHorizontal: paddingX }, disabled && styles.disabled, style]}
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

/** Text-only action (e.g. welcome "Login"): full width, radius 20, 35px side padding, `#86A7D2` Inter 500 18px. */
export function TextButton({ label, onPress, disabled, testID, style, accessibilityLabel }: BaseProps) {
  const { theme } = useContext(ThemeContext)
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.textBtn, disabled && styles.disabled, style]}
    >
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.textBtnLabel, { fontFamily: theme.mediumFont }]}>
        {label}
      </Text>
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
    borderRadius: UI.btnRadius,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
    borderRadius: UI.btnRadius,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: UI.btnSecondaryText,
    fontSize: 18,
    flexShrink: 1,
  },
  primaryLabel: {
    color: UI.btnPrimaryText,
  },
  /** Keep the arrow from being compressed so the label shrinks/fits instead of ellipsizing. */
  arrowSlot: { flexShrink: 0 },
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
  surface: {
    alignSelf: 'stretch',
    height: UI.buttonHeight,
    borderRadius: UI.btnRadius,
    ...SECONDARY_BUTTON,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: UI.btnPaddingX,
  },
  iconBtn: {
    borderRadius: UI.btnRadius,
    ...SECONDARY_BUTTON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBtn: {
    alignSelf: 'stretch',
    minHeight: 44,
    borderRadius: UI.btnRadius,
    paddingHorizontal: UI.btnPaddingX,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBtnLabel: {
    color: UI.btnTextColor,
    fontSize: 18,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
})
