import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable, Image } from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import type { ActivitySession } from '../../../lib/activitySession'
import { displayTrainShotTitle } from '../../../lib/trainShotDisplay'
import { PG, glow } from '../../progress/progressTheme'
import { formatDuration, shotCategoryLabelKey } from './shotsFilter'

type Props = {
  session: ActivitySession
  /** Full video URL, used for the frame when the API has no thumbnail. */
  videoUrl: string
  theme: any
  onPress: () => void
  /** Narrow phones: smaller thumbnail and metric text. */
  compact?: boolean
  favorite?: boolean
  onToggleFavorite?: () => void
}

const METRICS = [
  { key: 'stability', labelKey: 'activities.metricStability' },
  { key: 'power', labelKey: 'activities.metricPower' },
  { key: 'agility', labelKey: 'activities.metricAgility' },
] as const

export function ShotCard({
  session: s,
  videoUrl,
  theme,
  onPress,
  compact = false,
  favorite = false,
  onToggleFavorite,
}: Props) {
  const { t, i18n } = useTranslation()
  const [thumbFailed, setThumbFailed] = useState(false)

  const title = displayTrainShotTitle({ strokeLabel: s.shotLabel, strokeName: s.shotLabel })
  const score = typeof s.score === 'number' ? Math.round(Math.max(0, Math.min(100, s.score))) : null
  const categoryKey = shotCategoryLabelKey(s.category)
  const duration = formatDuration(s.durationMs)
  const date = new Date(s.createdAt).toLocaleDateString(i18n.language, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const thumbSize = compact ? 76 : 88

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.hit, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      testID={`shot-card-${s.analysisId}`}
    >
      <LinearGradient
        colors={[PG.cardTop, PG.cardBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.card, glow(12, 0.35)]}
      >
        <View style={styles.top}>
          <View style={[styles.thumb, { width: thumbSize, height: thumbSize }]} collapsable={false}>
            {s.thumbnailUrl && !thumbFailed ? (
              <Image
                source={{ uri: s.thumbnailUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                onError={() => setThumbFailed(true)}
              />
            ) : !s.thumbnailUrl ? (
              <Video
                source={{ uri: videoUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode={ResizeMode.COVER}
                useNativeControls={false}
                isLooping={false}
                shouldPlay={false}
              />
            ) : null}
            <View style={styles.play}>
              <Ionicons name="play" size={16} color="#FFFFFF" style={{ marginLeft: 2 }} />
            </View>
            {duration ? (
              <View style={styles.duration}>
                <Text allowFontScaling={false} style={[styles.durationTxt, { fontFamily: theme.mediumFont }]}>
                  {duration}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.body}>
            {categoryKey ? (
              <View style={styles.chip}>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.chipTxt, { fontFamily: theme.semiBoldFont }]}
                >
                  {t(categoryKey).toLocaleUpperCase(i18n.language)}
                </Text>
              </View>
            ) : null}
            <Text
              allowFontScaling={false}
              numberOfLines={2}
              style={[styles.title, compact && styles.titleCompact, { fontFamily: theme.semiBoldFont }]}
            >
              {title}
            </Text>
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.date, { fontFamily: theme.regularFont }]}>
              {date}
            </Text>
          </View>

          <View style={styles.scoreCol}>
            <Text allowFontScaling={false} style={styles.scoreLine}>
              <Text style={[styles.score, { fontFamily: theme.semiBoldFont }]}>
                {score != null ? String(score) : '–'}
              </Text>
              <Text style={[styles.outOf, { fontFamily: theme.regularFont }]}> /100</Text>
            </Text>
            {onToggleFavorite ? (
              <Pressable
                onPress={onToggleFavorite}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityState={{ selected: favorite }}
                accessibilityLabel={t(favorite ? 'activities.favoriteRemove' : 'activities.favoriteAdd')}
                testID={`shot-favorite-${s.analysisId}`}
              >
                <Ionicons name={favorite ? 'star' : 'star-outline'} size={20} color={favorite ? '#FFC93C' : PG.labelBlue} />
              </Pressable>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={PG.labelBlue} />
            )}
          </View>
        </View>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${score ?? 0}%` }]} />
        </View>

        <View style={styles.metrics}>
          {METRICS.map((m) => {
            const v = s.physicalMetrics?.[m.key]
            return (
              <View key={m.key} style={styles.metricBox}>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.metricLabel, compact && styles.metricLabelCompact, { fontFamily: theme.regularFont }]}
                >
                  {t(m.labelKey)}
                </Text>
                <Text allowFontScaling={false} style={[styles.metricVal, { fontFamily: theme.semiBoldFont }]}>
                  {typeof v === 'number' ? String(v) : '–'}
                </Text>
              </View>
            )
          })}
        </View>
      </LinearGradient>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  hit: { marginBottom: 14 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PG.border,
    padding: 12,
    gap: 12,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  thumb: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0A1A3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  duration: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  durationTxt: { fontSize: 11, color: '#FFFFFF' },
  body: { flex: 1, minWidth: 0, gap: 4 },
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: 'rgba(0, 102, 255, 0.22)',
    borderWidth: 1,
    borderColor: PG.borderSoft,
    maxWidth: '100%',
  },
  chipTxt: { fontSize: 10, letterSpacing: 0.6, color: PG.labelBlue },
  title: { fontSize: 16, lineHeight: 20, color: '#FFFFFF' },
  titleCompact: { fontSize: 15, lineHeight: 19 },
  date: { fontSize: 12, color: PG.muted },
  scoreCol: { alignItems: 'flex-end', gap: 6 },
  scoreLine: { color: '#FFFFFF' },
  score: { fontSize: 20, color: '#FFFFFF' },
  outOf: { fontSize: 12, color: PG.muted },
  track: { height: 8, borderRadius: 4, backgroundColor: PG.barTrack, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: PG.barFill },
  metrics: { flexDirection: 'row', gap: 8 },
  metricBox: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PG.borderSoft,
    backgroundColor: PG.cardPlain,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 2,
  },
  metricLabel: { fontSize: 11, color: PG.muted },
  metricLabelCompact: { fontSize: 10 },
  metricVal: { fontSize: 16, color: '#FFFFFF' },
})
