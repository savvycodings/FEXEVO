import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { useSessionData } from '../../../context/SessionDataContext'
import { HexIcon } from './HexIcon'
import { PG, glow } from '../progressTheme'

type Props = { theme: any }

export function AchievementsHeroCard({ theme }: Props) {
  const { t } = useTranslation()
  const { profileName, xpInLevel, xpGoal, playerLevel, playerTier } = useSessionData()
  const pct = Math.max(0, Math.min(100, (xpInLevel / Math.max(1, xpGoal)) * 100))

  return (
    <LinearGradient
      colors={[PG.cardTop, PG.cardBottom]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.card, glow(18, 0.55)]}
    >
      <HexIcon size={88} icon="trophy" />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.name, { fontFamily: theme.semiBoldFont }]}
          >
            {profileName ?? ''}
          </Text>
          <View style={styles.premium}>
            <Text allowFontScaling={false} style={[styles.premiumTxt, { fontFamily: theme.mediumFont }]}>
              {t('common.premium')}
            </Text>
          </View>
        </View>
        <Text allowFontScaling={false} style={[styles.level, { fontFamily: theme.semiBoldFont }]}>
          {t('progress.levelTier', { level: playerLevel, tier: playerTier })}
        </Text>
        <View style={styles.xpRow}>
          <View style={styles.xpLeft}>
            <View style={styles.boltBox}>
              <Ionicons name="flash-outline" size={16} color="#FFC21A" />
            </View>
            <Text allowFontScaling={false} style={[styles.xp, { fontFamily: theme.semiBoldFont }]}>
              {t('progress.achievementsXp', { xp: xpInLevel.toLocaleString() })}
            </Text>
          </View>
          <Text allowFontScaling={false} style={[styles.goal, { fontFamily: theme.semiBoldFont }]}>
            {xpGoal.toLocaleString()}
          </Text>
        </View>
        <View style={styles.track}>
          {/* Keep a visible nub at 0 XP, like the mockup. */}
          <View style={[styles.fill, { width: `${Math.max(pct, 4)}%` }]} />
        </View>
      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: PG.border,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  info: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  name: { flexShrink: 1, fontSize: 24, color: '#FFFFFF' },
  premium: {
    borderWidth: 1,
    borderColor: '#2F7BFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  premiumTxt: { fontSize: 13, color: PG.labelBlue },
  level: { fontSize: 12, color: PG.labelBlue, marginBottom: 8 },
  xpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  xpLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  boltBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#2F7BFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  xp: { fontSize: 16, color: '#FFFFFF' },
  goal: { fontSize: 16, color: '#FFFFFF' },
  track: { height: 8, borderRadius: 4, backgroundColor: PG.barTrack, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: PG.barFill },
})
