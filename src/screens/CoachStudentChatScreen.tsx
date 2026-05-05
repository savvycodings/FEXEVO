import React, { useCallback, useContext, useMemo, useRef, useState } from 'react'
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
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LinearGradient } from 'expo-linear-gradient'
import { ThemeContext } from '../context'
import { vercel as defaultTheme } from '../theme'
import type { MyCoachTabStackParamList } from '../navigation/types'
import { authClient } from '../lib/auth-client'
import { MyCoachScoreRing } from './myCoach/ScoreRing'
import { getCachedProfile } from '../lib/profile-cache'
import { DOMAIN } from '../../constants'
import { LocalSvgAsset } from '../components/LocalSvgAsset'

const BG = '#030A17'
const CHAT_PANEL_BG = '#041641'
const FALLBACK_PEER_AVATAR = require('../../assets/coachs/img1.png')
const CHAT_MSG_ICON_SVG = require('../../assets/chat/msgicon1.svg')
const CHAT_SEND_ICON_SVG = require('../../assets/chat/sendicon1.svg')
const NEWVIDEO_SVG = require('../../assets/chat/newvideo.svg')
/** Native SVG 72×13 — scale by height for the student row. */
const NEWVIDEO_ROW_H = 16
const NEWVIDEO_ROW_W = Math.round((72 / 13) * NEWVIDEO_ROW_H)

type ChatStackNav = NativeStackNavigationProp<MyCoachTabStackParamList>
type R = RouteProp<MyCoachTabStackParamList, 'CoachStudentChat'>

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

function profileImageToAbsoluteUri(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http')) return trimmed
  const rel = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${DOMAIN.replace(/\/+$/, '')}${rel}`
}

export function CoachStudentChatScreen() {
  const { theme: ctx } = useContext(ThemeContext)
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
    pendingCoachReviewId,
    showNewVideoBadge,
  } = route.params

  const showNewVideoRow =
    showNewVideoBadge === true ||
    !!(typeof pendingCoachReviewId === 'string' && pendingCoachReviewId.trim().length > 0)

  const listRef = useRef<FlatList<ChatRow>>(null)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [myImageUri, setMyImageUri] = useState<string | null>(null)
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

  const peerAvatarSource = peerImageUri ? { uri: peerImageUri } : FALLBACK_PEER_AVATAR
  const myAvatarSource = myImageUri ? { uri: myImageUri } : FALLBACK_PEER_AVATAR

  const resolveSession = useCallback(async () => {
    const sessionResult = await authClient.getSession().catch(() => null)
    const sessionData: any = (sessionResult as any)?.data ?? sessionResult
    const uid = sessionData?.user?.id
    if (typeof uid === 'string' && uid.length > 0) setMyUserId(uid)
    const cached = await getCachedProfile().catch(() => null)
    const img = (cached as any)?.user?.image
    setMyImageUri(profileImageToAbsoluteUri(img))
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
        Alert.alert('Send failed', String(body.error))
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
      Alert.alert('Send failed', e?.message || 'Network error')
    } finally {
      setSending(false)
    }
  }, [draft, sending, peerUserId, fetchMessages])

  const renderItem = useCallback(
    ({ item }: { item: ChatRow }) => {
      const mine = myUserId != null && item.senderUserId === myUserId
      return (
        <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
          {mine ? (
            <>
              <View style={[styles.bubble, styles.bubbleMine]}>
                <Text
                  allowFontScaling={false}
                  style={[styles.bubbleText, styles.bubbleTextMine, { fontFamily: fonts.regularFont }]}
                >
                  {item.body}
                </Text>
              </View>
              <Image source={myAvatarSource} style={styles.bubbleAvatar} />
            </>
          ) : (
            <View style={[styles.bubble, styles.bubbleTheirs]}>
              <Text allowFontScaling={false} style={[styles.bubbleText, { fontFamily: fonts.regularFont }]}>
                {item.body}
              </Text>
            </View>
          )}
        </View>
      )
    },
    [fonts.regularFont, myUserId, myAvatarSource]
  )

  return (
    <View style={styles.screen}>
      <KeyboardAwareScrollView
        style={styles.keyboardWrap}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
        bottomOffset={insets.bottom + 20}
      >
        {/* ── Back button ── */}
        <View style={[styles.topPad, { paddingTop: 10 + insets.top }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
            style={styles.backRow}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Back to Students"
          >
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            <Text allowFontScaling={false} style={[styles.backLabel, { fontFamily: fonts.regularFont }]}>
              Back to Students
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── "Student" label + legend ── */}
        <View style={styles.legendBar}>
          <Text allowFontScaling={false} style={[styles.studentLabel, { fontFamily: fonts.regularFont }]}>
            Student
          </Text>
          <View style={styles.legendRight}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#2AB4FF' }]} />
              <Text allowFontScaling={false} style={[styles.legendText, { fontFamily: fonts.regularFont }]}>
                Actual Score
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3D58FF' }]} />
              <Text allowFontScaling={false} style={[styles.legendText, { fontFamily: fonts.regularFont }]}>
                Last score
              </Text>
            </View>
          </View>
        </View>

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
                  Send message to your student…
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  activeOpacity={0.85}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.chatCloseBtn}
                  accessibilityLabel="Close chat"
                >
                  <Ionicons name="close" size={20} color="#86A7D2" />
                </TouchableOpacity>
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
                  data={rows}
                  keyExtractor={(item) => item.id}
                  renderItem={renderItem}
                  contentContainerStyle={styles.listContent}
                  onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                  scrollEnabled={false}
                  ListEmptyComponent={
                    <Text allowFontScaling={false} style={[styles.emptyChat, { fontFamily: fonts.regularFont }]}>
                      No messages yet. Say hello below.
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
                    placeholder="Write your message"
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
                    style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
                    accessibilityLabel="Send message"
                  >
                    {sending ? (
                      <ActivityIndicator color="#00B8FF" size="small" />
                    ) : (
                      <LocalSvgAsset assetModule={CHAT_SEND_ICON_SVG} width={30} height={30} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      </KeyboardAwareScrollView>
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

  /* ── Top ── */
  topPad: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 24,
  },
  backLabel: {
    color: '#FFFFFF',
    fontSize: 14,
  },

  /* ── Legend bar ── */
  legendBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  studentLabel: {
    color: 'rgba(148,163,184,0.95)',
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
    color: 'rgba(200,220,255,0.9)',
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
  chatCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0E1830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Messages ── */
  listContent: {
    paddingHorizontal: 16,
    flexGrow: 1,
    paddingBottom: 8,
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
    backgroundColor: '#030A17',
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
    paddingTop: 16,
    paddingBottom: 2,
    textAlign: 'left',
    ...Platform.select({
      android: { textAlignVertical: 'top' as const },
      default: {},
    }),
  },
  sendBtn: {
    marginLeft: 8,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },
})
