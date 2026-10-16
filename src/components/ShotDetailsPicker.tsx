import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { vercel as defaultTheme } from '../theme'
import type { AnalysisCoreGroup, UserShotDeclaration } from '../navigation/types'
import { ANALYSIS_CORE_CATEGORIES, ANALYSIS_CORE_SHOTS, type CoachUploadShotItem } from '../lib/coachStudentUploadShots'
import { CAMERA_ANGLES, type CameraAngleId } from '../lib/cameraAngles'
import { CameraAngleExampleModal } from './CameraAngleExampleModal'
import { TEST_IDS } from '../lib/testIds'

const HORIZONTAL_PAD = 24
const GRID_GAP = 12
const ANGLE_COLS = 3
const ANGLE_GAP = 10
const ANGLE_TILE_ASPECT = 155 / 117
/** Gap kept above a section when a tab scrolls to it. */
const SCROLL_OFFSET = 12
const THUMB_SIZE = 96

const ACCENT = '#2A88F4'
const ACCENT_MUTED = '#1848BA'
const PILL_BG = '#0A1E5C'
const PILL_SELECTED_BG = '#0034A6'
const PILL_SELECTED_STROKE = '#00B8FF'
const BACK_MUTED = '#86A7D2'

type Tab = 'shot' | 'type' | 'camera'

export type ShotDetailsPickerProps = {
  /** Uploaded clip, shown as the thumbnail in the corner. */
  videoUri: string | null
  onBack: () => void
  onDone: (shot: UserShotDeclaration) => void
}

/**
 * After upload/record: one page to declare the shot (category → type → camera angle) before
 * Set Clip. Uses the analysis-supported shot list, so every pick is one the analyser scores.
 */
