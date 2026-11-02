import React, { useContext, useEffect, useRef, useState } from 'react'
import { Alert, Platform, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { SELECTED_GLOW, UI } from './ui'
import { authClient } from '../lib/auth-client'
import { followTarget, unfollowTarget, type FollowTargetType } from '../lib/followsApi'

export type FollowButtonProps = {
  targetType: FollowTargetType
  /** Coach user id, or ISO alpha-2 country code. */
  targetId: string
  /** Used in the accessibility label ("Follow David Golman"). */
  targetName: string
  /** Initial state; later changes (e.g. a refresh on focus) are picked up when idle. */
  following: boolean
  onChange?: (following: boolean, followerCount: number | null) => void
  size?: 'sm' | 'md'
  testID?: string
}

/**
 * Follow / Following pill for any follow target. Flips at once, sends the request, and flips
 * back with an alert if it fails; taps during a request are ignored. Renders nothing for the
 * signed-in user's own id. Inside a tappable card it takes the touch, so the card doesn't open.
 */
export function FollowButton({
  targetType,
  targetId,
  targetName,
  following: initial,
  onChange,
  size = 'md',
  testID,
}: FollowButtonProps) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const { data: session } = authClient.useSession()
  const [following, setFollowing] = useState(initial)
  const pending = useRef(false)

  useEffect(() => {
    if (!pending.current) setFollowing(initial)
  }, [initial])

  const myId = session?.user?.id
  if (targetType === 'coach' && myId && myId === targetId) return null

  const onPress = async (e?: GestureResponderEvent) => {
    if (Platform.OS === 'web') e?.stopPropagation?.()
    if (pending.current) return
    pending.current = true
    const next = !following
    setFollowing(next)
    onChange?.(next, null)
    try {
      const state = next ? await followTarget(targetType, targetId) : await unfollowTarget(targetType, targetId)
      setFollowing(state.following)
      onChange?.(state.following, state.followerCount)
    } catch {
      setFollowing(!next)
      onChange?.(!next, null)
      Alert.alert(t('follow.errorTitle'), t('follow.errorBody'))
    } finally {
      pending.current = false
    }
  }

  const sm = size === 'sm'
  const label = following ? t('follow.following') : t('follow.follow')
  return (
    <Pressable
      onPress={(e) => void onPress(e)}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: following }}
      accessibilityLabel={
        following ? t('follow.unfollowA11y', { name: targetName }) : t('follow.followA11y', { name: targetName })
      }
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        sm ? styles.sm : styles.md,
        following ? styles.outlined : null,
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      {following ? null : (
        <>
          <LinearGradient
            colors={UI.gradient}
            locations={UI.gradientLocations}
            start={UI.gradientStart}
            end={UI.gradientEnd}
            style={[StyleSheet.absoluteFill, styles.fill]}
          />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.fill, SELECTED_GLOW]} />
        </>
      )}
      {following ? <Ionicons name="checkmark" size={sm ? 14 : 16} color={UI.textMuted} /> : null}
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[
          sm ? styles.labelSm : styles.labelMd,
          { fontFamily: theme.semiBoldFont, color: following ? UI.textMuted : '#FFFFFF' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: UI.radiusPill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sm: { height: 34, paddingHorizontal: 14, minWidth: 78 },
  md: { height: 50, paddingHorizontal: 18, minWidth: 110 },
  outlined: { backgroundColor: UI.cardBg, borderColor: UI.trackBorder },
  fill: { borderRadius: UI.radiusPill },
  labelSm: { fontSize: 14 },
  labelMd: { fontSize: 16 },
})
