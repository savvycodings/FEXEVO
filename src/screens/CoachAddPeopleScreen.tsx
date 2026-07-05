import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  FlatList,
  Alert,
} from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext } from '../context'
import { useTranslation } from 'react-i18next'
import { Header } from '../components'
import { getCachedProfile } from '../lib/profile-cache'
import { DOMAIN, mainHeaderKeyboardOffset } from '../../constants'
import { authClient } from '../lib/auth-client'
import type { MainStackParamList } from '../navigation/types'
import { profileImageSource } from '../lib/defaultProfilePicture'

type Nav = NativeStackNavigationProp<MainStackParamList>

type DirectoryUser = {
  id: string
  name: string
  image: string | null
  username: string | null
  coachStudentRole?: string
}

function avatarUri(image: string | null): string | null {
  if (!image || typeof image !== 'string') return null
  const base = DOMAIN.replace(/\/+$/, '')
  const trimmed = image.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http')) return trimmed
  const rel = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${base}${rel}`
}

export function CoachAddPeopleScreen() {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const [filter, setFilter] = useState('')
  const [profileName, setProfileName] = useState('Player')
  const [profileRank, setProfileRank] = useState('No rank yet')
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null)
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [addingUserId, setAddingUserId] = useState<string | null>(null)
  const styles = useMemo(() => getStyles(theme), [theme])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      if (u.name.toLowerCase().includes(q)) return true
      if (u.username && u.username.toLowerCase().includes(q)) return true
      return false
    })
  }, [users, filter])

  const loadDirectory = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await authClient
        .$fetch('/profile/directory', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        .catch((err) => ({ error: err?.message || 'Request failed' }))
      const body = ((res as { data?: unknown })?.data ?? res) as {
        users?: DirectoryUser[]
        error?: string
      }
      if (body?.error || !Array.isArray(body.users)) {
        setLoadError(body?.error || t('coachAdd.couldNotLoadPeople'))
        setUsers([])
        return
      }
      setUsers(body.users)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadDirectory()
  }, [loadDirectory])

  useEffect(() => {
    let mounted = true
    void getCachedProfile().then((cached) => {
      if (!mounted || !cached?.user) return
      setProfileName(cached.user?.name || t('coachAdd.player'))
      const levelText =
        cached?.profile?.level ||
        (cached?.profile?.rankingOrg && cached?.profile?.rankingValue
          ? `${cached.profile.rankingOrg}: ${cached.profile.rankingValue}`
          : t('coachAdd.noRankYet'))
      setProfileRank(levelText)
      const raw = cached.user?.image
      if (typeof raw === 'string' && raw.length > 0) {
        const normalized = raw.startsWith('http')
          ? raw
          : `${DOMAIN.replace(/\/+$/, '')}${raw}`
        setProfileImageUri(`${normalized}${normalized.includes('?') ? '&' : '?'}t=${Date.now()}`)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

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

  const onPickPerson = useCallback(
    async (u: DirectoryUser) => {
      if (addingUserId) return
      setAddingUserId(u.id)
      try {
        const res = await authClient
          .$fetch<{ ok?: boolean; error?: string }>('/profile/coach-students', {
            method: 'POST',
            body: { studentUserId: u.id } as Record<string, string>,
          })
          .catch((err) => ({ error: err?.message || 'Request failed' } as { error: string }))
        const body = ((res as { data?: unknown })?.data ?? res) as {
          ok?: boolean
          error?: string
        }
        if (!body?.ok) {
          Alert.alert(t('coachFlow.couldNotAddStudent'), body?.error || t('coachFlow.couldNotAddStudent'))
          return
        }
        Alert.alert(t('coachFlow.studentAdded'), t('coachFlow.studentAddedBody', { name: u.name }), [
          { text: t('commonAlerts.ok'), onPress: () => navigation.goBack() },
        ])
      } finally {
        setAddingUserId(null)
      }
    },
    [addingUserId, navigation]
  )

  const renderRow = useCallback(
    ({ item }: { item: DirectoryUser }) => {
      const uri = avatarUri(item.image)
      const busy = addingUserId === item.id
      return (
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.85}
          onPress={() => void onPickPerson(item)}
          disabled={!!addingUserId}
          accessibilityLabel={t('coachAdd.addPerson', { name: item.name })}
        >
          <Image
            source={profileImageSource(uri)}
            style={styles.rowAvatar}
            resizeMode="cover"
          />
          <View style={styles.rowText}>
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.rowName, { fontFamily: theme.semiBoldFont }]}>
              {item.name}
            </Text>
            {item.username ? (
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.rowSub, { fontFamily: theme.regularFont }]}>
                @{item.username}
              </Text>
            ) : (
              <Text allowFontScaling={false} style={[styles.rowSubMuted, { fontFamily: theme.regularFont }]}>
                No username
              </Text>
            )}
          </View>
          {busy ? (
            <ActivityIndicator size="small" color="#00BBFF" />
          ) : (
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.35)" />
          )}
        </TouchableOpacity>
      )
    },
    [addingUserId, onPickPerson, styles, theme.regularFont, theme.semiBoldFont]
  )

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundColor }]}>
      <Header
        flatOverlay
        onProPress={() => navigation.navigate('ProSubscription')}
        onProfilePress={() => navigateMainTab('You')}
        profileName={profileName}
        profileRank={profileRank}
        profileImageUri={profileImageUri}
        onSettingsPress={() => navigation.navigate('ProfileSettings')}
      />
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
        keyboardVerticalOffset={mainHeaderKeyboardOffset(insets.top)}
      >
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel={t('coachAdd.goBack')}
            style={styles.backHit}
          >
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <Text allowFontScaling={false} style={[styles.screenTitle, { fontFamily: theme.semiBoldFont }]}>
            Add student or member
          </Text>
        </View>
        <View style={styles.divider} />
        <TextInput
          value={filter}
          onChangeText={setFilter}
          placeholder={t('common.filterByName')}
          placeholderTextColor="rgba(255,255,255,0.35)"
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { fontFamily: theme.regularFont }]}
        />
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#00BBFF" />
          </View>
        ) : loadError ? (
          <View style={styles.centered}>
            <Text allowFontScaling={false} style={[styles.errorText, { fontFamily: theme.regularFont }]}>
              {loadError}
            </Text>
            <TouchableOpacity onPress={() => void loadDirectory()} style={styles.retryBtn}>
              <Text allowFontScaling={false} style={[styles.retryText, { fontFamily: theme.mediumFont }]}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderRow}
            contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
            ListEmptyComponent={
              <Text allowFontScaling={false} style={[styles.empty, { fontFamily: theme.regularFont }]}>
                {users.length === 0 ? 'No other members yet.' : 'No matches for that filter.'}
              </Text>
            }
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>
      </KeyboardAvoidingView>
    </View>
  )
}

function getStyles(theme: { backgroundColor?: string; textColor?: string }) {
  const fg = theme.textColor ?? '#E8F0FF'
  return StyleSheet.create({
    root: { flex: 1 },
    body: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    backHit: { paddingVertical: 4, marginRight: 4 },
    screenTitle: { flex: 1, color: '#FFFFFF', fontSize: 22 },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: 'rgba(255,255,255,0.12)',
      marginTop: 12,
      marginBottom: 12,
    },
    input: {
      borderWidth: 1,
      borderColor: 'rgba(0,187,255,0.35)',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: fg,
      backgroundColor: 'rgba(10,22,53,0.6)',
      marginBottom: 12,
    },
    centered: { paddingVertical: 32, alignItems: 'center' },
    errorText: { color: '#F87171', textAlign: 'center', marginBottom: 12 },
    retryBtn: { paddingVertical: 10, paddingHorizontal: 20 },
    retryText: { color: '#00BBFF', fontSize: 15 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    rowAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    rowAvatarPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: { flex: 1, minWidth: 0 },
    rowName: { color: '#FFFFFF', fontSize: 16 },
    rowSub: { marginTop: 2, color: 'rgba(200,220,255,0.75)', fontSize: 13 },
    rowSubMuted: { marginTop: 2, color: 'rgba(200,220,255,0.4)', fontSize: 13 },
    empty: {
      textAlign: 'center',
      color: 'rgba(232,240,255,0.45)',
      marginTop: 24,
      fontSize: 14,
    },
  })
}
