import React, { useContext, useMemo } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native'
import { ThemeContext } from '../../context'
import { TechniqueAnalysisVideoPanel } from '../TechniqueAnalysisVideoPanel'
import { normalizePoseData, resolveTotalFrames } from '../../lib/techniquePose'
import type { BenchMatchPreview } from '../../lib/adminRetrievalBenchApi'

type Props = {
  preview: BenchMatchPreview | null
  loading: boolean
  error: string | null
  /** When false, skip the "Match preview" heading (parent already titled the section). */
  showSectionTitle?: boolean
}

/** Stacked user + pro-library skeleton players for admin retrieval QA. */
export function BenchMatchPreviewPanel({
  preview,
  loading,
  error,
  showSectionTitle = true,
}: Props) {
  const { theme } = useContext(ThemeContext)
  const { width: winW } = useWindowDimensions()
  const styles = useMemo(() => getStyles(theme), [theme])
  const videoW = Math.max(200, Math.min(420, Math.floor(winW - 32)))

  const userPose = useMemo(
    () => (preview ? normalizePoseData(preview.user.pose_data) : []),
    [preview]
  )
  const userTotal = useMemo(() => {
    if (!preview) return 1
    return resolveTotalFrames(
      {
        total_frames: preview.user.total_frames,
        video_duration_ms: preview.user.video_duration_ms,
      },
      userPose
    )
  }, [preview, userPose])

  const matchPose = useMemo(
    () => (preview?.match ? normalizePoseData(preview.match.pose_data) : []),
    [preview]
  )
  const matchTotal = useMemo(() => {
    if (!preview?.match) return 1
    return resolveTotalFrames(
      {
        total_frames: preview.match.total_frames,
        video_duration_ms: preview.match.video_duration_ms,
      },
      matchPose
    )
  }, [preview, matchPose])

  if (loading) {
    return (
      <View style={styles.wrap}>
        {showSectionTitle ? <Text style={styles.sectionLabel}>Match preview</Text> : null}
        <ActivityIndicator color="#00BBFF" style={{ marginVertical: 16 }} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.wrap}>
        {showSectionTitle ? <Text style={styles.sectionLabel}>Match preview</Text> : null}
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )
  }

  if (!preview) return null

  return (
    <View style={styles.wrap}>
      {showSectionTitle ? <Text style={styles.sectionLabel}>Match preview</Text> : null}

      <Text style={styles.clipTitle}>User</Text>
      {preview.user.videoUrl ? (
        <TechniqueAnalysisVideoPanel
          videoUri={preview.user.videoUrl}
          videoKey={`bench-user-${preview.analysisId}`}
          width={videoW}
          poseFrames={userPose}
          totalVidFrames={userTotal}
          isLooping
          showLegend={false}
          skeletonColorMode="segment"
        />
      ) : (
        <Text style={styles.missing}>No video</Text>
      )}

      <Text style={[styles.clipTitle, { marginTop: 18 }]}>
        Pro
        {preview.match?.stroke_label ? ` · ${preview.match.stroke_label}` : ''}
        {preview.match?.distance != null
          ? ` · d=${preview.match.distance.toFixed(3)}`
          : ''}
      </Text>
      {preview.match?.videoUrl ? (
        <TechniqueAnalysisVideoPanel
          videoUri={preview.match.videoUrl}
          videoKey={`bench-pro-${preview.match.train_sample_id}`}
          width={videoW}
          poseFrames={matchPose}
          totalVidFrames={matchTotal}
          isLooping
          showLegend={false}
          skeletonColorMode="segment"
        />
      ) : (
        <Text style={styles.missing}>No match</Text>
      )}
    </View>
  )
}

function getStyles(theme: { semiBoldFont?: string; regularFont?: string; mediumFont?: string }) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      marginTop: 16,
      marginBottom: 8,
    },
    sectionLabel: {
      color: '#86A7D2',
      fontSize: 12,
      fontFamily: theme.semiBoldFont,
      marginBottom: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    clipTitle: {
      color: '#E8F2FF',
      fontSize: 14,
      fontFamily: theme.semiBoldFont,
      marginBottom: 8,
    },
    missing: {
      color: 'rgba(255,255,255,0.45)',
      fontSize: 13,
      fontFamily: theme.regularFont,
      marginTop: 6,
      marginBottom: 4,
    },
    errorText: {
      color: '#f87171',
      fontSize: 13,
      fontFamily: theme.regularFont,
    },
  })
}
