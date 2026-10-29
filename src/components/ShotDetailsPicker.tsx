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
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { vercel as defaultTheme } from '../theme'
import type { AnalysisCoreGroup, UserShotDeclaration } from '../navigation/types'
import { ANALYSIS_CORE_CATEGORIES, ANALYSIS_CORE_SHOTS, type CoachUploadShotItem } from '../lib/coachStudentUploadShots'
import { CAMERA_ANGLES, type CameraAngleId } from '../lib/cameraAngles'
import { CameraAngleExampleModal } from './CameraAngleExampleModal'
import { ShotStepper } from './shotFlow/ShotStepper'
import { ShotTile } from './shotFlow/ShotTile'
import { PG } from '../screens/progress/progressTheme'
import { GlowButton, UI } from './ui'
import { TEST_IDS } from '../lib/testIds'

const HORIZONTAL_PAD = 24
const GRID_GAP = 12
const ANGLE_GAP = 10
/** Design: front / back / side in a row of three, the four 45° angles in a row of four. */
const ANGLE_ROWS = [CAMERA_ANGLES.slice(0, 3), CAMERA_ANGLES.slice(3)]
/** Wide, short tiles like the design, capped so tablets don't get huge boxes. */
const TILE_ASPECT = 0.55
const TILE_MAX_H = 110

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
  const angleW = (cols: number) => Math.floor((contentW - ANGLE_GAP * (cols - 1)) / cols) - 1

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
        <ShotStepper
          onBack={goBack}
          backTestID={TEST_IDS.shotPickerBack}
          backAccessibilityLabel={t('analysis.back')}
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
            <Text allowFontScaling={false} style={[styles.title, { fontFamily: fonts.regular }]}>
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
            <Text allowFontScaling={false} style={[styles.title, { fontFamily: fonts.regular }]}>
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
              <Text allowFontScaling={false} style={[styles.title, styles.titleInRow, { fontFamily: fonts.regular }]}>
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
            <View style={styles.angleGrid}>
              {ANGLE_ROWS.map((row, r) => {
                const w = angleW(row.length)
                return (
                  <View key={r} style={styles.angleRow}>
                    {row.map((angle) => (
                      <ShotTile
                        key={angle.id}
                        image={angle.tile}
                        selected={viewId === angle.id}
                        width={w}
                        height={Math.round((w * angle.tileHeight) / angle.tileWidth)}
                        onPress={() => setExampleAngleId(angle.id)}
                        testID={TEST_IDS.viewAngle(angle.id)}
                        accessibilityLabel={t(angle.labelKey)}
                      />
                    ))}
                  </View>
                )
              })}
            </View>
            {canContinue ? (
              <GlowButton
                label={t('studentProfile.continueToSetClip')}
                onPress={finish}
                testID={TEST_IDS.setClipContinue}
              />
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
  section: { marginTop: 20 },
  title: { color: UI.text, fontSize: 24, lineHeight: 30 },
  titleInRow: { flexShrink: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  subtitle: { color: UI.textMuted, fontSize: 15, lineHeight: 21, marginTop: 14, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  angleGrid: { gap: ANGLE_GAP, marginTop: 14, marginBottom: 28 },
  angleRow: { flexDirection: 'row', gap: ANGLE_GAP },
})
