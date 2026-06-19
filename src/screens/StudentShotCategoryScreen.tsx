import React, { useContext, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { vercel as defaultTheme } from '../theme'
import type { MyCoachTabStackParamList } from '../navigation/types'
import { COACH_STUDENT_UPLOAD_CATEGORIES } from '../lib/coachStudentUploadCategories'
import type { TrainCategory } from '../lib/train-taxonomy'
import { EntranceView, usePageFocusKey } from '../components/PageEntrance'

const BG = '#050A18'
const PANEL_BG = '#041641'
const ACCENT = '#1848BA'
const BACK_MUTED = '#86A7D2'

type Nav = NativeStackNavigationProp<MyCoachTabStackParamList, 'StudentShotCategory'>
type R = RouteProp<MyCoachTabStackParamList, 'StudentShotCategory'>

export function StudentShotCategoryScreen() {
  const { t } = useTranslation()
  const { theme: ctx } = useContext(ThemeContext)
  const theme = ctx?.backgroundColor != null ? ctx : defaultTheme
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const route = useRoute<R>()
  const studentParams = route.params

  const horizontalPad = 20

  const fonts = useMemo(
    () => ({
      regularFont: theme.regularFont,
      mediumFont: theme.mediumFont,
      semiBoldFont: theme.semiBoldFont,
    }),
    [theme.regularFont, theme.mediumFont, theme.semiBoldFont]
  )

  const focusKey = usePageFocusKey()

  const onSelectCategory = (category: TrainCategory) => {
    navigation.navigate('StudentShotSelect', { ...studentParams, category })
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingHorizontal: horizontalPad,
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
            accessibilityLabel={t('studentProfile.backToUploads')}
          >
            <Ionicons name="chevron-back" size={30} color={BACK_MUTED} />
            <Text allowFontScaling={false} style={[styles.backLabel, { fontFamily: fonts.regularFont }]}>
              {t('studentProfile.backToUploads')}
            </Text>
          </TouchableOpacity>
        </EntranceView>

        <EntranceView index={1} replayKey={focusKey}>
          <Text allowFontScaling={false} style={[styles.titleLine, { fontFamily: fonts.semiBoldFont }]}>
            {t('studentProfile.selectShotTitle')}
          </Text>
          <Text allowFontScaling={false} style={[styles.titleLine, { fontFamily: fonts.semiBoldFont }]}>
            {t('studentProfile.shotCategoryTitle')}
          </Text>
        </EntranceView>

        <EntranceView index={2} replayKey={focusKey} style={styles.categoryPanel}>
          {COACH_STUDENT_UPLOAD_CATEGORIES.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.82}
              onPress={() => onSelectCategory(item.id)}
              style={[styles.categoryBtn, index < COACH_STUDENT_UPLOAD_CATEGORIES.length - 1 && styles.categoryBtnGap]}
              accessibilityRole="button"
              accessibilityLabel={t(item.labelKey)}
            >
              <Text allowFontScaling={false} style={[styles.categoryBtnText, { fontFamily: fonts.mediumFont }]}>
                {t(item.labelKey)}
              </Text>
              <Ionicons name="chevron-forward" size={22} color={ACCENT} />
            </TouchableOpacity>
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
  titleLine: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  categoryPanel: {
    marginTop: 28,
    backgroundColor: PANEL_BG,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: ACCENT,
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 18,
    backgroundColor: 'transparent',
  },
  categoryBtnGap: {
    marginBottom: 12,
  },
  categoryBtnText: {
    flex: 1,
    color: ACCENT,
    fontSize: 15,
    lineHeight: 20,
    paddingRight: 12,
  },
})
