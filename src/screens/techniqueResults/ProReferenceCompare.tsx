import { useContext, useState } from 'react'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LinearGradient } from 'expo-linear-gradient'
import { Video, ResizeMode } from 'expo-av'
import { ThemeContext } from '../../context'

export type ProCompareRow = {
  label: string
  you: string
}

type Segment = 'before' | 'after' | 'progress'

type Props = {
  videoUri: string
  referenceImageUri: string | null
  rows: ProCompareRow[]
  score: number | null
  onSave: () => void
}

export function ProReferenceCompare({
  videoUri,
  referenceImageUri,
  rows,
  score,
  onSave,
}: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const [segment, setSegment] = useState<Segment>('before')
  const segments: { id: Segment; label: string }[] = [
    { id: 'before', label: t('analysis.before') },
    { id: 'after', label: t('analysis.after') },
    { id: 'progress', label: t('analysis.progress') },
  ]

  return (
    <View style={styles.page}>
      <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.boldFont ?? theme.semiBoldFont }]}>
        {t('analysis.saveTrack')}
      </Text>
      <Text allowFontScaling={false} style={[styles.subtitle, { fontFamily: theme.mediumFont }]}>
        {t('analysis.compareOverTime')}
      </Text>

      <View style={styles.segment}>
        {segments.map((item) => {
          const selected = item.id === segment
          return (
            <TouchableOpacity
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              activeOpacity={0.85}
              onPress={() => setSegment(item.id)}
              style={[styles.segmentBtn, selected && styles.segmentBtnOn]}
            >
              <Text
                allowFontScaling={false}
                style={[
                  styles.segmentLabel,
                  { fontFamily: selected ? theme.semiBoldFont : theme.mediumFont },
                  selected && styles.segmentLabelOn,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {segment !== 'progress' ? (
        <View style={styles.compareCard}>
          <View style={styles.mediaRow}>
            <View style={styles.mediaCol}>
              <Text allowFontScaling={false} style={[styles.mediaLabel, { fontFamily: theme.mediumFont }]}>
                {t('analysis.yourShot')}
              </Text>
              <View style={styles.mediaFrame}>
                <Video
                  source={{ uri: videoUri }}
                  style={styles.media}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={false}
                  isMuted
                />
              </View>
            </View>
            <View style={styles.mediaCol}>
              <Text allowFontScaling={false} style={[styles.mediaLabel, { fontFamily: theme.mediumFont }]}>
                {t('analysis.proReference')}
              </Text>
              <View style={[styles.mediaFrame, styles.mediaFramePro]}>
                {referenceImageUri ? (
                  <Image source={{ uri: referenceImageUri }} style={styles.media} resizeMode="cover" />
                ) : (
                  <View style={styles.proEmpty}>
                    <Ionicons name="body" size={36} color="#3D9DFF" />
                  </View>
                )}
              </View>
            </View>
          </View>

          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text allowFontScaling={false} style={[styles.rowLabel, { fontFamily: theme.regularFont }]}>
                {row.label}
              </Text>
              <Text allowFontScaling={false} style={[styles.rowYou, { fontFamily: theme.semiBoldFont }]}>
                {row.you}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#86A7D2" />
              <Text allowFontScaling={false} style={[styles.rowRef, { fontFamily: theme.semiBoldFont }]}>
                —
              </Text>
            </View>
          ))}
          {rows.length === 0 ? (
            <Text allowFontScaling={false} style={[styles.empty, { fontFamily: theme.regularFont }]}>
              {t('analysis.compareEmpty')}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.scoreCard}>
        <Text allowFontScaling={false} style={[styles.scoreTitle, { fontFamily: theme.semiBoldFont }]}>
          {t('analysis.overallScore')}
        </Text>
        <Text allowFontScaling={false} style={[styles.scoreValue, { fontFamily: theme.semiBoldFont }]}>
          {score != null ? String(score) : '—'}
        </Text>
      </View>

      <TouchableOpacity accessibilityRole="button" activeOpacity={0.85} onPress={onSave}>
        <LinearGradient
          colors={['#00C2FF', '#2454FF']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.saveBtn}
        >
          <Text allowFontScaling={false} style={[styles.saveText, { fontFamily: theme.semiBoldFont }]}>
            {t('analysis.saveToProgress')}
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { alignSelf: 'stretch', paddingHorizontal: 22, gap: 12, paddingBottom: 12 },
  title: { color: '#FFFFFF', fontSize: 22, textAlign: 'center' },
  subtitle: { color: '#3DB7FF', fontSize: 14, textAlign: 'center', marginTop: -8 },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#07183F',
    borderRadius: 999,
    padding: 4,
  },
  segmentBtn: { flex: 1, alignItems: 'center', borderRadius: 999, paddingVertical: 10 },
  segmentBtnOn: { backgroundColor: '#2454FF' },
  segmentLabel: { color: '#C5D4F5', fontSize: 14 },
  segmentLabelOn: { color: '#FFFFFF' },
  compareCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 184, 255, 0.28)',
    backgroundColor: '#071428',
    padding: 12,
    gap: 12,
  },
  mediaRow: { flexDirection: 'row', gap: 10 },
  mediaCol: { flex: 1, gap: 6 },
  mediaLabel: { color: '#C5D4F5', fontSize: 13, textAlign: 'center' },
  mediaFrame: { height: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: '#020814' },
  mediaFramePro: { borderWidth: 1.5, borderColor: '#00C8FF' },
  media: { width: '100%', height: '100%' },
  proEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { flex: 1, color: '#C5D4F5', fontSize: 14 },
  rowYou: { color: '#FFFFFF', fontSize: 16, minWidth: 52, textAlign: 'right' },
  rowRef: { color: '#86A7D2', fontSize: 16, minWidth: 36, textAlign: 'right' },
  empty: { color: '#86A7D2', fontSize: 13, lineHeight: 18 },
  scoreCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 184, 255, 0.28)',
    backgroundColor: '#071428',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreTitle: { color: '#3DDC97', fontSize: 16 },
  scoreValue: { color: '#FFFFFF', fontSize: 22 },
  saveBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveText: { color: '#FFFFFF', fontSize: 16 },
})
