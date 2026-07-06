import React, { useCallback, useContext, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext } from '../context'
import { Header } from '../components'
import { LocalSvgAsset } from '../components/LocalSvgAsset'
import type { MainStackParamList } from '../navigation/types'
import { authClient } from '../lib/auth-client'
import { navigateToActivityAnalysis } from '../lib/openActivityAnalysis'
import { useSessionData } from '../context/SessionDataContext'
import { useTranslation } from 'react-i18next'

const TICK_ICON = require('../../assets/coachs/tickicon.svg')
const MSG_ICON = require('../../assets/coachs/msgicon.svg')
const FOLLOWER_ICON = require('../../assets/coachs/followericon.svg')

const ICON_SIZE = 52

type ApiNotification = {
  id: string
  kind: string
  title: string
  body: string | null
  refType: string | null
  refId: string | null
  readAt: string | null
  createdAt: string
}

function formatNotiTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const month = d.toLocaleString('en-US', { month: 'short' }).toLowerCase()
  const day = d.getDate()
  const time = d
    .toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .toLowerCase()
  return `${month} ${day} - ${time}`
}

type Nav = NativeStackNavigationProp<MainStackParamList>

export function NotificationsScreen({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const styles = useMemo(() => getStyles(theme), [theme])

  const { invalidate: invalidateSessionData } = useSessionData()
  const [notifications, setNotifications] = useState<ApiNotification[]>([])
  const [notiLoading, setNotiLoading] = useState(true)

  const loadNotifications = useCallback(async () => {
    setNotiLoading(true)
    try {
      const res = await authClient
        .$fetch('/profile/notifications', { method: 'GET', headers: { Accept: 'application/json' } })
        .catch(() => null)
      const body = ((res as { data?: unknown })?.data ?? res) as {
        notifications?: ApiNotification[]
        error?: string
      }
      setNotifications(Array.isArray(body?.notifications) ? body.notifications : [])
    } finally {
      setNotiLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void loadNotifications()
    }, [loadNotifications])
  )

  function navigateMainTab(screen: 'AICoach' | 'You') {
    if (screen === 'You') {
      navigation.navigate('Main', {
        screen: 'You',
        params: { screen: 'YouMain' },
      })
    } else {
      navigation.navigate('Main', { screen: 'AICoach' })
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundColor }]}>
      <Header
        flatOverlay
        onBackPress={onClose}
        onProPress={() => navigation.navigate('ProSubscription')}
        onSettingsPress={() => navigation.navigate('ProfileSettings')}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollInner,
          { paddingBottom: 28 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Text allowFontScaling={false} style={styles.screenTitle}>
            {t('notifications.title')}
          </Text>
        </View>
        <View style={styles.divider} />
        {notiLoading ? (
          <ActivityIndicator color="#00BBFF" style={{ marginVertical: 24 }} />
        ) : notifications.length === 0 ? (
          <Text allowFontScaling={false} style={[styles.empty, { fontFamily: theme.regularFont }]}>
            {t('notifications.empty')}
          </Text>
        ) : (
          notifications.map((n) => {
            const icon =
              n.kind === 'coach_review_ready' && n.refType === 'coach_video_review'
                ? TICK_ICON
                : n.kind === 'coach_video_sent' && n.refType === 'coach_sent_video'
                  ? TICK_ICON
                  : n.kind === 'correction_images_ready'
                    ? TICK_ICON
                    : n.kind.includes('message')
                      ? MSG_ICON
                      : FOLLOWER_ICON
            return (
              <View key={n.id}>
                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={() => {
                    void (async () => {
                      try {
                        await authClient.$fetch(`/profile/notifications/${n.id}/read`, {
                          method: 'POST',
                        })
                      } catch {
                        /* best-effort */
                      }
                      if (
                        n.kind === 'coach_review_ready' &&
                        n.refType === 'coach_video_review' &&
                        n.refId
                      ) {
                        navigation.navigate('StudentCoachReview', {
                          reviewId: n.refId,
                          notificationId: n.id,
                        })
                        onClose()
                        return
                      }
                      if (
                        n.kind === 'coach_video_sent' &&
                        n.refType === 'coach_sent_video' &&
                        n.refId
                      ) {
                        navigation.navigate('StudentSentVideo', {
                          sentVideoId: n.refId,
                          notificationId: n.id,
                        })
                        onClose()
                        return
                      }
                      if (
                        n.kind === 'correction_images_ready' &&
                        n.refType === 'technique_analysis' &&
                        n.refId
                      ) {
                        invalidateSessionData()
                        navigateToActivityAnalysis(navigation, n.refId)
                        return
                      }
                    })()
                  }}
                  style={styles.row}
                >
                  <View style={styles.iconWrap}>
                    <LocalSvgAsset assetModule={icon} width={ICON_SIZE} height={ICON_SIZE} />
                  </View>
                  <View style={styles.textCol}>
                    <Text allowFontScaling={false} style={styles.rowTitle} numberOfLines={2}>
                      {n.title}
                    </Text>
                    {n.body ? (
                      <Text allowFontScaling={false} style={styles.rowBody} numberOfLines={2}>
                        {n.body}
                      </Text>
                    ) : null}
                    <Text allowFontScaling={false} style={styles.rowTime}>
                      {formatNotiTime(n.createdAt)}
                      {n.readAt ? t('notifications.readSuffix') : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.rowDivider} />
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

function getStyles(theme: any) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollInner: {
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    screenTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 20,
      color: theme.textColor,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: 'rgba(255,255,255,0.12)',
      marginBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 18,
      gap: 16,
    },
    rowDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: 'rgba(255,255,255,0.08)',
      marginLeft: ICON_SIZE + 16,
    },
    iconWrap: {
      width: ICON_SIZE,
      height: ICON_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textCol: {
      flex: 1,
      minWidth: 0,
    },
    rowTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: theme.textColor,
      lineHeight: 20,
    },
    rowTime: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: '#86A7D2',
      marginTop: 6,
      ...Platform.select({
        android: { includeFontPadding: false },
        default: {},
      }),
    },
    rowBody: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: 'rgba(232,240,255,0.65)',
      marginTop: 4,
      lineHeight: 18,
    },
    empty: {
      textAlign: 'center',
      color: 'rgba(232,240,255,0.5)',
      marginVertical: 28,
      fontSize: 14,
    },
  })
}