export function ShotDetailsPicker({ videoUri, onBack, onDone }: ShotDetailsPickerProps) {
  const { t } = useTranslation()
  const { theme: ctx } = useContext(ThemeContext)
  const theme = ctx?.backgroundColor != null ? ctx : defaultTheme
  const { width: winW } = useWindowDimensions()

  const [coreGroup, setCoreGroup] = useState<AnalysisCoreGroup | null>(null)
  const [shot, setShot] = useState<CoachUploadShotItem | null>(null)
  const [viewId, setViewId] = useState<CameraAngleId | null>(null)
  const [exampleAngleId, setExampleAngleId] = useState<CameraAngleId | null>(null)

  const scrollRef = useRef<ScrollView>(null)
  const sectionY = useRef<Record<Tab, number>>({ shot: 0, type: 0, camera: 0 })
  /** Tab shown as current: follows taps and the scroll position. */
  const [viewTab, setViewTab] = useState<Tab>('shot')
  /** Ignore scroll events from our own animated scroll so the highlight doesn't flicker through tabs. */
  const programmaticUntil = useRef(0)
  const [viewportH, setViewportH] = useState(0)
  const [lastSectionY, setLastSectionY] = useState(0)
  const [contentEndY, setContentEndY] = useState(0)

  const contentW = Math.min(winW, 640) - HORIZONTAL_PAD * 2
  const pillW = (contentW - GRID_GAP) / 2
  const angleW = Math.floor((contentW - ANGLE_GAP * (ANGLE_COLS - 1)) / ANGLE_COLS) - 1

  const group = ANALYSIS_CORE_CATEGORIES.find((c) => c.coreGroup === coreGroup) ?? null
  const shots = coreGroup ? ANALYSIS_CORE_SHOTS[coreGroup] : []
  const lastTab: Tab = !coreGroup ? 'shot' : !shot ? 'type' : 'camera'
  // Room below the last section so any section can scroll up to the top.
  const bottomSpacer = Math.max(40, viewportH - (contentEndY - lastSectionY) - SCROLL_OFFSET)
  useEffect(() => setLastSectionY(sectionY.current[lastTab]), [lastTab])
  const canContinue = group != null && shot != null && viewId != null

  const fonts = useMemo(
    () => ({ regular: theme.regularFont, medium: theme.mediumFont, semiBold: theme.semiBoldFont }),
    [theme.regularFont, theme.mediumFont, theme.semiBoldFont]
  )

  const scrollTo = (tab: Tab) => {
    setViewTab(tab)
    programmaticUntil.current = Date.now() + 600
    scrollRef.current?.scrollTo({ y: Math.max(0, sectionY.current[tab] - SCROLL_OFFSET), animated: true })
  }

  const onScroll = (y: number) => {
    if (Date.now() < programmaticUntil.current) return
    const order: Tab[] = ['shot', 'type', 'camera']
    const reachable = order.slice(0, order.indexOf(lastTab) + 1)
    let current: Tab = 'shot'
    for (const tab of reachable) if (sectionY.current[tab] - SCROLL_OFFSET <= y + 24) current = tab
    setViewTab(current)
  }

  const onSectionLayout = (tab: Tab, y: number) => {
    sectionY.current[tab] = y
    if (tab === lastTab) setLastSectionY(y)
  }

  const pickGroup = (next: AnalysisCoreGroup) => {
    if (next !== coreGroup) setShot(null)
    setCoreGroup(next)
    setTimeout(() => scrollTo('type'), 50)
  }

  const pickShot = (next: CoachUploadShotItem) => {
    setShot(next)
    setTimeout(() => scrollTo('camera'), 50)
  }

  const finish = () => {
    if (!group || !shot || !viewId) return
    onDone({
      category: group.category,
      strokePreset: shot.presetId,
      shotLabel: shot.labelLine2Key ? `${t(shot.labelKey)} ${t(shot.labelLine2Key)}` : t(shot.labelKey),
      skillLevel: '',
      viewId,
    })
  }

  const tabs: { id: Tab; n: number; label: string }[] = [
    { id: 'shot', n: 1, label: t('technique.shotPicker.tabShot') },
    { id: 'type', n: 2, label: t('technique.shotPicker.tabType') },
    { id: 'camera', n: 3, label: t('technique.shotPicker.tabCamera') },
  ]
  const tabEnabled = (id: Tab) => id === 'shot' || (id === 'type' && coreGroup != null) || (id === 'camera' && shot != null)

  const renderPill = (key: string, label: string, selected: boolean, onPress: () => void, testID: string) => (
    <TouchableOpacity
      key={key}
      activeOpacity={0.82}
      onPress={onPress}
      testID={testID}
      style={[styles.pill, { width: pillW }, selected && styles.pillSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text allowFontScaling={false} style={[styles.pillText, { fontFamily: fonts.medium }, selected && styles.pillTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  )

  return (
    <View style={styles.root}>
      {/* Pinned: back, step tabs and clip thumbnail stay visible while the options scroll. */}
      <View style={styles.header}>
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <TouchableOpacity
              onPress={onBack}
              activeOpacity={0.85}
              style={styles.backRow}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t('studentProfile.backToUploads')}
              testID={TEST_IDS.shotPickerBack}
            >
              <Ionicons name="chevron-back" size={30} color={BACK_MUTED} />
              <Text allowFontScaling={false} style={[styles.backLabel, { fontFamily: fonts.regular }]}>
                {t('studentProfile.backToUploads')}
              </Text>
            </TouchableOpacity>
            <View style={styles.tabsRow}>
              {tabs.map((tab) => {
                const active = tab.id === viewTab
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={styles.tab}
                    disabled={!tabEnabled(tab.id)}
                    onPress={() => scrollTo(tab.id)}
                    activeOpacity={0.8}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={[styles.tabText, { fontFamily: fonts.regular }, active && styles.tabTextActive]}
                    >
                      <Text style={{ fontFamily: fonts.semiBold }}>{tab.n}</Text> {tab.label}
                    </Text>
                    <View style={[styles.tabBar, active && styles.tabBarActive]} />
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
          <View style={styles.thumb}>
            {videoUri ? (
              <Video
                source={{ uri: videoUri }}
                style={StyleSheet.absoluteFill}
                videoStyle={{ width: '100%', height: '100%' }}
                resizeMode={ResizeMode.COVER}
                shouldPlay={false}
                isMuted
              />
            ) : null}
          </View>
        </View>
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={(e) => onScroll(e.nativeEvent.contentOffset.y)}
        onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
      >
        <View onLayout={(e) => onSectionLayout('shot', e.nativeEvent.layout.y)}>
          <Text allowFontScaling={false} style={[styles.sectionTitle, { fontFamily: fonts.medium }]}>
            {t('studentProfile.shotCategoryTitle')}
          </Text>
          <View style={styles.grid}>
            {ANALYSIS_CORE_CATEGORIES.map((c) =>
              renderPill(c.coreGroup, t(c.labelKey), c.coreGroup === coreGroup, () => pickGroup(c.coreGroup), TEST_IDS.shotCategory(c.coreGroup))
            )}
          </View>
        </View>

        {coreGroup ? (
          <View onLayout={(e) => onSectionLayout('type', e.nativeEvent.layout.y)}>
            <Text allowFontScaling={false} style={[styles.sectionTitle, { fontFamily: fonts.medium }]}>
              {t('technique.shotPicker.shotType')}
            </Text>
            <View style={styles.grid}>
              {shots.map((s) =>
                renderPill(
                  s.presetId + s.labelKey,
                  s.labelLine2Key ? `${t(s.labelKey)} ${t(s.labelLine2Key)}` : t(s.labelKey),
                  shot?.labelKey === s.labelKey,
                  () => pickShot(s),
                  TEST_IDS.shotOption(s.presetId)
                )
              )}
            </View>
          </View>
        ) : null}

        {shot ? (
          <View onLayout={(e) => onSectionLayout('camera', e.nativeEvent.layout.y)}>
            <View style={styles.sectionHeaderRow}>
              <Text allowFontScaling={false} style={[styles.sectionTitle, styles.sectionTitleInRow, { fontFamily: fonts.medium }]}>
                {t('technique.shotPicker.cameraAngle')}
              </Text>
              <TouchableOpacity
                onPress={() => setExampleAngleId(viewId ?? CAMERA_ANGLES[0]!.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={t('technique.shotPicker.cameraAngle')}
              >
                <Ionicons name="information-circle-outline" size={28} color={BACK_MUTED} />
              </TouchableOpacity>
            </View>
            <View style={styles.angleGrid}>
              {CAMERA_ANGLES.map((angle) => {
                const active = viewId === angle.id
                return (
                  <TouchableOpacity
                    key={angle.id}
                    activeOpacity={0.82}
                    onPress={() => setExampleAngleId(angle.id)}
                    testID={TEST_IDS.viewAngle(angle.id)}
                    style={[styles.angleTile, { width: angleW, height: Math.round(angleW * ANGLE_TILE_ASPECT) }, active && styles.angleTileActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={t(angle.labelKey)}
                  >
                    <Image source={angle.tile} style={styles.angleImage} resizeMode="contain" />
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        ) : null}

        {canContinue ? (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={finish}
            testID={TEST_IDS.setClipContinue}
            style={styles.continueOuter}
            accessibilityRole="button"
          >
            <LinearGradient colors={['#00B8FF', '#1848BA']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.continueGradient}>
              <Text allowFontScaling={false} style={[styles.continueText, { fontFamily: fonts.medium }]}>
                {t('studentProfile.continueToSetClip')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}
        <View onLayout={(e) => setContentEndY(e.nativeEvent.layout.y)} style={{ height: bottomSpacer }} />
      </ScrollView>

      <CameraAngleExampleModal
        visible={exampleAngleId != null}
        angleId={exampleAngleId ?? CAMERA_ANGLES[0]!.id}
        onChangeAngle={setExampleAngleId}
        onSelect={(id) => {
          setViewId(id)
          setExampleAngleId(null)
        }}
        onClose={() => setExampleAngleId(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  scroll: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: HORIZONTAL_PAD,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: HORIZONTAL_PAD,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(42,136,244,0.15)',
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  topLeft: { flex: 1, minWidth: 0 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 22, alignSelf: 'flex-start' },
  backLabel: { color: BACK_MUTED, fontSize: 12, lineHeight: 16 },
  tabsRow: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 10 },
  tabText: { color: ACCENT_MUTED, fontSize: 15 },
  tabTextActive: { color: ACCENT },
  tabBar: { alignSelf: 'stretch', height: 3, borderRadius: 2, backgroundColor: ACCENT_MUTED, opacity: 0.6 },
  tabBarActive: { backgroundColor: ACCENT, opacity: 1 },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: ACCENT,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  sectionTitle: { color: '#FFFFFF', fontSize: 24, lineHeight: 30, marginBottom: 18 },
  sectionTitleInRow: { marginBottom: 0 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, marginBottom: 40 },
  pill: {
    height: 56,
    borderRadius: 16,
    backgroundColor: PILL_BG,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  pillSelected: { backgroundColor: PILL_SELECTED_BG, borderColor: PILL_SELECTED_STROKE },
  pillText: { color: ACCENT, fontSize: 17, textAlign: 'center' },
  pillTextSelected: { color: '#FFFFFF' },
  angleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: ANGLE_GAP, marginBottom: 32 },
  angleTile: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#01194D', borderWidth: 2, borderColor: 'transparent' },
  angleTileActive: { borderColor: PILL_SELECTED_STROKE },
  angleImage: { width: '100%', height: '100%' },
  continueOuter: { borderRadius: 16, overflow: 'hidden' },
  continueGradient: { height: 58, alignItems: 'center', justifyContent: 'center' },
  continueText: { color: '#FFFFFF', fontSize: 18 },
})
