import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LinearGradient } from 'expo-linear-gradient'
import { ThemeContext } from '../context'
import { useSessionData } from '../context/SessionDataContext'
import { LocalSvgAsset } from '../components/LocalSvgAsset'
import { ProLibraryGradientFrame } from '../components/ProLibraryGradientFrame'
import {
  getTodaysDailyQuests,
  localDateKey,
  QUEST_XP_BADGE,
  type DailyQuestDef,
} from '../lib/dailyQuestsCatalog'
import { claimDailyQuest as claimDailyQuestApi } from '../lib/gamificationApi'
import type { ProgressTabStackParamList } from '../navigation/types'
import { useTranslation } from 'react-i18next'

const TODAYS_TIP_ICON = require('../../assets/achivemnets/todaystipicon.svg')

type QuestTab = 'daily' | 'weekly' | 'season'

type QuestItem = DailyQuestDef & {
  current: number
  claimed?: boolean
}

const TAB_KEYS: { key: QuestTab; labelKey: string }[] = [
  { key: 'daily', labelKey: 'progress.questTabDaily' },
  { key: 'weekly', labelKey: 'progress.questTabWeekly' },
  { key: 'season', labelKey: 'progress.questTabSeason' },
]

const PG = {
  bg: '#050A18',
  card: '#041641',
  segmentActive: '#0059FF',
  track: '#07256D',
  fill: '#00B8FF',
  claimed: '#3DDC84',
  muted: '#86A7D2',
}

type Nav = NativeStackNavigationProp<ProgressTabStackParamList>

function XpRewardBadge({ xp, fontFamily }: { xp: number; fontFamily: string }) {
  return (
    <View style={styles.xpBadgeWrap}>
      <Image source={QUEST_XP_BADGE} style={styles.xpBadgeImg} resizeMode="contain" />
      <Text allowFontScaling={false} style={[styles.xpBadgeTxt, { fontFamily }]}>
        +{xp}
      </Text>
    </View>
  )
}

function QuestCard({
  quest,
  theme,
  onClaim,
  claiming,
}: {
  quest: QuestItem
  theme: { regularFont: string; mediumFont: string; semiBoldFont: string }
  onClaim?: () => void
  claiming?: boolean
}) {
  const { t } = useTranslation()
  const canClaim = !quest.claimed && quest.current >= quest.goal
  const pct = quest.claimed
    ? 100
    : Math.max(0, Math.min(100, Math.round((quest.current / quest.goal) * 100)))
  const fillColor = quest.claimed ? PG.claimed : PG.fill

  return (
    <TouchableOpacity
      activeOpacity={canClaim ? 0.88 : 1}
      onPress={canClaim ? onClaim : undefined}
      disabled={!canClaim || claiming}
    >
    <ProLibraryGradientFrame
      style={styles.questCardOuter}
      innerStyle={styles.questCardInner}
      borderRadius={16}
      innerBorderRadius={14}
      strokeWidth={2}
      gradientVariant="default"
      innerShadow={false}
    >
      <View style={styles.questIconWrap}>
        <LocalSvgAsset assetModule={quest.icon as number} width={34} height={34} />
      </View>
      <View style={styles.questBody}>
        <View style={styles.questTitleRow}>
          <Text
            allowFontScaling={false}
            numberOfLines={2}
            style={[styles.questTitle, { fontFamily: theme.mediumFont }]}
          >
            {t(quest.titleKey)}
          </Text>
          {quest.claimed ? (
            <Text
              allowFontScaling={false}
              style={[styles.claimedTxt, { fontFamily: theme.semiBoldFont }]}
            >
              {t('progress.questClaimed')}
            </Text>
          ) : (
            <View style={styles.questProgressRow}>
              <Text
                allowFontScaling={false}
                style={[styles.questProgressCurrent, { fontFamily: theme.regularFont }]}
              >
                {quest.current}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.questProgressGoal, { fontFamily: theme.regularFont }]}
              >
                {t('progress.dailyQuestProgressSuffix', { goal: quest.goal })}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.questTrack}>
          <View style={[styles.questFill, { width: `${pct}%`, backgroundColor: fillColor }]} />
        </View>
      </View>
      {quest.claimed ? (
        <View style={styles.claimedBadge}>
          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          <Text allowFontScaling={false} style={[styles.claimedBadgeTxt, { fontFamily: theme.semiBoldFont }]}>
            +{quest.xp}
          </Text>
        </View>
      ) : canClaim ? (
        <View style={styles.claimCta}>
          <Text allowFontScaling={false} style={[styles.claimCtaTxt, { fontFamily: theme.semiBoldFont }]}>
            {claiming ? '…' : t('progress.questClaim')}
          </Text>
        </View>
      ) : (
        <XpRewardBadge xp={quest.xp} fontFamily={theme.semiBoldFont} />
      )}
    </ProLibraryGradientFrame>
    </TouchableOpacity>
  )
}

