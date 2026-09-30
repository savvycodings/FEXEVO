import React, { useCallback, useContext, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Alert,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as ImagePicker from 'expo-image-picker'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { vercel as defaultTheme } from '../theme'
import type { AICoachTabStackParamList, MyCoachTabStackParamList } from '../navigation/types'
import { LocalSvgAsset } from '../components/LocalSvgAsset'
import { EntranceView, usePageFocusKey } from '../components/PageEntrance'
import { analysisCoreTitleKey, coachUploadCategoryTitleKey } from '../lib/coachStudentUploadShots'
import { formatTrainSkillLevel, TRAIN_SKILL_LEVEL_IDS, type TrainSkillLevelId } from '../lib/trainSkillLevel'
import { uploadCoachSentVideo } from '../lib/coachSentVideoUpload'
import { completeSelfAnalyzeShot } from '../lib/pendingSelfAnalyzeShot'
import { DOMAIN } from '../../constants'

const SHOT_TITLE_ICON = require('../../assets/reviewandtags/shottitle.svg')
const UPLOAD_ICON = require('../../assets/reviewandtags/uploudicon.svg')
const LEVEL_ICONS: Record<TrainSkillLevelId, number> = {
  beginner: require('../../assets/reviewandtags/beginner.svg'),
  intermediate: require('../../assets/reviewandtags/intermediate.svg'),
  advanced: require('../../assets/reviewandtags/advanced.svg'),
}

const DIAGONAL_ICON = require('../../assets/reviewandtags/diaganal.svg')

type CoachUploadViewId =
  | 'front'
  | 'side'
  | 'behind'
  | 'deg45_right_side_left_camera'
  | 'deg45_right_side_right_camera'
  | 'deg45_left_side_right_camera'
  | 'deg45_left_side_left_camera'

const VIEW_OPTIONS: { id: CoachUploadViewId; icon: number; labelKey: string }[] = [
  { id: 'front', icon: require('../../assets/reviewandtags/front.svg'), labelKey: 'studentProfile.views.front' },
  { id: 'behind', icon: require('../../assets/reviewandtags/behind.svg'), labelKey: 'studentProfile.views.behind' },
  { id: 'side', icon: require('../../assets/reviewandtags/side.svg'), labelKey: 'studentProfile.views.side' },
  { id: 'deg45_right_side_left_camera', icon: DIAGONAL_ICON, labelKey: 'studentProfile.views.deg45RightSideLeftCamera' },
  { id: 'deg45_right_side_right_camera', icon: DIAGONAL_ICON, labelKey: 'studentProfile.views.deg45RightSideRightCamera' },
  { id: 'deg45_left_side_right_camera', icon: DIAGONAL_ICON, labelKey: 'studentProfile.views.deg45LeftSideRightCamera' },
  { id: 'deg45_left_side_left_camera', icon: DIAGONAL_ICON, labelKey: 'studentProfile.views.deg45LeftSideLeftCamera' },
]

/** AI Coach shot stepper shows these views only; the rest stay available to the coach upload flow. */
const SELF_ANALYZE_HIDDEN_VIEWS = new Set<CoachUploadViewId>(['side'])
const SELF_ANALYZE_VIEW_OPTIONS = VIEW_OPTIONS.filter((opt) => !SELF_ANALYZE_HIDDEN_VIEWS.has(opt.id))

const BG = '#050A18'
const PANEL_BG = '#041641'
const HEADER_BOX_FILL = 'rgba(0, 39, 132, 0.5)'
const HEADER_BOX_TEXT = '#2A88F4'
const HEADER_BOX_STROKE = '#2A88F4'
const SELF_VIEW_COLS = 3
const SELF_VIEW_GAP = 10
const SELF_VIEW_ICON_H = 58
const TILE_IDLE_FILL = 'rgba(0, 39, 132, 0.5)' // #002784 @ 50%
const TILE_SELECTED_FILL = '#0034A6'
const TILE_SELECTED_STROKE = '#00B8FF'
const TILE_IDLE_ICON = '#003EC4'
const UPLOAD_DISABLED_FG = '#7A9BC4'
const SHOT_TITLE_COLOR = '#2A88F4'
const BACK_MUTED = '#86A7D2'
const HORIZONTAL_PAD = 20
const TILE_GAP = 8
const LEVEL_ICON_H = 38
const VIEW_ICON_H = 64
/** Crop built-in SVG side margins so silhouettes sit closer to tile edges. */
const LEVEL_ICON_W_SCALE = 1.5
const VIEW_ICON_W_SCALE = 1.85

type Nav = NativeStackNavigationProp<MyCoachTabStackParamList, 'StudentReviewTag'>
type R = RouteProp<MyCoachTabStackParamList, 'StudentReviewTag'>

function shotTitleText(
  t: (key: string) => string,
  labelKey: string,
  labelLine2Key?: string
): string {
  if (labelLine2Key) return `${t(labelKey)} ${t(labelLine2Key)}`
  return t(labelKey)
}

export function StudentReviewTagScreen() {
  const { t } = useTranslation()
  const { theme: ctx } = useContext(ThemeContext)
  const theme = ctx?.backgroundColor != null ? ctx : defaultTheme
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const route = useRoute<R>()
  const { width: winW } = useWindowDimensions()

  const { category, coreGroup, labelKey, labelLine2Key, peerUserId, strokePreset, flow } = route.params
  const selfAnalyze = flow === 'self-analyze'
  const [skillLevel, setSkillLevel] = useState<TrainSkillLevelId | null>(null)
  const [viewId, setViewId] = useState<CoachUploadViewId | null>(null)
  const [uploading, setUploading] = useState(false)
  const canUpload = selfAnalyze
    ? viewId != null && !uploading
    : skillLevel != null && viewId != null && !uploading
  const focusKey = usePageFocusKey()

  const panelInnerW = winW - HORIZONTAL_PAD * 2 - 32
  const levelTileW = (panelInnerW - TILE_GAP * 2) / 3
  const viewTileW = (panelInnerW - TILE_GAP * 3) / 4
  const selfViewTileW = Math.floor((panelInnerW - SELF_VIEW_GAP * (SELF_VIEW_COLS - 1)) / SELF_VIEW_COLS) - 1

  const fonts = useMemo(
    () => ({
      regularFont: theme.regularFont,
      mediumFont: theme.mediumFont,
      semiBoldFont: theme.semiBoldFont,
    }),
    [theme.regularFont, theme.mediumFont, theme.semiBoldFont]
  )

  const categoryLabel = t(coachUploadCategoryTitleKey(category))
  const selfAnalyzeCategoryLabel = t(coreGroup ? analysisCoreTitleKey(coreGroup) : coachUploadCategoryTitleKey(category))
  const strokeLabel = shotTitleText(t, labelKey, labelLine2Key)

  const onUpload = useCallback(async () => {
    if (viewId == null || uploading) return
    if (flow === 'self-analyze') {
      const userShot = {
        category,
        strokePreset,
        shotLabel: strokeLabel,
        skillLevel: skillLevel != null ? formatTrainSkillLevel(skillLevel) : '',
        viewId,
      }
      completeSelfAnalyzeShot(userShot)
      const aiNav = navigation as unknown as NativeStackNavigationProp<AICoachTabStackParamList>
      aiNav.navigate('AICoachMain', { userShot, declaredAt: Date.now() })
      return
    }
    if (skillLevel == null || !peerUserId) return
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert(t('commonAlerts.permissionNeeded'), t('coachFlow.permissionPhotos'))
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    })
    const asset = result.canceled ? null : result.assets?.[0]
    if (!asset?.uri) return

    setUploading(true)
    try {
      const fileName = asset.fileName || `coach-video-${Date.now()}.mp4`
      const mimeType =
        asset.mimeType || (fileName.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4')
      await uploadCoachSentVideo({
        uri: asset.uri,
        fileName,
        mimeType,
        apiBase: DOMAIN,
        fields: {
          studentUserId: peerUserId,
          category,
          strokePreset,
          shotLabel: strokeLabel,
          skillLevel: formatTrainSkillLevel(skillLevel),
          viewId,
        },
      })
      Alert.alert(t('coachFlow.videoSentTitle'), t('coachFlow.videoSentBody'), [
        {
          text: t('commonAlerts.ok'),
          onPress: () => {
            if (!peerUserId || route.params.peerName == null || route.params.peerLocation == null) return
            navigation.navigate('StudentProfile', {
              peerUserId,
              peerName: route.params.peerName,
              peerLocation: route.params.peerLocation,
              actualScore: route.params.actualScore ?? 0,
              lastScore: route.params.lastScore ?? 0,
              peerImageUri: route.params.peerImageUri,
            })
          },
        },
      ])
    } catch (e: any) {
      Alert.alert(t('coachFlow.videoSentErrorTitle'), e?.message || t('coachFlow.videoSentErrorBody'))
    } finally {
      setUploading(false)
    }
  }, [
    skillLevel,
    viewId,
    uploading,
    t,
    peerUserId,
    category,
    strokePreset,
    strokeLabel,
    navigation,
    route.params,
    flow,
  ])

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
        {selfAnalyze ? (
        <>
        <View style={styles.headerBoxPanel}>
          <TouchableOpacity
            onPress={() => navigation.pop(2)}
            activeOpacity={0.85}
            style={styles.categoryFilledBox}
            accessibilityRole="button"
            accessibilityLabel={t('studentProfile.backToCategory')}
          >
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.headerBoxText, { fontFamily: fonts.mediumFont }]}
            >
              {selfAnalyzeCategoryLabel}
            </Text>
          </TouchableOpacity>
        </View>

        <EntranceView index={0} distance={14} replayKey={focusKey} style={[styles.headerBoxPanel, styles.stackedPanel]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
            style={styles.strokeOutlineBox}
            accessibilityRole="button"
            accessibilityLabel={strokeLabel}
          >
            <Ionicons name="chevron-back" size={20} color={HEADER_BOX_STROKE} style={styles.headerBoxChevron} />
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.headerBoxText, { fontFamily: fonts.mediumFont }]}
            >
              {strokeLabel}
            </Text>
          </TouchableOpacity>
        </EntranceView>

        <EntranceView index={1} distance={18} replayKey={focusKey} style={[styles.panel, styles.stackedPanel]}>
          <Text allowFontScaling={false} style={[styles.sectionLabel, { fontFamily: fonts.regularFont }]}>
            {t('studentProfile.view')}
          </Text>
          <View style={styles.selfViewGrid}>
            {SELF_ANALYZE_VIEW_OPTIONS.map((opt) => {
              const active = viewId === opt.id
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.82}
                  onPress={() => setViewId(opt.id)}
                  style={[styles.selfViewTile, { width: selfViewTileW }, active && styles.tileActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t(opt.labelKey)}
                >
                  <View style={[styles.tileIconClip, { height: SELF_VIEW_ICON_H }]}>
                    <LocalSvgAsset
                      assetModule={opt.icon}
                      width={selfViewTileW * VIEW_ICON_W_SCALE}
                      height={SELF_VIEW_ICON_H}
                      fillColor={active ? TILE_SELECTED_STROKE : TILE_IDLE_ICON}
                    />
                  </View>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={2}
                    style={[
                      styles.tileLabel,
                      styles.selfViewTileLabel,
                      active && styles.tileLabelActive,
                      { fontFamily: fonts.mediumFont },
                    ]}
                  >
                    {t(opt.labelKey).replace(', ', ',\n')}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <TouchableOpacity
            activeOpacity={canUpload ? 0.88 : 1}
            disabled={!canUpload}
            onPress={() => void onUpload()}
            style={styles.uploadOuter}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canUpload }}
          >
            {canUpload ? (
              <LinearGradient
                colors={['#00B8FF', '#1848BA']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.uploadGradient}
              >
                <Text allowFontScaling={false} style={[styles.uploadText, { fontFamily: fonts.mediumFont }]}>
                  {t('studentProfile.continueToSetClip')}
                </Text>
              </LinearGradient>
            ) : (
              <LinearGradient
                colors={['rgba(0, 57, 132, 0.55)', 'rgba(4, 22, 65, 0.75)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.uploadGradient}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.uploadTextDisabled, { fontFamily: fonts.mediumFont }]}
                >
                  {t('studentProfile.continueToSetClip')}
                </Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </EntranceView>
        </>
        ) : (
        <>
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
            {t('studentProfile.reviewAndTag')}
          </Text>
        </EntranceView>

        <EntranceView index={2} replayKey={focusKey}>
          <View style={styles.shotHeroRow}>
            <View style={styles.shotIconOuter}>
              <View style={styles.shotIconInner}>
                <LocalSvgAsset assetModule={SHOT_TITLE_ICON} width={30} height={38} />
              </View>
            </View>
            <View style={styles.shotHeroTextCol}>
              <View style={styles.categoryPill}>
                <Text allowFontScaling={false} style={[styles.categoryPillText, { fontFamily: fonts.mediumFont }]}>
                  {categoryLabel}
                </Text>
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={2}
                style={[styles.shotTitle, { fontFamily: fonts.semiBoldFont }]}
              >
                {strokeLabel}
              </Text>
            </View>
          </View>
        </EntranceView>

        <EntranceView index={3} replayKey={focusKey} style={styles.panel}>
          <Text allowFontScaling={false} style={[styles.sectionLabel, { fontFamily: fonts.regularFont }]}>
            {t('studentProfile.level')}
          </Text>
          <View style={styles.levelRow}>
            {TRAIN_SKILL_LEVEL_IDS.map((id) => {
              const active = skillLevel === id
              return (
                <TouchableOpacity
                  key={id}
                  activeOpacity={0.82}
                  onPress={() => setSkillLevel(id)}
                  style={[
                    styles.levelTile,
                    { width: levelTileW },
                    active && styles.tileActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={formatTrainSkillLevel(id)}
                >
                  <View style={[styles.tileIconClip, { height: LEVEL_ICON_H }]}>
                    <LocalSvgAsset
                      assetModule={LEVEL_ICONS[id]}
                      width={levelTileW * LEVEL_ICON_W_SCALE}
                      height={LEVEL_ICON_H}
                      fillColor={active ? TILE_SELECTED_STROKE : TILE_IDLE_ICON}
                    />
                  </View>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[
                      styles.tileLabel,
                      active && styles.tileLabelActive,
                      { fontFamily: fonts.mediumFont },
                    ]}
                  >
                    {formatTrainSkillLevel(id)}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Text
            allowFontScaling={false}
            style={[styles.sectionLabel, styles.sectionLabelSpaced, { fontFamily: fonts.regularFont }]}
          >
            {t('studentProfile.view')}
          </Text>
          <View style={styles.viewRow}>
            {VIEW_OPTIONS.map((opt) => {
              const active = viewId === opt.id
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.82}
                  onPress={() => setViewId(opt.id)}
                  style={[
                    styles.viewTile,
                    { width: viewTileW },
                    active && styles.tileActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t(opt.labelKey)}
                >
                  <View style={[styles.tileIconClip, { height: VIEW_ICON_H }]}>
                    <LocalSvgAsset
                      assetModule={opt.icon}
                      width={viewTileW * VIEW_ICON_W_SCALE}
                      height={VIEW_ICON_H}
                      fillColor={active ? TILE_SELECTED_STROKE : TILE_IDLE_ICON}
                    />
                  </View>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={3}
                    style={[
                      styles.tileLabel,
                      styles.viewTileLabel,
                      active && styles.tileLabelActive,
                      { fontFamily: fonts.mediumFont },
                    ]}
                  >
                    {t(opt.labelKey)}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <TouchableOpacity
            activeOpacity={canUpload ? 0.88 : 1}
            disabled={!canUpload}
            onPress={() => void onUpload()}
            style={styles.uploadOuter}
            accessibilityState={{ disabled: !canUpload }}
          >
            {canUpload ? (
              <LinearGradient
                colors={['#00B8FF', '#1848BA']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.uploadGradient}
              >
                <LocalSvgAsset assetModule={UPLOAD_ICON} width={26} height={26} />
                <Text allowFontScaling={false} style={[styles.uploadText, { fontFamily: fonts.mediumFont }]}>
                  {t('studentProfile.uploadVideo')}
                </Text>
              </LinearGradient>
            ) : (
              <LinearGradient
                colors={['rgba(0, 57, 132, 0.55)', 'rgba(4, 22, 65, 0.75)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.uploadGradient}
              >
                <LocalSvgAsset
                  assetModule={UPLOAD_ICON}
                  width={26}
                  height={26}
                  strokeColor={UPLOAD_DISABLED_FG}
                />
                <Text
                  allowFontScaling={false}
                  style={[styles.uploadTextDisabled, { fontFamily: fonts.mediumFont }]}
                >
                  {uploading ? t('coachFlow.videoSending') : t('studentProfile.uploadVideo')}
                </Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </EntranceView>
        </>
        )}
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
  shotHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 18,
    marginBottom: 22,
  },
  shotIconOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#021E63',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shotIconInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#041641',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shotHeroTextCol: {
    flex: 1,
    minWidth: 0,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: BACK_MUTED,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 8,
  },
  categoryPillText: {
    color: BACK_MUTED,
    fontSize: 11,
    lineHeight: 14,
  },
  shotTitle: {
    color: BACK_MUTED,
    fontSize: 22,
    lineHeight: 26,
  },
  panel: {
    backgroundColor: PANEL_BG,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 20,
  },
  sectionLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    opacity: 0.92,
    marginBottom: 10,
  },
  sectionLabelSpaced: {
    marginTop: 18,
  },
  levelRow: {
    flexDirection: 'row',
    gap: TILE_GAP,
  },
  viewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TILE_GAP,
  },
  levelTile: {
    backgroundColor: TILE_IDLE_FILL,
    borderRadius: 14,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 0,
    alignItems: 'stretch',
    justifyContent: 'center',
    minHeight: 94,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  viewTile: {
    backgroundColor: TILE_IDLE_FILL,
    borderRadius: 14,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 0,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    minHeight: 132,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  tileIconClip: {
    width: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileActive: {
    backgroundColor: TILE_SELECTED_FILL,
    borderColor: TILE_SELECTED_STROKE,
  },
  tileLabel: {
    marginTop: 6,
    color: SHOT_TITLE_COLOR,
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
    alignSelf: 'center',
  },
  tileLabelActive: {
    color: TILE_SELECTED_STROKE,
  },
  viewTileLabel: {
    fontSize: 11,
    lineHeight: 13,
    paddingHorizontal: 4,
  },
  uploadOuter: {
    marginTop: 22,
    borderRadius: 18,
    overflow: 'hidden',
    width: '100%',
  },
  uploadGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 18,
  },
  uploadText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
  },
  uploadTextDisabled: {
    color: UPLOAD_DISABLED_FG,
    fontSize: 16,
    lineHeight: 20,
  },
  headerBoxPanel: {
    backgroundColor: PANEL_BG,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  stackedPanel: {
    marginTop: 14,
  },
  categoryFilledBox: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: HEADER_BOX_FILL,
    paddingHorizontal: 44,
  },
  strokeOutlineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderWidth: 2,
    borderColor: HEADER_BOX_STROKE,
    borderRadius: 14,
    backgroundColor: HEADER_BOX_FILL,
    paddingHorizontal: 44,
  },
  headerBoxChevron: {
    position: 'absolute',
    left: 16,
  },
  headerBoxText: {
    color: HEADER_BOX_TEXT,
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
  },
  selfViewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SELF_VIEW_GAP,
  },
  selfViewTile: {
    backgroundColor: TILE_IDLE_FILL,
    borderRadius: 16,
    paddingTop: 12,
    paddingBottom: 10,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    minHeight: 118,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  selfViewTileLabel: {
    fontSize: 12,
    lineHeight: 15,
    paddingHorizontal: 6,
  },
})
