import { useCallback, useContext, useEffect, useState } from 'react'
import { BackHandler, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext } from '../../context'
import { authClient } from '../../lib/auth-client'
import { useMagicShotJob } from '../../lib/magicShotJob'
import { resolveMediaUrl } from '../../lib/mediaUrl'
import { MagicShotCard } from '../../components/MagicShotCard'
import { CorrectionVideoCompare } from '../../components/CorrectionVideoCompare'
import { TEST_IDS } from '../../lib/testIds'

type Props = {
  analysisId: string | null
  /** The player's own clip, shown left of the split once the Magic Shot is ready. */
  originalUri: string | null
  /** Height / width of the player's clip, when known. */
  originalAspect?: number | null
  /** Called after the profile's playing hand changes, so cached session data can reload. */
  onProfileChanged?: () => void
  onClose: () => void
}

/**
 * "See the correct movement": the Magic Shot, an AI video of this player doing the shot right,
 * next to their own clip. Before it exists this page starts it and shows its progress.
 */
export function CorrectMovementView({ analysisId, originalUri, originalAspect, onProfileChanged, onClose }: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const job = useMagicShotJob(analysisId, true)
  const [switchingHand, setSwitchingHand] = useState(false)
  const [switchHandError, setSwitchHandError] = useState<string | null>(null)

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [onClose])

  const switchHand = useCallback(async () => {
    const videoHand = job.mismatch?.videoHand
    if (!videoHand || switchingHand) return
    setSwitchingHand(true)
    setSwitchHandError(null)
    const res = await authClient
      .$fetch('/profile/hand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ dominantHand: videoHand }),
      })
      .catch((err: unknown) => ({ error: err }))
    setSwitchingHand(false)
    if ((res as { error?: unknown })?.error) {
      setSwitchHandError(t('technique.magicShot.mismatch.switchFailed'))
      return
    }
    onProfileChanged?.()
    void job.start({ forceRegenerate: true })
  }, [job, switchingHand, onProfileChanged, t])

  const corrected = job.video?.video ? resolveMediaUrl(job.video.video) : null

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: 96 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
      testID="correct-movement"
    >
      <View style={styles.titleRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('analysis.back')}
          hitSlop={12}
          onPress={onClose}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={24} color="#86A7D2" />
        </Pressable>
        <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.boldFont ?? theme.semiBoldFont }]}>
          {t('analysis.correctMovementTitle')}
        </Text>
      </View>
      <Text allowFontScaling={false} style={[styles.subtitle, { fontFamily: theme.mediumFont }]}>
        {t('analysis.correctMovementSubtitle')}
      </Text>

      {corrected && originalUri ? (
        <View testID={TEST_IDS.magicShotResult}>
          <CorrectionVideoCompare
            originalUri={originalUri}
            correctedUri={corrected}
            videoKey={`correct-${analysisId ?? 'video'}`}
            width={width - 32}
            originalAspect={originalAspect}
            windowStartMs={job.video?.windowStartMs ?? null}
            windowEndMs={job.video?.windowEndMs ?? null}
          />
        </View>
      ) : (
        <MagicShotCard
          status={job.status}
          startedAt={job.startedAt}
          error={job.error}
          onGenerate={() => void job.start()}
          mismatch={job.mismatch}
          onInviteFriend={() => {
            void Share.share({ message: t('technique.magicShot.mismatch.shareMessage') }).catch(() => {})
          }}
          onSwitchHand={() => void switchHand()}
          switchingHand={switchingHand}
          switchHandError={switchHandError}
        />
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { padding: 4 },
  title: { color: '#FFFFFF', fontSize: 22, flex: 1 },
  subtitle: { color: '#3DB7FF', fontSize: 14, marginTop: -8, paddingLeft: 36 },
})
