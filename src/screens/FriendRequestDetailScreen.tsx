import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { Header } from '../components/Header'
import { MainTabBarChrome } from '../components/MainTabBarChrome'
import { AvatarWithFlag } from '../components/AvatarWithFlag'
import { CARD_GLOW, GlowButton, SurfaceButton, UI } from '../components/ui'
import { profileImageSource } from '../lib/defaultProfilePicture'
import {
  FriendsApiError,
  acceptRequest,
  declineRequest,
  fetchRequestDetail,
  type FriendRequestDetail,
} from '../lib/friendsApi'
import { LEVEL_OPTION_VALUES, levelTranslationKey } from '../i18n/profileOptionValues'
import type { MainStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<MainStackParamList, 'FriendRequestDetail'>
type Route = RouteProp<MainStackParamList, 'FriendRequestDetail'>

const GONE_REDIRECT_MS = 1800

function firstNameAndInitial(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return parts[0] ?? ''
  return `${parts[0]} ${parts[parts.length - 1]!.charAt(0).toUpperCase()}.`
}

/** i18n key for a stored level, matched case-insensitively; null for free text we can't map. */
function levelKey(value: string): string | null {
  const match = LEVEL_OPTION_VALUES.find((v) => v.toLowerCase() === value.trim().toLowerCase())
  return match ? levelTranslationKey(match) : null
}

/** "left" / "right" from court side, falling back to the dominant hand. */
function playingSide(d: FriendRequestDetail['sender']): 'left' | 'right' | null {
  for (const v of [d.courtSide, d.dominantHand]) {
    const s = v?.trim().toLowerCase()
    if (s === 'left' || s === 'right') return s
  }
  return null
}

/** Incoming friend request: the sender's profile with Decline / Accept Request. */
export function FriendRequestDetailScreen() {
  const { t } = useTranslation()
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])
  const { requestId } = route.params

  const [detail, setDetail] = useState<FriendRequestDetail | null>(null)
  const [gone, setGone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const goneTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const backToRequests = useCallback(
    (params: MainStackParamList['InviteSearch'] = {}) => {
      navigation.popTo('InviteSearch', { friendsView: 'requests', ...params })
    },
    [navigation],
  )

  const showGone = useCallback(() => {
    setGone(true)
    goneTimer.current = setTimeout(() => backToRequests({ removedRequestId: requestId }), GONE_REDIRECT_MS)
  }, [backToRequests, requestId])

  useEffect(() => {
    let cancelled = false
    fetchRequestDetail(requestId)
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch((e) => {
        if (cancelled) return
        if (e instanceof FriendsApiError && e.status === 404) showGone()
        else setError(t('friends.actionFailed'))
      })
    return () => {
      cancelled = true
      if (goneTimer.current) clearTimeout(goneTimer.current)
    }
  }, [requestId, showGone, t])

  async function act(kind: 'accept' | 'decline') {
    setBusy(kind)
    setError(null)
    try {
      if (kind === 'accept') await acceptRequest(requestId)
      else await declineRequest(requestId)
      backToRequests(kind === 'accept' ? { acceptedRequestId: requestId } : { removedRequestId: requestId })
    } catch (e) {
      setBusy(null)
      if (e instanceof FriendsApiError && e.status === 404) showGone()
      else setError(t('friends.actionFailed'))
    }
  }

  const sender = detail?.sender
  const side = sender ? playingSide(sender) : null
  const stats: Array<{ key: string; icon: React.ReactNode; value: string; label: string }> = []
  if (sender?.overallScore != null) {
    stats.push({
      key: 'rating',
      icon: <Ionicons name="star" size={20} color="#FFC83D" />,
      value: String(sender.overallScore),
      label: t('friends.playerRating'),
    })
  }
  if (side) {
    stats.push({
      key: 'style',
      icon: <Ionicons name={side === 'left' ? 'arrow-back-circle-outline' : 'arrow-forward-circle-outline'} size={20} color={UI.textMuted} />,
      value: side === 'left' ? t('friends.styleLeft') : t('friends.styleRight'),
      label: t('friends.playingStyle'),
    })
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Header
        flatOverlay
        onProPress={() => navigation.navigate('ProSubscription')}
        onSettingsPress={() => navigation.navigate('ProfileSettings')}
        onNotificationsPress={() => navigation.navigate('Notifications')}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : backToRequests())}
          hitSlop={10}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          testID="friend-request-detail-back"
        >
          <Ionicons name="chevron-back" size={28} color="#86A7D2" />
        </TouchableOpacity>

        {gone ? (
          <Text style={styles.message} testID="friend-request-gone">
            {t('friends.requestGone')}
          </Text>
        ) : !detail || !sender ? (
          error ? (
            <Text style={styles.message}>{error}</Text>
          ) : (
            <ActivityIndicator style={{ marginTop: 40 }} color={UI.accent} />
          )
        ) : (
          <View testID="friend-request-detail">
            <View style={styles.heroRow}>
              <AvatarWithFlag imageUri={sender.imageUri} areaLocation={sender.areaLocation} size={128} ring />
              <View style={styles.heroText}>
                <Text allowFontScaling={false} numberOfLines={2} style={styles.name}>
                  {sender.name}
                </Text>
                {sender.areaLocation ? (
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={16} color={UI.textMuted} />
                    <Text allowFontScaling={false} numberOfLines={1} style={styles.location}>
                      {sender.areaLocation}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {stats.length > 0 ? (
              <View style={styles.statsRow}>
                {stats.map((s) => (
                  <View key={s.key} style={styles.stat} testID={`friend-request-stat-${s.key}`}>
                    <View style={styles.statValueRow}>
                      {s.icon}
                      <Text allowFontScaling={false} style={styles.statValue}>
                        {s.value}
                      </Text>
                    </View>
                    <Text allowFontScaling={false} style={styles.statLabel}>
                      {s.label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {sender.level ? (
              <View style={styles.tileRow}>
                <View style={styles.tile} testID="friend-request-level">
                  <Ionicons name="stats-chart" size={22} color={UI.accent} />
                  <Text allowFontScaling={false} numberOfLines={1} style={styles.tileValue}>
                    {levelKey(sender.level) ? t(levelKey(sender.level)!) : sender.level}
                  </Text>
                  <Text allowFontScaling={false} style={styles.tileLabel}>
                    {t('friends.level')}
                  </Text>
                </View>
              </View>
            ) : null}

            {sender.about ? (
              <View style={styles.block} testID="friend-request-about">
                <Text allowFontScaling={false} style={styles.blockTitle}>
                  {t('friends.about')}
                </Text>
                <Text style={styles.about}>{sender.about}</Text>
              </View>
            ) : null}

            {detail.mutual.count > 0 ? (
              <View style={styles.block}>
                <Text allowFontScaling={false} style={styles.mutualTitle}>
                  {t('friends.mutualFriends', { count: detail.mutual.count })}
                </Text>
                <View style={styles.mutualRow}>
                  {detail.mutual.friends.slice(0, 3).map((f) => (
                    <View key={f.id} style={styles.mutualItem}>
                      <Image source={profileImageSource(f.imageUri)} style={styles.mutualAvatar} />
                      <Text allowFontScaling={false} numberOfLines={1} style={styles.mutualName}>
                        {firstNameAndInitial(f.name)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

          </View>
        )}
      </ScrollView>
      {/* Pinned between the scroll area and the tab bar so the actions are never hidden behind it. */}
      {detail && !gone ? (
        <View style={styles.footer}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.buttons}>
            <SurfaceButton
              label={t('friends.decline')}
              onPress={() => void act('decline')}
              loading={busy === 'decline'}
              disabled={busy != null}
              style={styles.declineBtn}
              testID="friend-request-detail-decline"
            />
            <GlowButton
              label={t('friends.acceptRequest')}
              onPress={() => void act('accept')}
              loading={busy === 'accept'}
              disabled={busy != null}
              radius={UI.radiusCard}
              style={styles.acceptBtn}
              testID="friend-request-detail-accept"
            />
          </View>
        </View>
      ) : null}
      <MainTabBarChrome />
    </View>
  )
}

function getStyles(theme: { backgroundColor?: string; mediumFont?: string; regularFont?: string; semiBoldFont?: string }) {
  const regular = theme.regularFont ?? 'System'
  const medium = theme.mediumFont ?? 'System'
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.backgroundColor ?? UI.pageBg },
    scrollView: { flex: 1 },
    scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
    footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
    back: { alignSelf: 'flex-start', paddingVertical: 6, marginLeft: -6 },
    message: { marginTop: 40, textAlign: 'center', color: UI.textMuted, fontFamily: regular, fontSize: 15 },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
    heroText: { flex: 1, minWidth: 0 },
    name: { fontFamily: medium, fontSize: 24, lineHeight: 30, color: '#FFFFFF' },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    location: { fontFamily: regular, fontSize: 15, color: UI.textMuted, flexShrink: 1 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 26 },
    stat: { alignItems: 'center', flex: 1 },
    statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statValue: { fontFamily: medium, fontSize: 22, color: '#FFFFFF' },
    statLabel: { fontFamily: regular, fontSize: 14, color: UI.textMuted, marginTop: 4 },
    tileRow: {
      flexDirection: 'row',
      marginTop: 22,
      borderRadius: UI.radiusCard,
      borderWidth: 1,
      borderColor: UI.cardBorder,
      backgroundColor: UI.cardBg,
      overflow: 'hidden',
      ...CARD_GLOW,
    },
    tile: { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, gap: 4 },
    tileValue: { fontFamily: medium, fontSize: 15, color: '#FFFFFF' },
    tileLabel: { fontFamily: regular, fontSize: 12, color: UI.textMuted },
    block: { marginTop: 24 },
    blockTitle: { fontFamily: medium, fontSize: 17, color: '#FFFFFF' },
    about: { fontFamily: regular, fontSize: 16, lineHeight: 22, color: UI.textMuted, marginTop: 4 },
    mutualTitle: { fontFamily: medium, fontSize: 14, color: '#FFFFFF' },
    mutualRow: { flexDirection: 'row', gap: 22, marginTop: 12 },
    mutualItem: { alignItems: 'center', gap: 6, maxWidth: 80 },
    mutualAvatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 1.5, borderColor: '#8CB0E2' },
    mutualName: { fontFamily: regular, fontSize: 14, color: '#FFFFFF' },
    error: { marginBottom: 10, color: UI.error, fontFamily: regular, fontSize: 14, textAlign: 'center' },
    buttons: { flexDirection: 'row', gap: 14 },
    declineBtn: { flex: 2 },
    acceptBtn: { flex: 3 },
  })
}
