import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import type { AchievementCard as Card } from '../../../lib/achievementsCatalog'
import { HexIcon } from './HexIcon'
import { PG, glow } from '../progressTheme'

type Props = {
  card: Card
  theme: any
  onPress: () => void
  /** Narrow phones: smaller icon and title so long words don't break mid-word. */
  compact?: boolean
}

export function AchievementCard({ card, theme, onPress, compact = false }: Props) {
  const { t } = useTranslation()
  const earned = card.kind !== 'locked'
  const claimable = card.kind === 'claimable'
  const pct = Math.max(0, Math.min(100, (card.current / Math.max(1, card.goal)) * 100))

  const body = (
    <>
      <View style={styles.top}>
        <HexIcon size={compact ? 34 : 40} icon={card.icon as React.ComponentProps<typeof Ionicons>['name']} variant={earned ? 'bright' : 'dim'} />
        <View style={styles.text}>
          <Text
            allowFontScaling={false}
            numberOfLines={2}
            style={[
              styles.title,
              !earned && styles.titleDim,
              compact && styles.titleCompact,
              { fontFamily: theme.mediumFont },
            ]}
          >
            {t(card.labelKey)}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={3}
            style={[styles.desc, { fontFamily: theme.regularFont }]}
          >
            {t(card.descriptionKey)}
          </Text>
        </View>
        <View style={styles.corner}>
          {earned ? (
            <View style={[styles.check, glow(8, 0.7)]}>
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={18} color={PG.labelBlue} />
          )}
        </View>
      </View>
      <View style={styles.bottom}>
        <View style={styles.countRow}>
          <Text allowFontScaling={false} style={[styles.count, { fontFamily: theme.regularFont }]}>
            {t('progress.achievementProgress', { current: card.current, goal: card.goal })}
          </Text>
          {claimable ? (
            <View style={styles.claimPill}>
              <Text allowFontScaling={false} style={[styles.claimTxt, { fontFamily: theme.semiBoldFont }]}>
                {t('progress.claim')}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
      </View>
    </>
  )

  return (
    <TouchableOpacity
      style={styles.hit}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      testID={`achievement-card-${card.key}`}
    >
      {earned ? (
        <LinearGradient
          colors={['#0A2466', '#041038']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.card, styles.cardEarned, glow(14, 0.6)]}
        >
          {body}
        </LinearGradient>
      ) : (
        <View style={[styles.card, styles.cardLocked]}>{body}</View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  hit: { flex: 1, minWidth: 0 },
  card: {
    flex: 1,
    borderRadius: 20,
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 10,
    justifyContent: 'space-between',
    gap: 12,
  },
  cardEarned: { borderWidth: 2, borderColor: '#3D8BFF' },
  cardLocked: { borderWidth: 1.5, borderColor: '#0B2160', backgroundColor: PG.cardPlain },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  text: { flex: 1, minWidth: 0, paddingTop: 2 },
  /** Right padding leaves room for the corner marker overlaid on the first line. */
  title: { fontSize: 14, lineHeight: 18, color: '#FFFFFF', marginBottom: 4, paddingRight: 18 },
  titleDim: { color: 'rgba(255,255,255,0.78)' },
  titleCompact: { fontSize: 13, lineHeight: 17, paddingRight: 16 },
  desc: { fontSize: 11, lineHeight: 15, color: 'rgba(255,255,255,0.6)' },
  corner: { position: 'absolute', top: -2, right: -2, alignItems: 'flex-end' },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3D8BFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#05DF78',
  },
  claimTxt: { fontSize: 10, color: '#03240F' },
  bottom: { gap: 6 },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { fontSize: 12, color: '#FFFFFF' },
  track: { height: 8, borderRadius: 4, backgroundColor: PG.barTrack, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: PG.barFill },
})
