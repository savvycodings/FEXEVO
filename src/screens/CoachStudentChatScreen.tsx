import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  type ImageSourcePropType,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LinearGradient } from 'expo-linear-gradient'
import { ThemeContext } from '../context'
import { useSessionData } from '../context/SessionDataContext'
import { vercel as defaultTheme } from '../theme'
import { Header } from '../components/Header'
import { MainTabBarChrome } from '../components/MainTabBarChrome'
import type { MainStackParamList, MyCoachTabStackParamList } from '../navigation/types'
import { authClient } from '../lib/auth-client'
import { MyCoachScoreRing } from './myCoach/ScoreRing'
import { getCachedProfile } from '../lib/profile-cache'
import { useTranslation } from 'react-i18next'
import Svg, { Path } from 'react-native-svg'
import { LocalSvgAsset } from '../components/LocalSvgAsset'
import {
  DEFAULT_PROFILE_PICTURE,
  hasProfileImage,
  profileImageSource,
  profileImageToAbsoluteUri,
} from '../lib/defaultProfilePicture'
import { fetchPendingCoachReviewIdForStudent } from '../lib/coachStudentPendingReview'

const BG = '#030A17'
const MUTED = '#86A7D2'
const SEND_ICON_COLOR = '#336AB4'
const CHAT_PANEL_BG = '#041641'
const CHAT_MSG_ICON_SVG = require('../../assets/chat/msgicon1.svg')
const NEWVIDEO_SVG = require('../../assets/chat/newvideo.svg')
/** Native SVG 72×13 — scale by height for the student row. */
const NEWVIDEO_ROW_H = 16
const NEWVIDEO_ROW_W = Math.round((72 / 13) * NEWVIDEO_ROW_H)

type ChatStackNav = NativeStackNavigationProp<MyCoachTabStackParamList>
type R = RouteProp<MyCoachTabStackParamList, 'CoachStudentChat'>

function ChatSendIcon({ size = 24, color = SEND_ICON_COLOR }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21.0477 3.05293C18.8697 0.707361 2.48648 6.4532 2.50001 8.551C2.51535 10.9299 8.89809 11.6617 10.6672 12.1581C11.7311 12.4565 12.016 12.7625 12.2613 13.8781C13.3723 18.9305 13.9301 21.4435 15.2014 21.4996C17.2278 21.5892 23.1733 5.342 21.0477 3.05293Z"
        stroke={color}
        strokeWidth={1.5}
      />
      <Path d="M11.5 12.5L15 9" stroke={color} strokeWidth={1.5} />
    </Svg>
  )
}

type ChatRow = {
  id: string
  senderUserId: string
  body: string
  createdAt: string
}

function unwrapFetchBody(res: unknown): Record<string, unknown> {
  return ((res as { data?: unknown })?.data ?? res) as Record<string, unknown>
}

function normalizeMessage(raw: Record<string, unknown>): ChatRow | null {
  const id = typeof raw.id === 'string' ? raw.id : null
  const senderUserId = typeof raw.senderUserId === 'string' ? raw.senderUserId : null
  const body = typeof raw.body === 'string' ? raw.body : null
  if (!id || !senderUserId || body == null) return null
  let createdAt = ''
  const ca = raw.createdAt
  if (typeof ca === 'string') createdAt = ca
  else if (ca instanceof Date) createdAt = ca.toISOString()
  else if (ca != null) createdAt = String(ca)
  return { id, senderUserId, body, createdAt }
}

