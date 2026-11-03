import React, { useContext } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { ThemeContext } from '../../context'

const SIZE = 36

/** Gold / silver / bronze coin colours (top light → bottom dark) and the number's ink. */
const MEDALS: Record<1 | 2 | 3, { colors: readonly [string, string]; ring: string; ink: string }> = {
  1: { colors: ['#FFE98A', '#E2B23A'], ring: '#FFF4C2', ink: '#5A3D00' },
  2: { colors: ['#E8EEFF', '#9AA8D6'], ring: '#F4F7FF', ink: '#2A3666' },
  3: { colors: ['#F2C6A6', '#B87A55'], ring: '#FBE1CF', ink: '#4A2410' },
}

/**
 * Rank marker for ranking rows: gold (with a crown), silver and bronze coins for #1–#3, and a
 * dark rounded chip with the number for #4 and below.
 */
export function RankMedal({ rank, testID }: { rank: number; testID?: string }) {
  const { theme } = useContext(ThemeContext)
  const medal = rank === 1 || rank === 2 || rank === 3 ? MEDALS[rank] : null
  const label = rank > 999 ? '999+' : String(rank)
  return (
    <View style={styles.slot} testID={testID} accessibilityLabel={`#${rank}`}>
      {medal ? (
        <View style={[styles.coin, { borderColor: medal.ring }]}>
          <LinearGradient colors={medal.colors} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
          <Text allowFontScaling={false} style={[styles.coinText, { color: medal.ink, fontFamily: theme.semiBoldFont }]}>
            {label}
          </Text>
        </View>
      ) : (
        <View style={styles.chip}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.chipText, { fontFamily: theme.boldFont ?? theme.semiBoldFont }]}
          >
            {label}
          </Text>
        </View>
      )}
      {rank === 1 ? (
        <View pointerEvents="none" style={styles.crown}>
          <MaterialCommunityIcons name="crown" size={16} color="#F5C542" />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  slot: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  coin: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinText: { fontSize: 16 },
  chip: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#141B4D',
    borderWidth: 1,
    borderColor: 'rgba(70, 96, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** #4 and below (design): Inter 700, 14px, #86A7D2. */
  chipText: { fontSize: 14, color: '#86A7D2', textAlign: 'center' },
  crown: { position: 'absolute', top: -9, left: 0, right: 0, alignItems: 'center' },
})
