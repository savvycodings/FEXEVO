import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Video, ResizeMode } from 'expo-av'
import { ThemeContext } from '../context'
import { useTranslation } from 'react-i18next'
import { authClient } from '../lib/auth-client'
import { DOMAIN } from '../../constants'
import type { MainStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<MainStackParamList>
type R = RouteProp<MainStackParamList, 'StudentSentVideo'>

type SentVideoPayload = {
  id: string
  videoPath: string
  coachName: string
  category: string | null
  strokePreset: string | null
  shotLabel: string | null
  skillLevel: string | null
  viewId: string | null
  note: string | null
  createdAt: string | null
}

export function StudentSentVideoScreen() {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const navigation = useNavigation<Nav>()
  const route = useRoute<R>()
  const { sentVideoId, notificationId } = route.params
  const styles = useMemo(() => getStyles(theme), [theme])

  const [loading, setLoading] = useState(true)
  const [sent, setSent] = useState<SentVideoPayload | null>(null)

  const videoUri = useMemo(() => {
    if (!sent?.videoPath) return null
    const base = DOMAIN.replace(/\/+$/, '')
    const p = sent.videoPath.startsWith('/') ? sent.videoPath : `/${sent.videoPath}`
    return `${base}${p}`
  }, [sent?.videoPath])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authClient
        .$fetch(`/coach/sent-video/${encodeURIComponent(sentVideoId)}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        .catch(() => null)
      const body = ((res as { data?: unknown })?.data ?? res) as {
        sentVideo?: SentVideoPayload
        error?: string
      }
      if (!body?.sentVideo) {
        Alert.alert(
          t('commonAlerts.unavailable'),
          body?.error || t('coachFlow.couldNotLoadSentVideo')
        )
        navigation.goBack()
        return
      }
      setSent(body.sentVideo)
    } finally {
      setLoading(false)
    }
  }, [navigation, sentVideoId, t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!notificationId) return
    void authClient
      .$fetch(`/profile/notifications/${encodeURIComponent(notificationId)}/read`, {
        method: 'POST',
      })
      .catch(() => null)
  }, [notificationId])

  if (loading || !sent) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator size="large" color="#00BBFF" />
      </View>
    )
  }

  const metaChips = [sent.shotLabel, sent.skillLevel].filter(
    (x): x is string => !!x && x.trim().length > 0
  )

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.backgroundColor }]}
      contentContainerStyle={styles.inner}
    >
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.backRow}
        accessibilityLabel={t('coachFlow.back')}
      >
        <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        <Text allowFontScaling={false} style={[styles.backLabel, { fontFamily: theme.mediumFont }]}>
          {t('coachFlow.back')}
        </Text>
      </TouchableOpacity>

      <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.semiBoldFont }]}>
        {t('coachFlow.sentVideoTitle', { coach: sent.coachName })}
      </Text>

      {metaChips.length > 0 ? (
        <View style={styles.chipRow}>
          {metaChips.map((chip) => (
            <View key={chip} style={styles.chip}>
              <Text allowFontScaling={false} style={[styles.chipText, { fontFamily: theme.mediumFont }]}>
                {chip}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {videoUri ? (
        <Video
          source={{ uri: videoUri }}
          style={styles.video}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
        />
      ) : null}

      {sent.note?.trim() ? (
        <>
          <Text allowFontScaling={false} style={[styles.sectionTitle, { fontFamily: theme.mediumFont }]}>
            {t('coachFlow.sentVideoNote')}
          </Text>
          <Text allowFontScaling={false} style={[styles.body, { fontFamily: theme.regularFont }]}>
            {sent.note}
          </Text>
        </>
      ) : null}
    </ScrollView>
  )
}

function getStyles(theme: { backgroundColor?: string }) {
  return StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    inner: { padding: 20, paddingBottom: 40 },
    backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
    backLabel: { color: '#00BBFF', fontSize: 15 },
    title: { color: '#FFFFFF', fontSize: 22, marginBottom: 12, lineHeight: 28 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(0,187,255,0.4)',
      backgroundColor: 'rgba(8, 22, 58, 0.6)',
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    chipText: { color: '#8BCBFF', fontSize: 12, lineHeight: 16 },
    video: {
      width: '100%',
      aspectRatio: 9 / 16,
      maxHeight: 420,
      borderRadius: 12,
      backgroundColor: '#000',
      marginBottom: 20,
    },
    sectionTitle: { color: 'rgba(255,255,255,0.88)', fontSize: 14, marginTop: 8, marginBottom: 6 },
    body: { color: 'rgba(232,240,255,0.9)', fontSize: 15, lineHeight: 22 },
  })
}
