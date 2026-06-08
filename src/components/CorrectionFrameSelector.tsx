import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { CorrectionFrameInsight } from '../types/correction'

type StatKey = 'pro_match' | 'adjustment_need' | 'stability' | 'power_line'

const STAT_KEYS: { key: StatKey; labelKey: string }[] = [
  { key: 'pro_match', labelKey: 'technique.correctionStatProMatch' },
  { key: 'adjustment_need', labelKey: 'technique.correctionStatAdjustment' },
  { key: 'stability', labelKey: 'technique.correctionStatStability' },
  { key: 'power_line', labelKey: 'technique.correctionStatPower' },
]

export type CorrectionFrameSelectorProps = {
  frames: CorrectionFrameInsight[]
  activeIndex: number
  onSelect: (index: number) => void
  proReferenceShot?: string | null
}

export function CorrectionFrameSelector({
  frames,
  activeIndex,
  onSelect,
  proReferenceShot,
}: CorrectionFrameSelectorProps) {
  const { t } = useTranslation()
  const active = frames[activeIndex] ?? frames[0]
  if (!active) return null

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
      >
        {frames.map((f, idx) => {
          const selected = idx === activeIndex
          return (
            <TouchableOpacity
              key={`pill-${f.frame}-${idx}`}
              style={[styles.pill, selected && styles.pillActive]}
              onPress={() => onSelect(idx)}
              activeOpacity={0.85}
            >
              <Text style={[styles.pillText, selected && styles.pillTextActive]}>
                {f.label || t('technique.correctionImageN', { n: idx + 1 })}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <Text style={styles.summary}>{active.summary}</Text>

      {proReferenceShot?.trim() ? (
        <Text style={styles.proRef}>
          {t('technique.proReferenceLine', { shot: proReferenceShot.trim() })}
        </Text>
      ) : null}

      <View style={styles.statsRow}>
        {STAT_KEYS.map(({ key, labelKey }) => (
          <View key={key} style={styles.statChip}>
            <Text style={styles.statLabel}>{t(labelKey)}</Text>
            <Text style={styles.statValue}>{active.stats[key]}%</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginBottom: 14,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
    paddingRight: 8,
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(22, 103, 201, 0.35)',
    backgroundColor: 'rgba(10, 26, 69, 0.6)',
  },
  pillActive: {
    borderColor: '#00BBFF',
    backgroundColor: 'rgba(0, 187, 255, 0.22)',
    shadowColor: '#00BBFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 6,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8CB0E2',
  },
  pillTextActive: {
    color: '#EAF4FF',
  },
  summary: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: '#B8D4F5',
  },
  proRef: {
    marginTop: 6,
    fontSize: 13,
    color: '#00BBFF',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  statChip: {
    minWidth: '22%',
    flexGrow: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 26, 69, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(22, 103, 201, 0.28)',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#8CB0E2',
    textAlign: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#00BBFF',
  },
})