export function CoachStudentChatScreen() {
  const { t } = useTranslation()
  const { theme: ctx } = useContext(ThemeContext)
  const { data: session } = authClient.useSession()
  const { profileImageUri: sessionProfileImageUri } = useSessionData()
  const theme = ctx?.backgroundColor != null ? ctx : defaultTheme
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<ChatStackNav>()
  const route = useRoute<R>()
  const {
    peerUserId,
    peerName,
    peerLocation,
    actualScore,
    lastScore,
    peerImageUri,
    pendingCoachReviewId: initialPendingCoachReviewId,
    showNewVideoBadge: _showNewVideoBadge,
    peerRole = 'student',
  } = route.params

  /** Student is viewing their coach (peer is a coach), vs. coach viewing a student. */
  const peerIsCoach = peerRole === 'coach'
  /** Header/nav actions target MainStack routes (student side is a MainStack screen). */
  const mainNav = navigation as unknown as NativeStackNavigationProp<MainStackParamList>

  const [pendingCoachReviewId, setPendingCoachReviewId] = useState<string | null>(
    typeof initialPendingCoachReviewId === 'string' && initialPendingCoachReviewId.trim().length > 0
      ? initialPendingCoachReviewId.trim()
      : null
  )

  useFocusEffect(
    useCallback(() => {
      // "New video pending review" is coach-only context; skip when the peer is a coach.
      if (peerIsCoach) return
      let cancelled = false
      void fetchPendingCoachReviewIdForStudent(peerUserId).then((id) => {
        if (!cancelled) setPendingCoachReviewId(id)
      })
      return () => {
        cancelled = true
      }
    }, [peerUserId, peerIsCoach])
  )

  const showNewVideoRow = !!pendingCoachReviewId

  const listRef = useRef<FlatList<ChatRow>>(null)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [myImageUri, setMyImageUri] = useState<string | null>(null)
  const [myAvatarSource, setMyAvatarSource] = useState<ImageSourcePropType>(DEFAULT_PROFILE_PICTURE)
  const [rows, setRows] = useState<ChatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const fonts = useMemo(
    () => ({
      regularFont: theme.regularFont,
      mediumFont: theme.mediumFont,
      semiBoldFont: theme.semiBoldFont,
    }),
    [theme.regularFont, theme.mediumFont, theme.semiBoldFont]
  )

  const peerAvatarSource = profileImageSource(peerImageUri)

  const sessionUserId =
    typeof session?.user?.id === 'string' && session.user.id.length > 0 ? session.user.id : null
  const effectiveMyUserId = sessionUserId ?? myUserId

  const myAvatarUri = useMemo(() => {
    const candidates = [
      myImageUri,
      sessionProfileImageUri,
      profileImageToAbsoluteUri(session?.user?.image),
    ]
    return candidates.find((uri) => hasProfileImage(uri)) ?? null
  }, [myImageUri, sessionProfileImageUri, session?.user?.image])

  useEffect(() => {
    setMyAvatarSource(profileImageSource(myAvatarUri))
  }, [myAvatarUri])

  const resolveSession = useCallback(async () => {
    const sessionResult = await authClient.getSession().catch(() => null)
    const sessionData: any = (sessionResult as any)?.data ?? sessionResult
    const uid = sessionData?.user?.id
    if (typeof uid === 'string' && uid.length > 0) setMyUserId(uid)
    const sessionImg = profileImageToAbsoluteUri(sessionData?.user?.image)
    if (hasProfileImage(sessionImg)) {
      setMyImageUri(sessionImg)
      return
    }
    const cached = await getCachedProfile().catch(() => null)
    const img = profileImageToAbsoluteUri((cached as any)?.user?.image)
    setMyImageUri(hasProfileImage(img) ? img : null)
  }, [])

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await authClient.$fetch(`/profile/coach-student-chat/${peerUserId}/messages`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      const body = unwrapFetchBody(res)
      const rawList = body.messages
      if (!Array.isArray(rawList)) {
        setRows([])
        setLoadError(typeof body.error === 'string' ? body.error : 'Could not load messages.')
        return
      }
      const next: ChatRow[] = []
      for (const item of rawList) {
        if (item && typeof item === 'object') {
          const n = normalizeMessage(item as Record<string, unknown>)
          if (n) next.push(n)
        }
      }
      setRows(next)
    } catch {
      setLoadError('Could not load messages.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [peerUserId])

  useFocusEffect(
    useCallback(() => {
      void resolveSession()
      void fetchMessages()
    }, [resolveSession, fetchMessages])
  )

  const onSend = useCallback(async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const res = await authClient.$fetch(`/profile/coach-student-chat/${peerUserId}/messages`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      const body = unwrapFetchBody(res)
      if (body.error) {
        Alert.alert(t('coachFlow.sendFailed'), String(body.error))
        return
      }
      const msgRaw = body.message
      if (msgRaw && typeof msgRaw === 'object') {
        const n = normalizeMessage(msgRaw as Record<string, unknown>)
        if (n) {
          setRows((prev) => [...prev, n])
          setDraft('')
          requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
          return
        }
      }
      await fetchMessages()
      setDraft('')
    } catch (e: any) {
      Alert.alert(t('coachFlow.sendFailed'), e?.message || t('coachFlow.networkError'))
    } finally {
      setSending(false)
    }
  }, [draft, sending, peerUserId, fetchMessages])

  const renderItem = useCallback(
    ({ item }: { item: ChatRow }) => {
      const mine = effectiveMyUserId != null && item.senderUserId === effectiveMyUserId
      if (mine) {
        return (
          <View style={[styles.bubbleRow, styles.bubbleRowMine]}>
            <View style={[styles.bubble, styles.bubbleMine]}>
              <Text
                allowFontScaling={false}
                style={[styles.bubbleText, styles.bubbleTextMine, { fontFamily: fonts.regularFont }]}
              >
                {item.body}
              </Text>
            </View>
            <Image
              source={myAvatarSource}
              style={styles.bubbleAvatar}
              resizeMode="cover"
              onError={() => setMyAvatarSource(DEFAULT_PROFILE_PICTURE)}
            />
          </View>
        )
      }
      return (
        <View style={[styles.bubbleRow, styles.bubbleRowTheirs]}>
          <View style={[styles.bubble, styles.bubbleTheirs]}>
            <Text allowFontScaling={false} style={[styles.bubbleText, { fontFamily: fonts.regularFont }]}>
              {item.body}
            </Text>
          </View>
        </View>
      )
    },
    [fonts.regularFont, effectiveMyUserId, myAvatarSource]
  )

  return (
    <View style={styles.screen}>
      {peerIsCoach ? (
        <Header
          onProPress={() => mainNav.navigate('ProSubscription')}
          onSettingsPress={() => mainNav.navigate('ProfileSettings')}
          onNotificationsPress={() => mainNav.navigate('Notifications')}
        />
      ) : null}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
          style={styles.backRow}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel={peerIsCoach ? t('coachChat.backToCoach') : t('coachChat.backToStudents')}
        >
          <Ionicons name="chevron-back" size={22} color={MUTED} />
          <Text allowFontScaling={false} style={[styles.backLabel, { fontFamily: fonts.regularFont }]}>
            {peerIsCoach ? t('coachChat.backToCoach') : t('coachChat.backToStudents')}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        style={styles.keyboardWrap}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
        bottomOffset={insets.bottom + 20}
      >
        {/* ── "Student" label + legend (coach view only) ── */}
        {peerIsCoach ? null : (
          <View style={styles.legendBar}>
            <Text allowFontScaling={false} style={[styles.studentLabel, { fontFamily: fonts.regularFont }]}>
              {t('coachChat.student')}
            </Text>
            <View style={styles.legendRight}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#2AB4FF' }]} />
                <Text allowFontScaling={false} style={[styles.legendText, { fontFamily: fonts.regularFont }]}>
                  {t('myCoach.actualScore')}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#3D58FF' }]} />
                <Text allowFontScaling={false} style={[styles.legendText, { fontFamily: fonts.regularFont }]}>
                  {t('myCoach.lastScore')}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Student info card (mirrors SwipeableStudentCard visually) ── */}
        <View style={styles.studentCard}>
          <Image source={peerAvatarSource} style={styles.studentAvatar} resizeMode="cover" />
          <View style={styles.studentInfo}>
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.studentName, { fontFamily: fonts.semiBoldFont }]}>
              {peerName}
            </Text>
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.studentLocation, { fontFamily: fonts.regularFont }]}>
              {peerLocation}
            </Text>
            {showNewVideoRow ? (
              <View style={styles.studentMetaRow}>
                <View style={styles.newVideoAssetWrap}>
                  <LocalSvgAsset assetModule={NEWVIDEO_SVG} width={NEWVIDEO_ROW_W} height={NEWVIDEO_ROW_H} />
                </View>
              </View>
            ) : null}
          </View>
          <MyCoachScoreRing actualScore={actualScore} lastScore={lastScore} semiBoldFont={fonts.semiBoldFont} />
        </View>

        {/* ── Chat panel with gradient border ── */}
        <View style={styles.chatPanelOuter}>
          <LinearGradient
            colors={['#1A4A8A', 'rgba(10, 30, 70, 0.6)', '#1A4A8A', 'rgba(10, 30, 70, 0.6)']}
            locations={[0, 0.33, 0.66, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.chatPanelGradient}
          >
            <View style={styles.chatPanelInner}>
              {/* Header row: msg icon + title + X — bar #022A79; X glyph #86A7D2 on #0E1830 circle */}
              <View style={styles.chatHeader}>
                <View style={styles.chatIconWrap}>
                  <LocalSvgAsset assetModule={CHAT_MSG_ICON_SVG} width={22} height={22} />
                </View>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[styles.chatTitle, { fontFamily: fonts.mediumFont }]}
                >
                  {peerIsCoach ? t('coachChat.chatTitleToCoach') : t('coachChat.chatTitle')}
                </Text>
              </View>

              {/* Messages */}
              {loading ? (
                <ActivityIndicator color="#00BBFF" style={{ marginTop: 24, marginBottom: 24 }} />
              ) : loadError ? (
                <Text allowFontScaling={false} style={[styles.errorText, { fontFamily: fonts.regularFont }]}>
                  {loadError}
                </Text>
              ) : (
                <FlatList
                  ref={listRef}
                  style={styles.messageList}
                  data={rows}
                  keyExtractor={(item) => item.id}
                  renderItem={renderItem}
                  contentContainerStyle={styles.listContent}
                  onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                  scrollEnabled={false}
                  ListEmptyComponent={
                    <Text allowFontScaling={false} style={[styles.emptyChat, { fontFamily: fonts.regularFont }]}>
                      {t('coachChat.emptyChat')}
                    </Text>
                  }
                />
              )}

              {/* Composer */}
              <View style={styles.composer}>
                <View style={styles.inputWrap}>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={t('coachChat.messagePlaceholder')}
                    placeholderTextColor="rgba(148,163,184,0.7)"
                    style={[styles.input, { fontFamily: fonts.regularFont }]}
                    multiline
                    maxLength={8000}
                    editable={!sending}
                  />
                  <TouchableOpacity
                    onPress={() => void onSend()}
                    disabled={sending || !draft.trim()}
                    activeOpacity={0.88}
                    style={styles.sendBtn}
                    accessibilityLabel="Send message"
                  >
                    {sending ? (
                      <ActivityIndicator color={SEND_ICON_COLOR} size="small" />
                    ) : (
                      <ChatSendIcon size={24} color={SEND_ICON_COLOR} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      </KeyboardAwareScrollView>
      {peerIsCoach ? <MainTabBarChrome /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  keyboardWrap: {
    flex: 1,
  },

  topBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backLabel: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 22,
    includeFontPadding: false,
  },

  /* ── Legend bar ── */
  legendBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    marginBottom: 16,
  },
  studentLabel: {
    color: MUTED,
    fontSize: 13,
  },
  legendRight: {
    flexDirection: 'row',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: MUTED,
    fontSize: 12,
  },

  /* ── Student card ── */
  studentCard: {
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  studentAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#2AB4FF',
  },
  studentInfo: {
    flex: 1,
    minWidth: 0,
  },
  studentName: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  studentLocation: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 13,
    marginTop: 2,
  },
  studentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  newVideoAssetWrap: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.25)',
  },

  /* ── Chat panel ── */
  chatPanelOuter: {
    marginHorizontal: 16,
    flex: 1,
    minHeight: 320,
  },
  chatPanelGradient: {
    borderRadius: 24,
    padding: 3.5,
    flex: 1,
  },
  chatPanelInner: {
    flex: 1,
    borderRadius: 20.5,
    backgroundColor: CHAT_PANEL_BG,
    overflow: 'hidden',
    paddingTop: 0,
    paddingBottom: 16,
  },

  /* ── Chat header ── */
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: '#022A79',
    borderTopLeftRadius: 20.5,
    borderTopRightRadius: 20.5,
  },
  chatIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#00B8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatTitle: {
    flex: 1,
    minWidth: 0,
    color: 'rgba(232,240,255,0.95)',
    fontSize: 15,
  },

  /* ── Messages ── */
  messageList: {
    width: '100%',
  },
  listContent: {
    paddingHorizontal: 16,
    flexGrow: 1,
    paddingBottom: 8,
    alignItems: 'stretch',
  },
  emptyChat: {
    color: 'rgba(148,163,184,0.8)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 16,
    paddingHorizontal: 24,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignSelf: 'stretch',
    width: '100%',
    marginBottom: 14,
    gap: 8,
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubbleRowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bubbleMine: {
    backgroundColor: '#022360',
    borderWidth: 0,
  },
  bubbleTheirs: {
    backgroundColor: 'rgba(3, 10, 23, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(51,65,85,0.55)',
  },
  bubbleText: {
    color: '#F1F5F9',
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextMine: {
    color: '#FFFFFF',
  },
  bubbleAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    flexShrink: 0,
  },

  /* ── Composer ── */
  composer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(0, 102, 255, 0.25)',
    backgroundColor: 'rgba(3, 10, 23, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    minHeight: 48,
  },
  input: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: 0,
    textAlign: 'left',
    ...Platform.select({
      android: { textAlignVertical: 'center' as const, includeFontPadding: false },
      ios: { paddingTop: 0 },
      default: {},
    }),
  },
  sendBtn: {
    marginLeft: 6,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
