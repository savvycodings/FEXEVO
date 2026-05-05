import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext } from '../context'
import { authClient } from '../lib/auth-client'
import { DOMAIN } from '../../constants'
import { ADMIN_HUB_GATE_PASSWORD } from '../config/adminHubGate'
import type { MainStackParamList } from '../navigation/types'
import { AdminGradientCard } from '../components/AdminGradientCard'

type Nav = NativeStackNavigationProp<MainStackParamList>
type R = RouteProp<MainStackParamList, 'AdminMembers'>

type DirectoryUser = {
  id: string
  name: string | null
  image: string | null
  username: string | null
  coachStudentRole: 'coach' | 'student' | 'none'
}

function toErrorText(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (value && typeof value === 'object') {
    const v = value as { message?: unknown; status?: unknown; statusText?: unknown }
    if (typeof v.message === 'string' && v.message.trim().length > 0) return v.message
    const status = typeof v.status === 'number' || typeof v.status === 'string' ? String(v.status) : ''
    const statusText = typeof v.statusText === 'string' ? v.statusText : ''
    if (status || statusText) return [status, statusText].filter(Boolean).join(' ')
    try {
      const json = JSON.stringify(value)
      if (json && json !== '{}') return json
    } catch {
      /* ignore */
    }
  }
  return fallback
}

function avatarUri(image: string | null): string | null {
  if (!image || typeof image !== 'string') return null
  const trimmed = image.trim()
  if (!trimmed) return null
  const base = DOMAIN.replace(/\/+$/, '')
  if (trimmed.startsWith('http')) return trimmed
  const rel = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${base}${rel}`
}

const FILTER_LABEL: Record<'all' | 'coach' | 'student', string> = {
  all: 'All members',
  coach: 'Coaches',
  student: 'Students',
}

function normalizeDirectoryUsers(raw: unknown): DirectoryUser[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: DirectoryUser[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id.trim() : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    const roleRaw = typeof row.coachStudentRole === 'string' ? row.coachStudentRole.toLowerCase() : ''
    const role: DirectoryUser['coachStudentRole'] =
      roleRaw === 'coach' ? 'coach' : roleRaw === 'student' ? 'student' : 'none'
    out.push({
      id,
      name: typeof row.name === 'string' ? row.name : null,
      image: typeof row.image === 'string' ? row.image : null,
      username: typeof row.username === 'string' ? row.username : null,
      coachStudentRole: role,
    })
  }
  return out
}

export function AdminMembersScreen() {
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const route = useRoute<R>()
  const filter = route.params?.filter ?? 'all'
  const styles = useMemo(() => getStyles(theme), [theme])

  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [grantingId, setGrantingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authClient
        .$fetch('/profile/directory?includeSelf=1', { method: 'GET', headers: { Accept: 'application/json' } })
        .catch((err) => ({ error: err?.message || 'Failed' }))
      const body = ((res as { data?: unknown })?.data ?? res) as {
        users?: DirectoryUser[]
        error?: unknown
      }
      if (!Array.isArray(body?.users)) {
        setError(toErrorText(body?.error, 'Could not load members'))
        setUsers([])
        return
      }
      setUsers(normalizeDirectoryUsers(body.users))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    if (filter === 'all') return users
    return users.filter((u) => u.coachStudentRole === filter)
  }, [users, filter])

  const onSetAsCoach = useCallback(
    (item: DirectoryUser) => {
      void (async () => {
        try {
          setGrantingId(item.id)
          const res = await authClient
            .$fetch<{ ok?: boolean; error?: string }>('/profile/admin-grant-coach', {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-Xevo-Admin-Hub-Password': ADMIN_HUB_GATE_PASSWORD,
              },
              /** Explicit JSON string avoids "[object Object]" parse errors from body-parser in web requests. */
              body: JSON.stringify({ targetUserId: item.id }) as unknown as Record<string, string>,
            })
            .catch((e) => ({ error: e?.message || 'Request failed' } as { error: string }))
          const body = ((res as { data?: unknown })?.data ?? res) as {
            ok?: boolean
            error?: unknown
          }
          if (!body?.ok) {
            setError(toErrorText(body?.error, 'Could not set coach'))
            return
          }
          setUsers((prev) =>
            prev.map((u) => (u.id === item.id ? { ...u, coachStudentRole: 'coach' } : u))
          )
          // Refresh in background to keep screen in sync.
          void load()
        } catch (e: any) {
          setError(toErrorText(e, 'Could not set coach'))
        } finally {
          setGrantingId(null)
        }
      })()
    },
    [load]
  )

  const renderRow = useCallback(
    ({ item }: { item: DirectoryUser }) => {
      if (!item?.id) return null
      const uri = avatarUri(item.image)
      const roleLabel = item.coachStudentRole === 'coach' ? 'Coach' : item.coachStudentRole === 'student' ? 'Student' : 'No role'
      const isCoach = item.coachStudentRole === 'coach'
      const busy = grantingId === item.id
      return (
        <AdminGradientCard style={styles.cardOuter}>
          <View style={styles.cardInner}>
            {uri ? (
              <Image source={{ uri }} style={styles.avatar} resizeMode="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarPh]}>
                <Ionicons name="person" size={22} color="rgba(255,255,255,0.45)" />
              </View>
            )}
            <View style={styles.textCol}>
              <Text allowFontScaling={false} style={[styles.name, { fontFamily: theme.semiBoldFont }]}>
                {item.name || 'Unnamed user'}
              </Text>
              {item.username ? (
                <Text allowFontScaling={false} style={[styles.sub, { fontFamily: theme.regularFont }]}>
                  @{item.username}
                </Text>
              ) : null}
              <Text allowFontScaling={false} style={[styles.rolePill, { fontFamily: theme.mediumFont }]}>
                {roleLabel}
              </Text>
            </View>
            {!isCoach ? (
              <TouchableOpacity
                style={[styles.setCoachBtn, busy && styles.setCoachBtnDisabled]}
                onPress={() => onSetAsCoach(item)}
                disabled={busy || grantingId !== null}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Set ${item.name ?? 'user'} as coach`}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#00BBFF" />
                ) : (
                  <Text allowFontScaling={false} style={[styles.setCoachBtnTxt, { fontFamily: theme.mediumFont }]}>
                    Set coach
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </AdminGradientCard>
      )
    },
    [grantingId, onSetAsCoach, styles, theme.mediumFont, theme.regularFont, theme.semiBoldFont]
  )

  return (
    <View style={[styles.screen, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 6, paddingBottom: 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#00BBFF" />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { fontFamily: theme.semiBoldFont }]}>{FILTER_LABEL[filter]}</Text>
        <View style={{ width: 28 }} />
      </View>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#00BBFF" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.err, { fontFamily: theme.regularFont }]}>{error}</Text>
          <TouchableOpacity onPress={() => void load()} style={styles.retry}>
            <Text style={[styles.retryTxt, { fontFamily: theme.mediumFont }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => item.id || `row-${index}`}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          removeClippedSubviews
          initialNumToRender={14}
          windowSize={7}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            <Text style={[styles.empty, { fontFamily: theme.regularFont }]}>No people in this view.</Text>
          }
        />
      )}
    </View>
  )
}

