import React, { useContext, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { vercel as defaultTheme } from '../theme'
import type { MyCoachTabStackParamList } from '../navigation/types'
import {
  COACH_STUDENT_UPLOAD_SHOT_SECTIONS,
  coachUploadCategoryTitleKey,
  type CoachUploadShotItem,
} from '../lib/coachStudentUploadShots'
import { EntranceView, usePageFocusKey } from '../components/PageEntrance'

const BG = '#050A18'
const PANEL_BG = '#041641'
const CHIP_FILL = 'rgba(0, 39, 132, 0.5)'
const CHIP_TEXT = '#2A88F4'
const BACK_MUTED = '#86A7D2'

const HORIZONTAL_PAD = 20
const CHIP_GAP = 10
const CHIP_H = 40

type Nav = NativeStackNavigationProp<MyCoachTabStackParamList, 'StudentShotSelect'>
type R = RouteProp<MyCoachTabStackParamList, 'StudentShotSelect'>

function ShotChip({
  shot,
  width,
  fontFamily,
  onPress,
}: {
  shot: CoachUploadShotItem
  width: number
  fontFamily: string
  onPress: () => void
}) {
  const { t } = useTranslation()
  const twoLine = shot.labelLine2Key != null
  const a11yLabel = twoLine
    ? `${t(shot.labelKey)} ${t(shot.labelLine2Key!)}`
    : t(shot.labelKey)

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      style={[styles.chip, { width, height: CHIP_H }]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      {twoLine ? (
        <View style={styles.chipTextStack}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.chipText, { fontFamily }]}>
            {t(shot.labelKey)}
          </Text>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.chipText, styles.chipTextLine2, { fontFamily }]}>
            {t(shot.labelLine2Key!)}
          </Text>
        </View>
      ) : (
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.chipText, { fontFamily }]}>
          {t(shot.labelKey)}
        </Text>
      )}
    </TouchableOpacity>
  )
}

export function StudentShotSelectScreen() {
  const { t } = useTranslation()
  const { theme: ctx } = useContext(ThemeContext)
  const theme = ctx?.backgroundColor != null ? ctx : defaultTheme
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const route = useRoute<R>()
  const { width: winW } = useWindowDimensions()

  const { category } = route.params
  const sections = COACH_STUDENT_UPLOAD_SHOT_SECTIONS[category] ?? []

  const panelInnerW = winW - HORIZONTAL_PAD * 2 - 32
  const chipW = (panelInnerW - CHIP_GAP) / 2

  const fonts = useMemo(
    () => ({
      regularFont: theme.regularFont,
      mediumFont: theme.mediumFont,
      semiBoldFont: theme.semiBoldFont,
    }),
    [theme.regularFont, theme.mediumFont, theme.semiBoldFont]
  )

  const focusKey = usePageFocusKey()

  const onSelectShot = (shot: CoachUploadShotItem) => {
    navigation.navigate('StudentReviewTag', {
      ...route.params,
      labelKey: shot.labelKey,
      labelLine2Key: shot.labelLine2Key,
      strokePreset: shot.presetId,
    })
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingHorizontal: HORIZONTAL_PAD,
          paddingTop: 16,
          paddingBottom: 32 + insets.bottom + 74,
        }}
        showsVerticalScrollIndicator={false}
      >
        <EntranceView index={0} replayKey={focusKey}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
            style={styles.backRow}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel={t('studentProfile.backToCategory')}
          >
            <Ionicons name="chevron-back" size={30} color={BACK_MUTED} />
            <Text allowFontScaling={false} style={[styles.backLabel, { fontFamily: fonts.regularFont }]}>
              {t('studentProfile.backToCategory')}
            </Text>
          </TouchableOpacity>
        </EntranceView>

        <EntranceView index={1} replayKey={focusKey}>
          <Text allowFontScaling={false} style={[styles.pageTitle, { fontFamily: fonts.semiBoldFont }]}>
            {t(coachUploadCategoryTitleKey(category))}
          </Text>
          <Text allowFontScaling={false} style={[styles.pageSubtitle, { fontFamily: fonts.regularFont }]}>
            {t('studentProfile.selectAStroke')}
          </Text>
        </EntranceView>

        <EntranceView index={2} replayKey={focusKey} style={styles.shotPanel}>
          {sections.map((section, sectionIndex) => (
            <View
              key={section.sectionTitleKey}
              style={sectionIndex > 0 ? styles.sectionBlock : undefined}
            >
              <Text
                allowFontScaling={false}
                style={[styles.sectionTitle, { fontFamily: fonts.mediumFont }]}
              >
                {t(section.sectionTitleKey)}
              </Text>
              <View style={styles.chipGrid}>
                {section.shots.map((shot) => (
                  <ShotChip
                    key={`${shot.labelKey}-${shot.labelLine2Key ?? ''}-${shot.presetId}`}
                    shot={shot}
                    width={chipW}
                    fontFamily={fonts.mediumFont}
                    onPress={() => onSelectShot(shot)}
                  />
                ))}
              </View>
            </View>
          ))}
        </EntranceView>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 20,
  },
  backLabel: {
    color: BACK_MUTED,
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    opacity: 0.92,
  },
  shotPanel: {
    marginTop: 24,
    backgroundColor: PANEL_BG,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 22,
  },
  sectionBlock: {
    marginTop: 22,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    marginBottom: 12,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CHIP_GAP,
  },
  chip: {
    backgroundColor: CHIP_FILL,
    borderRadius: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chipTextStack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    color: CHIP_TEXT,
    fontSize: 13,
    lineHeight: 15,
    textAlign: 'center',
  },
  chipTextLine2: {
    marginTop: 0,
    fontSize: 12,
    lineHeight: 14,
  },
})
