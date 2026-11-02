import React, { useContext } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import type { FriendRequest } from '../lib/friendsApi'
import { AvatarWithFlag } from './AvatarWithFlag'
import { MutualFriendsStack } from './MutualFriendsStack'
import { CARD_GLOW, PRIMARY_GLOW, UI } from './ui'

export type FriendRequestCardState = 'pending' | 'busy' | 'accepted'

const AVATAR = 64
const ACTION = 40
const ACCEPTED_GREEN = '#6CF29A'

/**
 * One incoming friend request. The avatar + text area opens the detail screen; the ✕ / ✓
 * buttons are siblings of it (not children), so tapping them never navigates.
 */
export function FriendRequestCard({
  request,
  state,
  onOpen,
  onAccept,
  onDecline,
}: {
  request: FriendRequest
  state: FriendRequestCardState
  onOpen?: () => void
  onAccept?: () => void
  onDecline?: () => void
}) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const { sender } = request
  return (
    <View style={styles.card} testID={`friend-request-${request.id}`}>
      <TouchableOpacity
        style={styles.body}
        activeOpacity={0.85}
        onPress={onOpen}
        disabled={!onOpen}
        accessibilityRole="button"
        accessibilityLabel={sender.name}
        testID={`friend-request-open-${request.id}`}
      >
        <AvatarWithFlag imageUri={sender.imageUri} areaLocation={sender.areaLocation} size={AVATAR} />
        <View style={styles.textCol}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.name, { fontFamily: theme.mediumFont }]}>
            {sender.name}
          </Text>
          {sender.areaLocation ? (
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.location, { fontFamily: theme.regularFont }]}>
              {sender.areaLocation}
            </Text>
          ) : null}
          <MutualFriendsStack mutual={request.mutual} />
        </View>
      </TouchableOpacity>

      {state === 'accepted' ? (
        <View style={styles.acceptedPill} testID={`friend-request-accepted-${request.id}`}>
          <Ionicons name="checkmark-circle" size={20} color={ACCEPTED_GREEN} />
          <Text allowFontScaling={false} style={[styles.acceptedText, { fontFamily: theme.mediumFont }]}>
            {t('friends.accepted')}
          </Text>
        </View>
      ) : state === 'busy' ? (
        <View style={styles.actions}>
          <ActivityIndicator color={UI.accent} />
        </View>
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.declineBtn}
            onPress={onDecline}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('friends.decline')}
            testID={`friend-request-decline-${request.id}`}
          >
            <Ionicons name="close" size={22} color={UI.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={onAccept}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('friends.accept')}
            testID={`friend-request-accept-${request.id}`}
          >
            <LinearGradient
              colors={UI.gradient}
              locations={UI.gradientLocations}
              start={UI.gradientStart}
              end={UI.gradientEnd}
              style={[StyleSheet.absoluteFill, styles.round]}
            />
            <Ionicons name="checkmark" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: UI.radiusCard,
    borderWidth: 1,
    borderColor: UI.cardBorder,
    backgroundColor: UI.cardBg,
    ...CARD_GLOW,
  },
  body: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  textCol: { flex: 1, minWidth: 0 },
  name: { fontSize: 18, lineHeight: 22, color: '#FFFFFF' },
  location: { fontSize: 13, color: UI.textMuted, marginTop: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: ACTION },
  round: { borderRadius: ACTION / 2 },
  declineBtn: {
    width: ACTION,
    height: ACTION,
    borderRadius: ACTION / 2,
    borderWidth: 1,
    borderColor: UI.surfaceBorder,
    backgroundColor: UI.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    width: ACTION,
    height: ACTION,
    borderRadius: ACTION / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...PRIMARY_GLOW,
  },
  acceptedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: ACCEPTED_GREEN,
    backgroundColor: 'rgba(108, 242, 154, 0.12)',
    boxShadow: '0px 0px 10px 0px rgba(108, 242, 154, 0.45)',
  },
  acceptedText: { fontSize: 14, color: ACCEPTED_GREEN },
})
