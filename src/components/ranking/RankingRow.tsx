import React, { useContext, type ReactNode } from 'react'
import { Image, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions, type ImageSourcePropType } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../../context'
import { UI } from '../ui'
import { profileImageSource } from '../../lib/defaultProfilePicture'
import { formatRating } from '../../lib/rankingApi'
import { RankMedal } from './RankMedal'

export const RANKING_AVATAR = 46
/** Below this width (e.g. 360) rows tighten their gaps so names keep more room. */
const NARROW_WIDTH = 380

/**
 * One ranking row: medal, round avatar, title, a subtitle line, the Rating ("85" over "Rating")
 * and a chevron. Used for players and countries in Friends › Ranking and on the country page.
 */
export function RankingRow({
  rank,
  avatar,
  title,
  subtitle,
  rating,
  onPress,
  testID,
}: {
  rank: number
  avatar: ReactNode
  title: string
  subtitle?: ReactNode
  rating: number | null
  onPress?: () => void
  testID?: string
}) {
  const { theme } = useContext(ThemeContext)
  const { t, i18n } = useTranslation()
  const narrow = useWindowDimensions().width < NARROW_WIDTH
  return (
    <TouchableOpacity
      style={[styles.row, narrow && styles.rowNarrow]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`#${rank} ${title}`}
      testID={testID}
    >
      <RankMedal rank={rank} />
      {avatar}
      <View style={styles.textCol}>
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.title, { fontFamily: theme.mediumFont }]}>
          {title}
        </Text>
        {subtitle ? <View style={styles.subtitleRow}>{subtitle}</View> : null}
      </View>
      <View style={styles.ratingCol}>
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.rating, { fontFamily: theme.mediumFont }]}>
          {formatRating(rating, i18n.language)}
        </Text>
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.ratingLabel, { fontFamily: theme.regularFont }]}>
          {t('friendsRanking.rating')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={UI.textMuted} />
    </TouchableOpacity>
  )
}

/** Round avatar from a profile image URL (placeholder when there is none). */
export function PlayerAvatar({ uri }: { uri: string | null }) {
  return (
    <View style={styles.avatarRing}>
      <Image source={profileImageSource(uri)} style={styles.avatarImg} resizeMode="cover" />
    </View>
  )
}

/** Round avatar from a flag (placeholder globe when there is no flag). */
export function FlagAvatar({ flag, size = RANKING_AVATAR }: { flag: ImageSourcePropType | null | undefined; size?: number }) {
  return (
    <View style={[styles.avatarRing, { width: size + 4, height: size + 4, borderRadius: (size + 4) / 2 }]}>
      {flag ? (
        <Image source={flag} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" />
      ) : (
        <View style={[styles.flagPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
          <Ionicons name="globe-outline" size={size * 0.5} color={UI.textMuted} />
        </View>
      )}
    </View>
  )
}

/** Small flag + text (for "🇪🇸 Spain" under a player's name). */
export function FlagLabel({ flag, label }: { flag: ImageSourcePropType | null | undefined; label: string }) {
  const { theme } = useContext(ThemeContext)
  return (
    <>
      {flag ? <Image source={flag} style={styles.smallFlag} resizeMode="cover" /> : null}
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.subtitle, { fontFamily: theme.regularFont }]}>
        {label}
      </Text>
    </>
  )
}

/** Pin + text (city under a player's name). */
export function PinLabel({ label }: { label: string }) {
  const { theme } = useContext(ThemeContext)
  return (
    <>
      <Ionicons name="location-outline" size={13} color={UI.textMuted} />
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.subtitle, { fontFamily: theme.regularFont }]}>
        {label}
      </Text>
    </>
  )
}

/** Plain muted subtitle text ("40 players"). */
export function SubtitleText({ children }: { children: string }) {
  const { theme } = useContext(ThemeContext)
  return (
    <Text allowFontScaling={false} numberOfLines={1} style={[styles.subtitle, { fontFamily: theme.regularFont }]}>
      {children}
    </Text>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 66,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(52, 72, 255, 0.45)',
    backgroundColor: '#070D2B',
    boxShadow: '0px 0px 18px 0px #2B3BFF26 inset',
  },
  rowNarrow: { gap: 7, paddingLeft: 8, paddingRight: 6 },
  avatarRing: {
    width: RANKING_AVATAR + 4,
    height: RANKING_AVATAR + 4,
    borderRadius: (RANKING_AVATAR + 4) / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(90, 120, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: RANKING_AVATAR, height: RANKING_AVATAR, borderRadius: RANKING_AVATAR / 2 },
  flagPlaceholder: { backgroundColor: UI.surface, alignItems: 'center', justifyContent: 'center' },
  textCol: { flex: 1, minWidth: 0, justifyContent: 'center' },
  title: { fontSize: 16, color: '#FFFFFF' },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3, minWidth: 0 },
  subtitle: { fontSize: 12, color: UI.textMuted, flexShrink: 1 },
  smallFlag: { width: 15, height: 10, borderRadius: 2 },
  ratingCol: { alignItems: 'flex-end', minWidth: 44 },
  rating: { fontSize: 16, color: '#FFFFFF' },
  ratingLabel: { fontSize: 11, color: UI.textMuted, marginTop: 1 },
})