export function DailyQuestScreen() {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const { width: winW } = useWindowDimensions()
  const { dailyQuests, refreshGamification } = useSessionData()
  const [tab, setTab] = useState<QuestTab>('daily')
  const [tipVisible, setTipVisible] = useState(true)
  const [claimingKey, setClaimingKey] = useState<string | null>(null)

  const horizontalPad = Math.max(20, insets.left, insets.right)

  const todayKey = localDateKey()

  useEffect(() => {
    void refreshGamification()
  }, [refreshGamification, todayKey])

  const dailyQuestsMerged = useMemo<QuestItem[]>(() => {
    const defs = getTodaysDailyQuests()
    const progressByKey = new Map(dailyQuests.map((q) => [q.questKey, q]))
    return defs.map((q) => {
      const row = progressByKey.get(q.key)
      return {
        ...q,
        current: row?.progress ?? 0,
        claimed: row?.claimed ?? false,
      }
    })
  }, [dailyQuests, todayKey])

  const handleClaim = useCallback(
    async (questKey: string) => {
      setClaimingKey(questKey)
      try {
        await claimDailyQuestApi(questKey, todayKey)
        await refreshGamification()
      } finally {
        setClaimingKey(null)
      }
    },
    [refreshGamification, todayKey]
  )

  const quests = tab === 'daily' ? dailyQuestsMerged : []

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: 8, paddingHorizontal: horizontalPad }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backHit}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={28} color="#86A7D2" />
        </TouchableOpacity>
        <Text allowFontScaling={false} style={[styles.headerTitle, { fontFamily: theme.semiBoldFont }]}>
          {t('progress.dailyQuest')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollInner,
          {
            paddingHorizontal: horizontalPad,
            paddingBottom: 32 + insets.bottom + 74,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.segmentTrack}>
          {TAB_KEYS.map((opt) => {
            const active = tab === opt.key
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.segmentPill, active && styles.segmentPillActive]}
                onPress={() => setTab(opt.key)}
                activeOpacity={0.88}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.segmentTxt, active && styles.segmentTxtOn, { fontFamily: theme.mediumFont }]}
                >
                  {t(opt.labelKey)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {quests.length > 0 ? (
          quests.map((quest) => (
            <QuestCard
              key={quest.key}
              quest={quest}
              theme={theme}
              claiming={claimingKey === quest.key}
              onClaim={() => void handleClaim(quest.key)}
            />
          ))
        ) : (
          <View style={styles.emptyWrap}>
            <Text allowFontScaling={false} style={[styles.emptyTxt, { fontFamily: theme.regularFont }]}>
              {t('progress.questTabEmpty')}
            </Text>
          </View>
        )}

        {tipVisible && tab === 'daily' ? (
          <ProLibraryGradientFrame
            style={[styles.tipCardOuter, { width: winW - horizontalPad * 2 }]}
            innerStyle={styles.tipCardInnerShell}
            borderRadius={20}
            innerBorderRadius={18}
            strokeWidth={2}
            gradientVariant="default"
            innerShadow={false}
          >
            <LinearGradient
              colors={['#0A2F6E', '#041641']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.tipCardFill}
            >
              <View style={styles.tipHead}>
                <View style={styles.tipHeadLeft}>
                  <LocalSvgAsset assetModule={TODAYS_TIP_ICON} width={20} height={20} />
                  <Text allowFontScaling={false} style={[styles.tipLabel, { fontFamily: theme.semiBoldFont }]}>
                    {t('progress.todaysTip')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setTipVisible(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={18} color="#004BFF" />
                </TouchableOpacity>
              </View>
              <Text allowFontScaling={false} style={[styles.tipBody, { fontFamily: theme.regularFont }]}>
                {t('progress.todaysTipBody')}
              </Text>
            </LinearGradient>
          </ProLibraryGradientFrame>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PG.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingBottom: 10,
  },
  backHit: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
    includeFontPadding: false,
  },
  headerSpacer: {
    width: 32,
    height: 44,
  },
  scroll: { flex: 1 },
  scrollInner: {
    paddingTop: 4,
  },
  segmentTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PG.card,
    borderRadius: 28,
    padding: 4,
    marginBottom: 24,
    overflow: 'hidden',
  },
  segmentPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentPillActive: {
    backgroundColor: PG.segmentActive,
  },
  segmentTxt: {
    fontSize: 12,
    color: '#336AB3',
    textAlign: 'center',
  },
  segmentTxtOn: {
    color: '#FFFFFF',
  },
  questCardOuter: {
    marginBottom: 10,
  },
  questCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PG.card,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  questIconWrap: {
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questBody: {
    flex: 1,
    minWidth: 0,
  },
  questTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  questTitle: {
    flex: 1,
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 17,
    minWidth: 0,
  },
  questProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  questProgressCurrent: {
    fontSize: 12,
    color: '#FFFFFF',
    lineHeight: 15,
  },
  questProgressGoal: {
    fontSize: 12,
    color: PG.muted,
    lineHeight: 15,
  },
  claimedTxt: {
    fontSize: 12,
    color: PG.claimed,
    lineHeight: 15,
  },
  questTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: PG.track,
    overflow: 'hidden',
  },
  questFill: {
    height: '100%',
    borderRadius: 3,
  },
  xpBadgeWrap: {
    width: 52,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  xpBadgeImg: {
    position: 'absolute',
    width: 52,
    height: 58,
  },
  xpBadgeTxt: {
    fontSize: 11,
    color: '#FFFFFF',
    lineHeight: 13,
    marginTop: 14,
  },
  claimedBadge: {
    width: 44,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#1A6B42',
    borderWidth: 1,
    borderColor: PG.claimed,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    gap: 2,
  },
  claimedBadgeTxt: {
    fontSize: 10,
    color: '#FFFFFF',
    lineHeight: 12,
  },
  claimCta: {
    minWidth: 52,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#0059FF',
    borderWidth: 1,
    borderColor: PG.fill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    paddingHorizontal: 8,
  },
  claimCtaTxt: {
    fontSize: 11,
    color: '#FFFFFF',
    lineHeight: 13,
  },
  emptyWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTxt: {
    fontSize: 14,
    color: PG.muted,
    textAlign: 'center',
  },
  tipCardOuter: {
    marginTop: 24,
  },
  tipCardInnerShell: {
    padding: 0,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  tipCardFill: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  tipHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tipHeadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipLabel: {
    fontSize: 12,
    color: '#004BFF',
    letterSpacing: 0.8,
    lineHeight: 15,
  },
  tipBody: {
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 20,
  },
})
