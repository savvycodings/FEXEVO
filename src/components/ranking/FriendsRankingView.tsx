import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../../context'
import { GlowButton, SELECTED_GLOW, UI } from '../ui'
import { findCountry } from '../../lib/countries'
import { resolveUploadUrl } from '../../lib/mediaUrl'
import {
  fetchCountryRanking,
  fetchPlayerRanking,
  type PlayerRankingResponse,
  type RankedCountry,
  type RankedPlayer,
} from '../../lib/rankingApi'
import { FlagAvatar, FlagLabel, PinLabel, PlayerAvatar, RankingRow, SubtitleText } from './RankingRow'
import { RankingFilterSheet } from './RankingFilterSheet'

export type FriendsRankingScope = 'world' | 'country' | 'club'

const SEARCH_DEBOUNCE_MS = 300
const PLACEHOLDER = 'rgba(255, 255, 255, 0.85)'

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'players'; data: PlayerRankingResponse }
  | { status: 'countries'; entries: RankedCountry[] }

/**
 * Friends › Ranking: World / Country / Club pills, a server-side search, the Everyone /
 * Friends only filter and the ranked rows. Scope and filter live in the parent screen so they
 * survive switching to My Friends or Requests and back.
 */
export function FriendsRankingView({
  scope,
  onScopeChange,
  friendsOnly,
  onFriendsOnlyChange,
  onOpenPlayer,
  onOpenCountry,
  onFindClub,
}: {
  scope: FriendsRankingScope
  onScopeChange: (scope: FriendsRankingScope) => void
  friendsOnly: boolean
  onFriendsOnlyChange: (friendsOnly: boolean) => void
  onOpenPlayer: (player: RankedPlayer) => void
  onOpenCountry: (country: RankedCountry) => void
  onFindClub: () => void
}) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])

  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [reloadTick, setReloadTick] = useState(0)
  const requestId = useRef(0)

  // Changing scope clears the search.
  const lastScope = useRef(scope)
  if (lastScope.current !== scope) {
    lastScope.current = scope
    if (query) setQuery('')
    if (debounced) setDebounced('')
  }

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [query])

  useEffect(() => {
    const id = ++requestId.current
    setState({ status: 'loading' })
    void (async () => {
      if (scope === 'country') {
        const r = await fetchCountryRanking(debounced)
        if (id !== requestId.current) return
        setState(r.ok ? { status: 'countries', entries: r.data.entries } : { status: 'error', message: r.error })
        return
      }
      const r = await fetchPlayerRanking({ scope, friendsOnly, q: debounced })
      if (id !== requestId.current) return
      setState(r.ok ? { status: 'players', data: r.data } : { status: 'error', message: r.error })
    })()
  }, [scope, friendsOnly, debounced, reloadTick])

  const retry = useCallback(() => setReloadTick((n) => n + 1), [])

  const filterDisabled = scope === 'country'
  const filterActive = friendsOnly && !filterDisabled
  const searching = debounced !== ''

  const scopes: Array<{ key: FriendsRankingScope; label: string }> = [
    { key: 'world', label: t('friendsRanking.world') },
    { key: 'country', label: t('friendsRanking.country') },
    { key: 'club', label: t('friendsRanking.club') },
  ]

  const message = (text: string, testID: string) => (
    <Text style={styles.emptyText} testID={testID}>
      {text}
    </Text>
  )

  let body: React.ReactNode
  if (state.status === 'loading') {
    body = <ActivityIndicator style={styles.loading} color={UI.accent} testID="ranking-loading" />
  } else if (state.status === 'error') {
    body = (
      <View style={styles.errorBox} testID="ranking-error">
        <Ionicons name="cloud-offline-outline" size={28} color={UI.textMuted} />
        <Text style={styles.emptyText}>{t('friendsRanking.loadError')}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={retry} activeOpacity={0.85} testID="ranking-retry" accessibilityRole="button">
          <Ionicons name="refresh" size={16} color="#FFFFFF" />
          <Text allowFontScaling={false} style={styles.retryText}>
            {t('friendsRanking.retry')}
          </Text>
        </TouchableOpacity>
      </View>
    )
  } else if (state.status === 'countries') {
    body =
      state.entries.length === 0 ? (
        searching ? (
          message(t('friendsRanking.noResults'), 'ranking-no-results')
        ) : (
          message(t('friendsRanking.noCountries'), 'ranking-empty')
        )
      ) : (
        <View style={styles.list}>
          {state.entries.map((c) => (
            <RankingRow
              key={c.code}
              rank={c.rank}
              avatar={<FlagAvatar flag={findCountry(c.code)?.flag} />}
              title={c.name}
              subtitle={<SubtitleText>{t('friendsRanking.players', { count: c.playerCount })}</SubtitleText>}
              rating={c.rating}
              onPress={() => onOpenCountry(c)}
              testID={`ranking-row-country-${c.code}`}
            />
          ))}
        </View>
      )
  } else {
    const { data } = state
    if (scope === 'club' && data.club == null) {
      body = (
        <View style={styles.noClub} testID="ranking-no-club">
          <Ionicons name="people-circle-outline" size={44} color={UI.textMuted} />
          <Text style={styles.noClubTitle}>{t('friendsRanking.noClubTitle')}</Text>
          <Text style={styles.emptyText}>{t('friendsRanking.noClubBody')}</Text>
          <View style={styles.noClubButton}>
            <GlowButton
              label={t('friendsRanking.findClub')}
              onPress={onFindClub}
              leadingIcon="search"
              radius={UI.radiusCard}
              testID="ranking-no-club-button"
            />
          </View>
        </View>
      )
    } else {
      body = (
        <>
          {scope === 'club' && data.club ? (
            <View style={styles.clubCaption}>
              <Ionicons name="shield-checkmark-outline" size={16} color={UI.accent} />
              <Text allowFontScaling={false} numberOfLines={1} style={styles.clubCaptionText} testID="ranking-club-name">
                {data.club.name}
              </Text>
            </View>
          ) : null}
          {data.entries.length === 0 ? (
            searching ? (
              message(t('friendsRanking.noResults'), 'ranking-no-results')
            ) : (
              message(t('friendsRanking.noPlayers'), 'ranking-empty')
            )
          ) : (
            <View style={styles.list}>
              {data.entries.map((p) => {
                const flag = p.countryCode ? findCountry(p.countryCode)?.flag : null
                return (
                  <RankingRow
                    key={p.userId}
                    rank={p.rank}
                    avatar={<PlayerAvatar uri={resolveUploadUrl(p.image)} />}
                    title={p.name}
                    subtitle={
                      p.countryName ? (
                        <FlagLabel flag={flag} label={p.countryName} />
                      ) : p.city ? (
                        <PinLabel label={p.city} />
                      ) : null
                    }
                    rating={p.rating}
                    onPress={() => onOpenPlayer(p)}
                    testID={`ranking-row-player-${p.userId}`}
                  />
                )
              })}
            </View>
          )}
        </>
      )
    }
  }

  return (
    <View testID="ranking-view">
      <View style={styles.scopeRow} accessibilityRole="tablist">
        {scopes.map(({ key, label }) => {
          const active = scope === key
          return (
            <TouchableOpacity
              key={key}
              style={[styles.scopePill, active ? styles.scopePillActive : styles.scopePillIdle]}
              onPress={() => onScopeChange(key)}
              activeOpacity={0.85}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              testID={`ranking-scope-${key}`}
            >
              {active ? (
                <>
                  <LinearGradient
                    colors={UI.gradient}
                    locations={UI.gradientLocations}
                    start={UI.gradientStart}
                    end={UI.gradientEnd}
                    style={[StyleSheet.absoluteFill, styles.pillFill]}
                  />
                  <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pillFill, SELECTED_GLOW]} />
                </>
              ) : null}
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.scopeLabel, { color: active ? '#FFFFFF' : UI.textMuted }]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={20} color={UI.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={scope === 'country' ? t('friendsRanking.searchCountries') : t('friendsRanking.searchPlayers')}
            placeholderTextColor={PLACEHOLDER}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            testID="ranking-search"
          />
          {query ? (
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('inviteExtra.clearSearch')}
              testID="ranking-search-clear"
            >
              <Ionicons name="close-circle" size={20} color={UI.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, filterActive && styles.filterBtnActive, filterDisabled && styles.filterBtnDisabled]}
          onPress={() => setFilterOpen(true)}
          disabled={filterDisabled}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('friendsRanking.filterTitle')}
          accessibilityState={{ disabled: filterDisabled, selected: filterActive }}
          testID="ranking-filter"
        >
          <Ionicons name="filter" size={22} color={filterDisabled ? 'rgba(140, 176, 226, 0.45)' : '#FFFFFF'} />
          {filterActive ? <View style={styles.filterDot} testID="ranking-filter-active" /> : null}
        </TouchableOpacity>
      </View>

      {body}

      <RankingFilterSheet
        visible={filterOpen}
        friendsOnly={friendsOnly}
        onClose={() => setFilterOpen(false)}
        onPick={(value) => {
          setFilterOpen(false)
          if (value !== friendsOnly) onFriendsOnlyChange(value)
        }}
      />
    </View>
  )
}

