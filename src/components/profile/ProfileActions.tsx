import React, { useContext, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type AccessibilityState,
  type GestureResponderEvent,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext } from '../../context'
import { PG, glow } from '../../screens/progress/progressTheme'

type IconName = React.ComponentProps<typeof Ionicons>['name']

/**
 * Profile action button (coach and player profiles). `primary` is the light pill gradient with a
 * navy label (same as an active pill); `outline` is a dark navy button with a blue border.
 */
export function ProfileActionButton({
  label,
  icon,
  variant = 'outline',
  onPress,
  disabled,
  loading,
  testID,
  accessibilityLabel,
  accessibilityState,
}: {
  label: string
  icon?: IconName
  variant?: 'primary' | 'outline'
  onPress?: (e: GestureResponderEvent) => void
  disabled?: boolean
  loading?: boolean
  testID?: string
  accessibilityLabel?: string
  accessibilityState?: AccessibilityState
}) {
  const { theme } = useContext(ThemeContext)
  const primary = variant === 'primary'
  const color = primary ? PG.pillText : PG.pillIdleText
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={accessibilityState}
      testID={testID}
      style={({ pressed }) => [
        styles.btn,
        primary ? [styles.primary, glow(10, 0.7)] : styles.outline,
        pressed && { opacity: 0.85 },
      ]}
    >
      {primary ? (
        <LinearGradient
          pointerEvents="none"
          colors={[PG.pillTop, PG.pillBottom]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.fill]}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.label, { color, fontFamily: primary ? theme.semiBoldFont : theme.mediumFont }]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  )
}

/** One row of profile actions. Scrolls sideways when they don't fit, so no label is cut off. */
export function ProfileActionRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.rowScroll}
      contentContainerStyle={styles.row}
    >
      {children}
    </ScrollView>
  )
}

/** "165 Following | 3K Followers | 12 Years Exp." under the profile name. */
export function ProfileStatRow({ items }: { items: { value: string; label: string; testID?: string }[] }) {
  const { theme } = useContext(ThemeContext)
  if (items.length === 0) return null
  return (
    <View style={styles.stats}>
      {items.map((item, i) => (
        <View key={item.label} style={[styles.stat, i > 0 && styles.statDivided]}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.statValue, { fontFamily: theme.regularFont }]} testID={item.testID}>
            {item.value}
          </Text>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.statLabel, { fontFamily: theme.regularFont }]}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  btn: {
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primary: { borderWidth: 1, borderColor: 'transparent' },
  outline: { borderWidth: 1, borderColor: PG.border, backgroundColor: PG.cardTop },
  fill: { borderRadius: 18 },
  label: { fontSize: 15 },
  // Negative margin + padding: room for the primary glow, which a scroll view would clip.
  rowScroll: { marginHorizontal: -12, marginTop: 10, flexGrow: 0 },
  row: { flexGrow: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 12 },
  stats: { flexDirection: 'row', alignItems: 'stretch', marginTop: 12 },
  stat: { paddingRight: 12, minWidth: 0, flexShrink: 1 },
  statDivided: { paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: 'rgba(77, 105, 200, 0.55)' },
  statValue: { fontSize: 20, color: '#FFFFFF' },
  statLabel: { fontSize: 14, color: '#86A7D2', marginTop: 1 },
})
