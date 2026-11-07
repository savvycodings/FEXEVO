import React, { useContext } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { clubLogoUri, type ClubInvite } from '../lib/clubsApi'
import { ClubPfpImage } from './ClubPfpImage'
import { CARD_GLOW, PrimaryFill, UI } from './ui'

export type ClubRequestCardState = 'pending' | 'busy' | 'accepted'

const LOGO_OUTER = 64
const LOGO_RING = 3
const ACTION = 40
const ACCEPTED_GREEN = '#6CF29A'

/**
 * One pending club invite, styled like FriendRequestCard: the club's round logo on white, its
 * name, "City, Country" and member count. The logo + text area opens the club; the ✕ / ✓
 * buttons are siblings of it, so tapping them never navigates.
 */
export function ClubRequestCard({
  invite,
  state,
  onOpen,
  onAccept,
  onDecline,
}: {
  invite: ClubInvite
  state: ClubRequestCardState
  onOpen?: () => void
  onAccept?: () => void
  onDecline?: () => void
}) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const { club } = invite
  const place = [club.city, club.country].filter(Boolean).join(', ')
  return (
    <View style={styles.card} testID={`club-request-${invite.id}`}>
      <TouchableOpacity
        style={styles.body}
        activeOpacity={0.85}
        onPress={onOpen}
        disabled={!onOpen}
        accessibilityRole="button"
        accessibilityLabel={club.name}
        testID={`club-request-open-${invite.id}`}
      >
        <View style={styles.logoRing}>
          <ClubPfpImage uri={clubLogoUri(club)} size={LOGO_OUTER - LOGO_RING * 2} fallbackLabel={club.name} />
        </View>
        <View style={styles.textCol}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.name, { fontFamily: theme.mediumFont }]}>
            {club.name}
          </Text>
          {place ? (
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.location, { fontFamily: theme.regularFont }]}>
              {place}
            </Text>
          ) : null}
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.members, { fontFamily: theme.regularFont }]}
            testID={`club-request-members-${invite.id}`}
          >
            {t('clubMembership.members', { count: club.memberCount })}
          </Text>
        </View>
      </TouchableOpacity>

      {state === 'accepted' ? (
        <View style={styles.acceptedPill} testID={`club-request-accepted-${invite.id}`}>
          <Ionicons name="checkmark-circle" size={20} color={ACCEPTED_GREEN} />
          <Text allowFontScaling={false} style={[styles.acceptedText, { fontFamily: theme.mediumFont }]}>
            {t('clubMembership.accepted')}
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
            accessibilityLabel={t('clubMembership.decline')}
            testID={`club-request-decline-${invite.id}`}
          >
            <Ionicons name="close" size={22} color={UI.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={onAccept}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('clubMembership.accept')}
            testID={`club-request-accept-${invite.id}`}
          >
            <PrimaryFill radius={ACTION / 2} />
            <Ionicons name="checkmark" size={22} color={UI.btnPrimaryText} />
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
  logoRing: {
    width: LOGO_OUTER,
    height: LOGO_OUTER,
    borderRadius: LOGO_OUTER / 2,
    backgroundColor: '#FFFFFF',
    padding: LOGO_RING,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  textCol: { flex: 1, minWidth: 0 },
  name: { fontSize: 18, lineHeight: 22, color: '#FFFFFF' },
  location: { fontSize: 13, color: UI.textMuted, marginTop: 1 },
  members: { fontSize: 12, color: UI.textMuted, marginTop: 6 },
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
