import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { Header } from '../components/Header'
import { MainTabBarChrome } from '../components/MainTabBarChrome'
import { FollowButton } from '../components/FollowButton'
import { ClubPfpImage } from '../components/ClubPfpImage'
import { CARD_GLOW, SegmentedToggle, UI } from '../components/ui'
import { FlagAvatar, PinLabel, PlayerAvatar, RankingRow } from '../components/ranking/RankingRow'
import { findCountry } from '../lib/countries'
import { resolveUploadUrl } from '../lib/mediaUrl'
import { fetchMyFollows } from '../lib/followsApi'
import { fetchCountryDetail, formatRating, type CountryDetail, type RankedPlayer } from '../lib/rankingApi'
import type { MainStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<MainStackParamList, 'CountryRanking'>
type Route = RouteProp<MainStackParamList, 'CountryRanking'>
type Tab = 'players' | 'clubs' | 'about'

/** Countries the follows API accepts (ISO alpha-2); regions like GE-AB have no Follow button. */
const FOLLOWABLE = /^[A-Z]{2}$/

/** Country page from Friends › Ranking › Country: header, stats and Top Players / Clubs / About. */
export function CountryRankingScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { t, i18n } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])
  const code = route.params.code.toUpperCase()
  const country = findCountry(code)
  const fallbackName = route.params.name ?? country?.name ?? code

  const [detail, setDetail] = useState<CountryDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('players')
  const [following, setFollowing] = useState<boolean | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setDetail(null)
    const r = await fetchCountryDetail(code)
    if (r.ok) setDetail(r.data)
    else setError(r.error)
  }, [code])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!FOLLOWABLE.test(code)) return
    let cancelled = false
    void fetchMyFollows().then(({ countries }) => {
      if (!cancelled) setFollowing(countries.map((c) => c.toUpperCase()).includes(code))
    })
    return () => {
      cancelled = true
    }
  }, [code])

  const name = detail?.country.name ?? fallbackName
  const fmt = (n: number | null | undefined) => formatRating(n, i18n.language)

  const openPlayer = (p: RankedPlayer) =>
    navigation.navigate('LeaderboardPlayer', {
      userId: p.userId,
      name: p.name,
      image: p.image,
      areaLocation: [p.city, p.countryName].filter(Boolean).join(', ') || null,
      totalXp: p.totalXp,
      rank: p.rank,
      overallScore: p.rating,
    })

  const headerRow = (
    <View style={styles.headerRow}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        testID="country-back"
      >
        <Ionicons name="chevron-back" size={28} color="#86A7D2" />
      </TouchableOpacity>
      <FlagAvatar flag={country?.flag} size={62} />
      <View style={styles.titleCol}>
        <Text allowFontScaling={false} numberOfLines={2} style={styles.countryName} testID="country-name">
          {name}
        </Text>
        {detail?.country.rank != null ? (
          <Text allowFontScaling={false} numberOfLines={1} style={styles.worldRank} testID="country-world-rank">
            {t('friendsRanking.worldRank', { rank: detail.country.rank })}
          </Text>
        ) : null}
      </View>
      {FOLLOWABLE.test(code) && following != null ? (
        <FollowButton
          targetType="country"
          targetId={code}
          targetName={name}
          following={following}
          onChange={(next) => setFollowing(next)}
          testID="country-follow"
        />
      ) : null}
    </View>
  )

  let content: React.ReactNode
  if (error) {
    content = (
      <View style={styles.centerBox} testID="country-error">
        <Ionicons name="cloud-offline-outline" size={28} color={UI.textMuted} />
        <Text style={styles.emptyText}>{t('friendsRanking.countryLoadError')}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void load()} activeOpacity={0.85} testID="country-retry">
          <Ionicons name="refresh" size={16} color="#FFFFFF" />
          <Text allowFontScaling={false} style={styles.retryText}>
            {t('friendsRanking.retry')}
          </Text>
        </TouchableOpacity>
      </View>
    )
  } else if (!detail) {
    content = <ActivityIndicator style={{ marginTop: 40 }} color={UI.accent} testID="country-loading" />
  } else {
    const c = detail.country
    const stats = [
      { key: 'players', icon: 'people-outline' as const, value: fmt(c.playerCount), label: t('friendsRanking.statPlayers') },
      { key: 'rating', icon: 'star-outline' as const, value: fmt(c.averageRating), label: t('friendsRanking.statAverage') },
      { key: 'clubs', icon: 'stats-chart' as const, value: fmt(c.clubCount), label: t('friendsRanking.statClubs') },
    ]
    const summary = [
      c.rank != null
        ? t('friendsRanking.aboutRank', { name: c.name, rank: c.rank, total: c.totalCountries })
        : t('friendsRanking.aboutNoRank', { name: c.name }),
      c.playerCount > 0 && c.averageRating != null
        ? t('friendsRanking.aboutPlayers', { count: c.playerCount, average: fmt(c.averageRating) })
        : null,
      c.clubCount > 0 ? t('friendsRanking.aboutClubs', { count: c.clubCount }) : null,
    ]
      .filter(Boolean)
      .join(' ')

    content = (
      <>
        <View style={styles.statsCard} testID="country-stats">
          {stats.map((s, i) => (
            <View key={s.key} style={[styles.statCell, i > 0 && styles.statDivider]} testID={`country-stat-${s.key}`}>
              <Ionicons name={s.icon} size={22} color={UI.accent} />
              <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>
                {s.value}
              </Text>
              <Text allowFontScaling={false} numberOfLines={2} style={styles.statLabel}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.tabs}>
          <SegmentedToggle<Tab>
            options={[
              { value: 'players', label: t('friendsRanking.tabPlayers'), testID: 'country-tab-players' },
              { value: 'clubs', label: t('friendsRanking.tabClubs'), testID: 'country-tab-clubs' },
              { value: 'about', label: t('friendsRanking.tabAbout'), testID: 'country-tab-about' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>

        {tab === 'players' ? (
          detail.topPlayers.length === 0 ? (
            <Text style={styles.emptyText} testID="country-players-empty">
              {t('friendsRanking.noCountryPlayers')}
            </Text>
          ) : (
            <View style={styles.list} testID="country-players">
              {detail.topPlayers.map((p) => (
                <RankingRow
                  key={p.userId}
                  rank={p.rank}
                  avatar={<PlayerAvatar uri={resolveUploadUrl(p.image)} />}
                  title={p.name}
                  subtitle={p.city ? <PinLabel label={p.city} /> : null}
                  rating={p.rating}
                  onPress={() => openPlayer(p)}
                  testID={`country-player-${p.userId}`}
                />
              ))}
            </View>
          )
        ) : tab === 'clubs' ? (
          detail.clubs.length === 0 ? (
            <Text style={styles.emptyText} testID="country-clubs-empty">
              {t('friendsRanking.noCountryClubs')}
            </Text>
          ) : (
            <View style={styles.list} testID="country-clubs">
              {detail.clubs.map((club) => (
                <TouchableOpacity
                  key={club.id}
                  style={styles.clubRow}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('ClubDetail', { clubId: club.slug })}
                  accessibilityRole="button"
                  accessibilityLabel={club.name}
                  testID={`country-club-${club.slug}`}
                >
                  <ClubPfpImage uri={resolveUploadUrl(club.logoImageUrl)} size={46} fallbackLabel={club.name} />
                  <View style={styles.clubText}>
                    <Text allowFontScaling={false} numberOfLines={1} style={styles.clubName}>
                      {club.name}
                    </Text>
                    {club.city ? (
                      <View style={styles.clubCityRow}>
                        <PinLabel label={club.city} />
                      </View>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={UI.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )
        ) : (
          <View style={styles.aboutCard} testID="country-about">
            <Text style={styles.aboutText}>{summary}</Text>
            {detail.topCities.length > 0 ? (
              <>
                <Text allowFontScaling={false} style={styles.aboutHeading}>
                  {t('friendsRanking.topCities')}
                </Text>
                {detail.topCities.map((city, i) => (
                  <View key={city.city} style={styles.cityRow} testID={`country-city-${i}`}>
                    <View style={styles.cityName}>
                      <PinLabel label={city.city} />
                    </View>
                    <Text allowFontScaling={false} style={styles.cityCount}>
                      {t('friendsRanking.players', { count: city.playerCount })}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}
          </View>
        )}
      </>
    )
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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        testID="country-page"
      >
        {headerRow}
        {content}
      </ScrollView>
      <MainTabBarChrome />
    </View>
  )
}

function getStyles(theme: { backgroundColor?: string; regularFont?: string; mediumFont?: string; semiBoldFont?: string }) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.backgroundColor ?? UI.pageBg },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    titleCol: { flex: 1, minWidth: 0 },
    countryName: { color: '#FFFFFF', fontFamily: theme.semiBoldFont ?? 'System', fontSize: 22, lineHeight: 27 },
    worldRank: { color: UI.textMuted, fontFamily: theme.regularFont ?? 'System', fontSize: 14, marginTop: 2 },
    statsCard: {
      marginTop: 18,
      flexDirection: 'row',
      borderRadius: UI.radiusCard,
      borderWidth: 1,
      borderColor: UI.cardBorder,
      backgroundColor: UI.cardBg,
      paddingVertical: 14,
      ...CARD_GLOW,
    },
    statCell: { flex: 1, alignItems: 'center', paddingHorizontal: 6, gap: 2 },
    statDivider: { borderLeftWidth: 1, borderLeftColor: UI.cardBorder },
    statValue: { color: '#FFFFFF', fontFamily: theme.mediumFont ?? 'System', fontSize: 22, marginTop: 4 },
    statLabel: { color: UI.textMuted, fontFamily: theme.regularFont ?? 'System', fontSize: 13, textAlign: 'center' },
    tabs: { marginTop: 16 },
    list: { marginTop: 16, gap: 10 },
    emptyText: {
      marginTop: 24,
      textAlign: 'center',
      color: 'rgba(255, 255, 255, 0.6)',
      fontFamily: theme.regularFont ?? 'System',
      fontSize: 14,
      lineHeight: 20,
      paddingHorizontal: 16,
    },
    centerBox: { marginTop: 32, alignItems: 'center' },
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
    clubRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 66,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: 'rgba(52, 72, 255, 0.45)',
      backgroundColor: '#070D2B',
    },
    clubText: { flex: 1, minWidth: 0 },
    clubName: { color: '#FFFFFF', fontFamily: theme.mediumFont ?? 'System', fontSize: 16 },
    clubCityRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
    aboutCard: {
      marginTop: 16,
      borderRadius: UI.radiusCard,
      borderWidth: 1,
      borderColor: UI.cardBorder,
      backgroundColor: UI.cardBg,
      padding: 16,
    },
    aboutText: { color: '#FFFFFF', fontFamily: theme.regularFont ?? 'System', fontSize: 15, lineHeight: 22 },
    aboutHeading: { marginTop: 16, marginBottom: 6, color: '#FFFFFF', fontFamily: theme.semiBoldFont ?? 'System', fontSize: 16 },
    cityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: UI.divider,
      gap: 10,
    },
    cityName: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 },
    cityCount: { color: UI.textMuted, fontFamily: theme.regularFont ?? 'System', fontSize: 13 },
  })
}