function getStyles(theme: { regularFont?: string; mediumFont?: string; semiBoldFont?: string }) {
  return StyleSheet.create({
    scopeRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
    scopePill: {
      flex: 1,
      height: 42,
      borderRadius: 999,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    scopePillActive: { borderColor: 'transparent' },
    scopePillIdle: { backgroundColor: UI.surface, borderColor: UI.surfaceBorder },
    pillFill: { borderRadius: 999 },
    scopeLabel: { fontFamily: theme.mediumFont ?? 'System', fontSize: 14 },
    searchRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
    searchWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 54,
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: UI.trackBorder,
      backgroundColor: 'rgba(0, 10, 30, 0.6)',
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      fontFamily: theme.regularFont ?? 'System',
      fontSize: 14,
      color: '#FFFFFF',
      paddingVertical: 0,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
    },
    filterBtn: {
      width: 54,
      height: 54,
      borderRadius: 27,
      borderWidth: 1,
      borderColor: UI.trackBorder,
      backgroundColor: 'rgba(0, 10, 30, 0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterBtnActive: { borderColor: UI.accent, backgroundColor: UI.surface, ...SELECTED_GLOW },
    filterBtnDisabled: { opacity: 0.55 },
    filterDot: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: UI.accent,
    },
    list: { marginTop: 16, gap: 10 },
    loading: { marginTop: 32 },
    emptyText: {
      marginTop: 12,
      textAlign: 'center',
      color: 'rgba(255, 255, 255, 0.6)',
      fontFamily: theme.regularFont ?? 'System',
      fontSize: 14,
      lineHeight: 20,
      paddingHorizontal: 16,
    },
    errorBox: { marginTop: 28, alignItems: 'center' },
    retryBtn: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 42,
      paddingHorizontal: 20,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: UI.trackBorder,
      backgroundColor: UI.surface,
    },
    retryText: { color: '#FFFFFF', fontFamily: theme.mediumFont ?? 'System', fontSize: 14 },
    noClub: { marginTop: 28, alignItems: 'center' },
    noClubTitle: {
      marginTop: 10,
      color: '#FFFFFF',
      fontFamily: theme.semiBoldFont ?? 'System',
      fontSize: 17,
      textAlign: 'center',
    },
    noClubButton: { alignSelf: 'stretch', marginTop: 18 },
    clubCaption: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
    clubCaptionText: { flexShrink: 1, color: '#FFFFFF', fontFamily: theme.mediumFont ?? 'System', fontSize: 15 },
  })
}
