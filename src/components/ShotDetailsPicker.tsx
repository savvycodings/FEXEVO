import { useContext, useMemo, useState } from 'react'
import {
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
import { FlowBackButton } from './shotFlow/FlowBackButton'
import { ShotStepper } from './shotFlow/ShotStepper'
import { ShotTile } from './shotFlow/ShotTile'
import { PG, glow } from '../screens/progress/progressTheme'
import { TEST_IDS } from '../lib/testIds'

const HORIZONTAL_PAD = 24
const GRID_GAP = 12
const ANGLE_COLS = 3
const ANGLE_GAP = 10
const ANGLE_TILE_ASPECT = 155 / 117
/** Near-square tiles like the mockup, capped so tablets don't get huge boxes. */
const TILE_ASPECT = 0.95
const TILE_MAX_H = 180

export type ShotPickerStep = 'shot' | 'type' | 'camera'

export type ShotDetailsPickerProps = {
  /** Uploaded clip, shown as the thumbnail beside the stepper. */
  videoUri: string | null
  /** Leaves the flow (Back on the first step). */
  onBack: () => void
  onDone: (shot: UserShotDeclaration) => void
  /** Reopening from Set Clip: restore these choices. */
  initialShot?: UserShotDeclaration | null
  initialStep?: ShotPickerStep
}

/** Finds the analysis group + shot item for a declaration made earlier. */
function restoreChoice(shot: UserShotDeclaration | null | undefined): {
  coreGroup: AnalysisCoreGroup | null
  item: CoachUploadShotItem | null
} {
  if (!shot) return { coreGroup: null, item: null }
  for (const c of ANALYSIS_CORE_CATEGORIES) {
    if (c.category !== shot.category) continue
    const item = ANALYSIS_CORE_SHOTS[c.coreGroup].find((s) => s.presetId === shot.strokePreset)
    if (item) return { coreGroup: c.coreGroup, item }
  }
  return { coreGroup: null, item: null }
}

/**
 * After upload/record: declare the shot one step per page (category → type → camera angle)
 * before Set Clip. Uses the analysis-supported shot list, so every pick is one the analyser scores.
 */
export function ShotDetailsPicker({ videoUri, onBack, onDone, initialShot, initialStep }: ShotDetailsPickerProps) {
  const { t } = useTranslation()
  const { theme: ctx } = useContext(ThemeContext)
  const theme = ctx?.backgroundColor != null ? ctx : defaultTheme
  const { width: winW } = useWindowDimensions()

  const restored = useMemo(() => restoreChoice(initialShot), [initialShot])
  const [coreGroup, setCoreGroup] = useState<AnalysisCoreGroup | null>(restored.coreGroup)
  const [shot, setShot] = useState<CoachUploadShotItem | null>(restored.item)
  const [viewId, setViewId] = useState<CameraAngleId | null>(
    restored.item ? ((initialShot?.viewId as CameraAngleId | undefined) ?? null) : null
  )
  const [step, setStep] = useState<ShotPickerStep>(restored.item ? initialStep ?? 'shot' : 'shot')
  const [exampleAngleId, setExampleAngleId] = useState<CameraAngleId | null>(null)

  const contentW = Math.min(winW, 640) - HORIZONTAL_PAD * 2
  const tileW = (contentW - GRID_GAP) / 2
  const tileH = Math.min(TILE_MAX_H, Math.round(tileW * TILE_ASPECT))
  const angleW = Math.floor((contentW - ANGLE_GAP * (ANGLE_COLS - 1)) / ANGLE_COLS) - 1

  const group = ANALYSIS_CORE_CATEGORIES.find((c) => c.coreGroup === coreGroup) ?? null
  const shots = coreGroup ? ANALYSIS_CORE_SHOTS[coreGroup] : []
  const canContinue = group != null && shot != null && viewId != null

  const fonts = useMemo(
    () => ({ regular: theme.regularFont, medium: theme.mediumFont, semiBold: theme.semiBoldFont }),
    [theme.regularFont, theme.mediumFont, theme.semiBoldFont]
  )

  const stepEnabled = (key: ShotPickerStep) =>
    key === 'shot' || (key === 'type' && coreGroup != null) || (key === 'camera' && shot != null)

  const goBack = () => {
    if (step === 'camera') setStep('type')
    else if (step === 'type') setStep('shot')
    else onBack()
  }

  const pickGroup = (next: AnalysisCoreGroup) => {
    if (next !== coreGroup) {
      setShot(null)
      setViewId(null)
    }
    setCoreGroup(next)
    setStep('type')
  }

  const pickShot = (next: CoachUploadShotItem) => {
    setShot(next)
    setStep('camera')
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

  const shotLabel = (s: CoachUploadShotItem) =>
    s.labelLine2Key ? `${t(s.labelKey)} ${t(s.labelLine2Key)}` : t(s.labelKey)

  /** Two columns; an odd last tile spans the full width (Serve in the mockup). */
  const tileWidth = (index: number, count: number) =>
    count % 2 === 1 && index === count - 1 ? contentW : tileW

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FlowBackButton
          onPress={goBack}
          fontFamily={fonts.regular}
          testID={TEST_IDS.shotPickerBack}
          style={styles.back}
        />
        <ShotStepper
          steps={[
            { key: 'shot', label: t('technique.shotPicker.tabShot') },
            { key: 'type', label: t('technique.shotPicker.tabType') },
            { key: 'camera', label: t('technique.shotPicker.tabCamera') },
          ]}
          current={step}
          enabled={stepEnabled}
          onPress={setStep}
          fontFamily={fonts.regular}
          thumbnail={
            videoUri ? (
              <Video
                source={{ uri: videoUri }}
                style={StyleSheet.absoluteFill}
                videoStyle={{ width: '100%', height: '100%' }}
                resizeMode={ResizeMode.COVER}
                shouldPlay={false}
                isMuted
              />
            ) : (
              <View />
            )
          }
        />

        {step === 'shot' ? (
          <View style={styles.section}>
            <Text allowFontScaling={false} style={[styles.title, { fontFamily: fonts.medium }]}>
              {t('studentProfile.shotCategoryTitle')}
            </Text>
            <Text allowFontScaling={false} style={[styles.subtitle, { fontFamily: fonts.regular }]}>
              {t('technique.shotPicker.categorySubtitle')}
            </Text>
            <View style={styles.grid}>
              {ANALYSIS_CORE_CATEGORIES.map((c, i) => (
                <ShotTile
                  key={c.coreGroup}
                  label={t(c.labelKey)}
                  selected={c.coreGroup === coreGroup}
                  width={tileWidth(i, ANALYSIS_CORE_CATEGORIES.length)}
                  height={tileH}
                  onPress={() => pickGroup(c.coreGroup)}
                  fontFamily={fonts.medium}
                  testID={TEST_IDS.shotCategory(c.coreGroup)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {step === 'type' ? (
          <View style={styles.section}>
            <Text allowFontScaling={false} style={[styles.title, { fontFamily: fonts.medium }]}>
              {t('technique.shotPicker.shotType')}
            </Text>
            <Text allowFontScaling={false} style={[styles.subtitle, { fontFamily: fonts.regular }]}>
              {t('technique.shotPicker.typeSubtitle')}
            </Text>
            <View style={styles.grid}>
              {shots.map((s, i) => (
                <ShotTile
                  key={s.presetId + s.labelKey}
                  label={shotLabel(s)}
                  selected={shot?.labelKey === s.labelKey}
                  width={tileWidth(i, shots.length)}
                  height={tileH}
                  onPress={() => pickShot(s)}
                  fontFamily={fonts.medium}
                  testID={TEST_IDS.shotOption(s.presetId)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {step === 'camera' ? (
          <View style={styles.section}>
            <View style={styles.titleRow}>
              <Text allowFontScaling={false} style={[styles.title, styles.titleInRow, { fontFamily: fonts.medium }]}>
                {t('technique.shotPicker.cameraAngle')}
              </Text>
              <TouchableOpacity
                onPress={() => setExampleAngleId(viewId ?? CAMERA_ANGLES[0]!.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={t('technique.shotPicker.cameraAngle')}
              >
                <Ionicons name="information-circle-outline" size={28} color={PG.labelBlue} />
              </TouchableOpacity>
            </View>
            <Text allowFontScaling={false} style={[styles.subtitle, { fontFamily: fonts.regular }]}>
              {t('technique.shotPicker.cameraSubtitle')}
            </Text>
            <View style={styles.angleGrid}>
              {CAMERA_ANGLES.map((angle) => (
                <ShotTile
                  key={angle.id}
                  image={angle.tile}
                  selected={viewId === angle.id}
                  width={angleW}
                  height={Math.round(angleW * ANGLE_TILE_ASPECT)}
                  onPress={() => setExampleAngleId(angle.id)}
                  testID={TEST_IDS.viewAngle(angle.id)}
                  accessibilityLabel={t(angle.labelKey)}
                />
              ))}
            </View>
            {canContinue ? (
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={finish}
                testID={TEST_IDS.setClipContinue}
                style={[styles.continueOuter, glow(16, 0.6)]}
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={['#5BC0FF', '#0A2BFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.continueGradient}
                >
                  <Text allowFontScaling={false} style={[styles.continueText, { fontFamily: fonts.medium }]}>
                    {t('studentProfile.continueToSetClip')}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
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
    paddingTop: 16,
    paddingBottom: 40,
  },
  back: { marginBottom: 18 },
  section: { marginTop: 24 },
  title: { color: '#FFFFFF', fontSize: 28, lineHeight: 34 },
  titleInRow: { flexShrink: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  subtitle: { color: '#8FA8D6', fontSize: 16, lineHeight: 22, marginTop: 8, marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  angleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: ANGLE_GAP, marginBottom: 28 },
  continueOuter: { borderRadius: 20 },
  continueGradient: { height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  continueText: { color: '#FFFFFF', fontSize: 18 },
})