function getStyles(theme: { backgroundColor?: string; textColor?: string }) {
  return StyleSheet.create({
    screen: { flex: 1 },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    backBtn: { padding: 4 },
    topTitle: { color: theme.textColor ?? '#fff', fontSize: 17 },
    list: { padding: 16, paddingBottom: 40 },
    cardOuter: { alignSelf: 'stretch' },
    cardInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 14,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    avatarPh: { alignItems: 'center', justifyContent: 'center' },
    textCol: { flex: 1, minWidth: 0 },
    name: { color: '#FFFFFF', fontSize: 16 },
    sub: { marginTop: 2, color: 'rgba(200,220,255,0.75)', fontSize: 13 },
    rolePill: {
      marginTop: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: 'rgba(0, 187, 255, 0.15)',
      color: '#7DD3FC',
      fontSize: 11,
      letterSpacing: 0.3,
    },
    centered: { paddingVertical: 40, alignItems: 'center' },
    err: { color: '#F87171', textAlign: 'center', marginBottom: 12 },
    retry: { paddingVertical: 10, paddingHorizontal: 20 },
    retryTxt: { color: '#00BBFF', fontSize: 15 },
    empty: { textAlign: 'center', color: 'rgba(232,240,255,0.45)', marginTop: 24, fontSize: 14 },
    setCoachBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(0, 187, 255, 0.5)',
      backgroundColor: 'rgba(0, 187, 255, 0.12)',
      minWidth: 88,
      alignItems: 'center',
      justifyContent: 'center',
    },
    setCoachBtnDisabled: { opacity: 0.55 },
    setCoachBtnTxt: { color: '#7DD3FC', fontSize: 12 },
  })
}
