import { useContext, useMemo } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext } from '../../context'
import { CoachTabOrb } from '../../components/CoachCharacterAvatar'
import { LocalSvgAsset } from '../../components/LocalSvgAsset'
import { useContactJoints, type ContactJoint, type JointReading } from '../../lib/jointsApi'
import { poseAngle } from '../../lib/poseJointAngles'
import { nearestPoseByFrame, type PoseFrameRow } from '../../lib/techniquePose'
import { mistakeFocusOrder, type MistakeId } from './BiggestMistakesView'
import { BodyPartGlyph } from './bodyPartGlyphs'
import type { BodyPartId } from './jointIcons'
import { dominantSide } from './movementTimeline'

type Props = {
  shotLabel: string | null
  errors: string[]
  analysisId?: string | null
  /** Thumbnail at contact, when available. */
  thumbUri?: string | null
  /** Pose frames — fill missing /joints angles the same way Smart 3D does. */
  poseFrames?: PoseFrameRow[]
  impactFrame?: number | null
  onOpenFix: (id: MistakeId) => void
  onSeeCorrectMovement: () => void
}

const GOOD = '#11DF97'
const HIGH = '#E53C3C'
const MUTED = 'rgba(255,255,255,0.75)'

const ICON_CHEVRON = require('../../../assets/aicoach/analysis/action-plan/icon-chevron.svg')
const ICON_PLAY = require('../../../assets/aicoach/analysis/action-plan/icon-play.svg')
const ICON_ARROW = require('../../../assets/aicoach/analysis/action-plan/icon-arrow.svg')
const ICON_BULB = require('../../../assets/aicoach/analysis/action-plan/icon-coaching-bulb.png')
const POSE_FALLBACK = require('../../../assets/aicoach/analysis/action-plan/pose-thumb.png')

const TITLE_KEY: Record<MistakeId, string> = {
  elbow: 'analysis.mistakeElbow',
  racket: 'analysis.mistakeRacket',
  torso: 'analysis.mistakeTorso',
  foot: 'analysis.mistakeFoot',
}

const BODY_KEY: Record<MistakeId, string> = {
  elbow: 'analysis.mistakeElbowBody',
  racket: 'analysis.mistakeRacketBody',
  torso: 'analysis.mistakeTorsoBody',
  foot: 'analysis.mistakeFootBody',
}

const WHY_KEY: Record<MistakeId, string> = {
  elbow: 'analysis.mistakeElbowWhy',
  racket: 'analysis.mistakeRacketWhy',
  torso: 'analysis.mistakeTorsoWhy',
  foot: 'analysis.mistakeFootWhy',
}

const JOINT_FOR: Record<MistakeId, ContactJoint | null> = {
  elbow: 'elbow',
  racket: 'wrist',
  torso: 'torso',
  foot: 'knee',
}

/** Rail glyph for each fix (foot uses the rail's `feet` icon). */
const ROW_PART: Record<MistakeId, BodyPartId> = {
  elbow: 'elbow',
  racket: 'racket',
  torso: 'torso',
  foot: 'feet',
}

function metricParts(reading: JointReading | null) {
  const you = reading?.you != null ? Math.round(reading.you) : null
  const target =
    reading?.pro != null
      ? Math.round(reading.pro)
      : reading?.idealMin != null && reading?.idealMax != null
        ? Math.round((reading.idealMin + reading.idealMax) / 2)
        : null
  const diff =
    reading?.deltaDeg != null
      ? Math.round(reading.deltaDeg)
      : you != null && target != null
        ? you - target
        : null
  return { you, target, diff }
}

/**
 * Your analysis → Action Plan tab (Figma reference).
 * Priority 01 card + Improve Next tiles with per-fix coaching cues.
 */
export function ActionPlanPage({
  shotLabel,
  errors,
  analysisId = null,
  thumbUri = null,
  poseFrames,
  impactFrame = null,
  onOpenFix,
  onSeeCorrectMovement,
}: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const contact = useContactJoints(analysisId)

  const ordered = useMemo(() => {
    const focus = mistakeFocusOrder(errors)
    const fallback: MistakeId[] = ['elbow', 'racket', 'torso']
    const list = focus.length ? focus : fallback
    return { first: list[0]!, rest: list.slice(1, 3) }
  }, [errors])

  const contactPose = useMemo(() => {
    if (!poseFrames?.length) return null
    const last = poseFrames.reduce((max, row) => Math.max(max, row.frame), 0)
    const frame = impactFrame != null && impactFrame >= 0 ? impactFrame : Math.round(last * 0.6)
    return nearestPoseByFrame(poseFrames, frame)
  }, [poseFrames, impactFrame])

  const side = contact?.side ?? (poseFrames?.length ? dominantSide(poseFrames) : 'RIGHT')

  const shotName = shotLabel?.trim() || t('analysis.viewAnglesPage.shotFallback')
  const reading = (id: MistakeId): JointReading | null => {
    const joint = JOINT_FOR[id]
    if (!joint) return null
    const served = contact?.joints[joint] ?? null
    // /joints can lag or miss a landmark (esp. wrist→racket on Android). Fill `you` from pose.
    if (served?.you != null) return served
    const you = contactPose ? poseAngle(contactPose, joint, side) : null
    if (you == null) return served
    const rounded = Math.round(you)
    const pro = served?.pro ?? null
    return {
      ...(served ?? {
        pro: null,
        idealMin: null,
        idealMax: null,
        deltaDeg: null,
        status: null,
        direction: null,
        messageKey: null,
      }),
      you: rounded,
      deltaDeg: pro != null ? rounded - pro : served?.deltaDeg ?? null,
    }
  }

  function coachingCue(id: MistakeId, r: JointReading | null): string | null {
    const deg = r?.deltaDeg != null ? Math.abs(Math.round(r.deltaDeg)) : 0
    if (r?.messageKey) {
      const key = `analysis.${r.messageKey}`
      const translated = t(key, { deg })
      if (translated && translated !== key) return translated
    }
    return t(WHY_KEY[id])
  }

  const firstReading = reading(ordered.first)
  const firstCue = coachingCue(ordered.first, firstReading)
  const firstMetrics = metricParts(firstReading)

  return (
    <View style={styles.page} testID="action-plan">
      <View style={styles.planCard}>
        <View style={styles.mascot} accessibilityElementsHidden>
          <CoachTabOrb ring ballSize={32} />
        </View>
        <View style={styles.planCopy}>
          <Text allowFontScaling={false} style={[styles.planTitle, { fontFamily: theme.mediumFont }]}>
            {t('analysis.yourCoachingPlan')}
          </Text>
          <Text allowFontScaling={false} style={[styles.planBody, { fontFamily: theme.mediumFont }]}>
            {t('analysis.yourCoachingPlanBody', { shot: shotName.toLowerCase() })}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={() => onOpenFix(ordered.first)}
        accessibilityRole="button"
        style={styles.priorityPress}
        testID="action-plan-priority"
      >
        {/*
          Box fill stays #030A17. Only the left red edge is Figma:
          border-image → bright #FF0005 on the left fading out;
          soft wash uses #E53D3D → transparent so the card body does not turn red.
        */}
        <LinearGradient
          colors={['#FF0005', 'rgba(255, 0, 5, 0.35)', 'rgba(255, 0, 5, 0)']}
          locations={[0, 0.12, 0.55]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.priorityBorder}
        >
          <View style={styles.priorityInner}>
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(229, 61, 61, 0.28)', 'rgba(229, 61, 61, 0.08)', 'transparent']}
              locations={[0, 0.45, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.priorityEdgeGlow}
            />
            <Text allowFontScaling={false} style={[styles.priorityEyebrow, { fontFamily: theme.mediumFont }]}>
              {t('analysis.priority01FixFirst')}
            </Text>
            <View style={styles.priorityTitleRow}>
              <BodyPartGlyph id={ROW_PART[ordered.first]} size={22} severity="high" />
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.priorityTitle, { fontFamily: theme.mediumFont }]}>
                {t(TITLE_KEY[ordered.first])}
              </Text>
            </View>

            <View style={styles.priorityMetrics}>
              <View style={styles.priorityThumb}>
                <Image
                  source={thumbUri ? { uri: thumbUri } : POSE_FALLBACK}
                  style={styles.thumbImg}
                  resizeMode="cover"
                />
                <View style={styles.thumbPlay}>
                  <Ionicons name="play" size={22} color="#FFFFFF" style={{ marginLeft: 2 }} />
                </View>
              </View>

              <View style={styles.metricsAndCue}>
                <View style={styles.metricCols}>
                  <View style={styles.metricCol}>
                    <Text allowFontScaling={false} style={[styles.metricLabel, { fontFamily: theme.mediumFont }]}>
                      {t('analysis.yourAngle')}
                    </Text>
                    <Text allowFontScaling={false} style={[styles.metricValue, { color: '#FFFFFF', fontFamily: theme.semiBoldFont }]}>
                      {firstMetrics.you != null ? `${firstMetrics.you}°` : '—'}
                    </Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricCol}>
                    <Text allowFontScaling={false} style={[styles.metricLabel, { fontFamily: theme.mediumFont }]}>
                      {t('analysis.viewAnglesPage.target').replace(/:\s*$/, '')}
                    </Text>
                    <Text allowFontScaling={false} style={[styles.metricValue, { color: GOOD, fontFamily: theme.semiBoldFont }]}>
                      {firstMetrics.target != null ? `${firstMetrics.target}°` : '—'}
                    </Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricCol}>
                    <Text allowFontScaling={false} style={[styles.metricLabel, { fontFamily: theme.mediumFont }]}>
                      {t('analysis.difference')}
                    </Text>
                    <Text allowFontScaling={false} style={[styles.metricValue, { color: HIGH, fontFamily: theme.semiBoldFont }]}>
                      {firstMetrics.diff != null
                        ? `${firstMetrics.diff > 0 ? '+' : ''}${firstMetrics.diff}°`
                        : '—'}
                    </Text>
                  </View>
                </View>

                {firstCue ? (
                  <View style={styles.cueBox}>
                    <Image source={ICON_BULB} style={styles.cueBulb} resizeMode="contain" />
                    <View style={styles.cueCopy}>
                      <Text allowFontScaling={false} style={[styles.cueTitle, { fontFamily: theme.semiBoldFont }]}>
                        {t('analysis.coachingCue')}
                      </Text>
                      <Text allowFontScaling={false} style={[styles.cueBody, { fontFamily: theme.regularFont }]}>
                        {firstCue}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </LinearGradient>
      </Pressable>

      {ordered.rest.length ? (
        <View style={styles.improveBlock}>
          <Text allowFontScaling={false} style={[styles.improveTitle, { fontFamily: theme.mediumFont }]}>
            {t('analysis.improveNext')}
          </Text>
          {ordered.rest.map((id, i) => {
            const r = reading(id)
            const { you, target } = metricParts(r)
            return (
              <Pressable
                key={id}
                onPress={() => onOpenFix(id)}
                accessibilityRole="button"
                style={styles.secondaryCard}
                testID={`action-plan-secondary-${id}`}
              >
                <View pointerEvents="none" style={styles.secondaryInset} />
                <View style={styles.secondaryBadge}>
                  <Text allowFontScaling={false} style={[styles.secondaryBadgeText, { fontFamily: theme.boldFont ?? theme.semiBoldFont }]}>
                    {String(i + 2).padStart(2, '0')}
                  </Text>
                </View>
                <BodyPartGlyph id={ROW_PART[id]} size={22} severity="medium" />
                <View style={styles.secondaryCopy}>
                  <Text allowFontScaling={false} numberOfLines={1} style={[styles.secondaryTitle, { fontFamily: theme.mediumFont }]}>
                    {t(TITLE_KEY[id])}
                  </Text>
                  <Text allowFontScaling={false} numberOfLines={2} style={[styles.secondaryBody, { fontFamily: theme.regularFont }]}>
                    {t(BODY_KEY[id])}
                  </Text>
                </View>
                <View style={styles.secondaryPill}>
                  <Text allowFontScaling={false} style={[styles.pillYou, { fontFamily: theme.mediumFont }]}>
                    {you != null ? `${you}°` : '—'}
                  </Text>
                  <Text allowFontScaling={false} style={styles.pillArrow}>
                    →
                  </Text>
                  <Text allowFontScaling={false} style={[styles.pillTarget, { fontFamily: theme.mediumFont }]}>
                    {target != null ? `${target}°` : '—'}
                  </Text>
                </View>
                <LocalSvgAsset assetModule={ICON_CHEVRON} width={16} height={32} />
              </Pressable>
            )
          })}
        </View>
      ) : null}

      <Pressable
        onPress={onSeeCorrectMovement}
        accessibilityRole="button"
        style={styles.cta}
        testID="action-plan-correct-movement"
      >
        <LinearGradient
          colors={['#A9D8FF', '#4DA6FF']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={['#00BBFF', '#0022FF']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { opacity: 0.55 }]}
        />
        <LocalSvgAsset assetModule={ICON_PLAY} width={28} height={28} />
        <Text allowFontScaling={false} style={[styles.ctaLabel, { fontFamily: theme.semiBoldFont }]}>
          {t('analysis.seeCorrectMovement')}
        </Text>
        <View style={styles.ctaArrow}>
          <LocalSvgAsset assetModule={ICON_ARROW} width={28} height={28} />
        </View>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { alignSelf: 'stretch', gap: 12, paddingVertical: 8, paddingBottom: 4 },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#00B8FF',
    backgroundColor: 'rgba(0, 72, 255, 0.2)',
    padding: 8,
    boxShadow: 'inset 0px 0px 20px 0px #0048FF',
  },
  mascot: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  planCopy: { flex: 1, minWidth: 0, gap: 3 },
  planTitle: { color: '#FFFFFF', fontSize: 15 },
  planBody: { color: MUTED, fontSize: 10, lineHeight: 13 },

  priorityPress: { alignSelf: 'stretch' },
  /** Thin left-weighted red ring only — does not recolor the card body. */
  priorityBorder: {
    borderRadius: 16,
    padding: 1.5,
  },
  priorityInner: {
    borderRadius: 14.5,
    backgroundColor: '#030A17',
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
    overflow: 'hidden',
    boxShadow: 'inset 0px 0px 28px 0px rgba(0, 72, 255, 0.4)',
  },
  /** Soft red wash along the left edge only. */
  priorityEdgeGlow: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 88,
  },
  priorityEyebrow: {
    color: HIGH,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  priorityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 4,
  },
  priorityTitle: { color: '#FFFFFF', fontSize: 16, flexShrink: 1 },
  /** Row: thumb fills remaining height; right column stacks metrics + cue. */
  priorityMetrics: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginLeft: 4,
  },
  /** Thumb: fixed width, stretches to match right column height. */
  priorityThumb: {
    width: 125,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#030A17',
  },
  thumbImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  thumbPlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Right column: metrics on top, coaching cue below. */
  metricsAndCue: {
    flex: 1,
    gap: 8,
  },
  /** Three metric columns with pipe dividers — fixed height content only. */
  metricCols: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricCol: { flex: 1, alignItems: 'center', gap: 3 },
  /** Thin vertical pipe between metric columns — fixed height so it matches text only. */
  metricDivider: {
    width: 1,
    height: 44,
    backgroundColor: 'rgba(91, 108, 255, 0.55)',
  },
  metricLabel: { color: MUTED, fontSize: 9, textAlign: 'center' },
  metricValue: { fontSize: 18, lineHeight: 22, textAlign: 'center' },

  /** Figma: 201×65, radius 20, pad/gap 10, bg #0048FF33, border #00B8FF, inset #0048FF. */
  cueBox: {
    flex: 1,
    minHeight: 65,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00B8FF',
    backgroundColor: '#0048FF33',
    padding: 10,
    boxShadow: '0px 0px 20px 0px #0048FF inset',
  },
  // Layout footprint stays ~20 so the cue copy does not shift; scale draws it larger.
  cueBulb: { width: 20, height: 20, marginTop: 6, transform: [{ scale: 1.55 }] },
  cueCopy: { flex: 1, minWidth: 0, gap: 2 },
  cueTitle: { color: '#FFFFFF', fontSize: 12 },
  cueBody: { color: MUTED, fontSize: 10, lineHeight: 13 },

  improveBlock: { gap: 10, alignSelf: 'stretch' },
  improveTitle: { color: '#FFFFFF', fontSize: 15 },
  secondaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#032C91',
    backgroundColor: '#030A17',
    paddingVertical: 10,
    paddingHorizontal: 10,
    minHeight: 68,
    overflow: 'hidden',
  },
  secondaryInset: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    boxShadow: 'inset 0px 0px 28px 0px rgba(0, 72, 255, 0.45)',
  },
  /** Orange outline badge: border + low-opacity fill, matching the reference. */
  secondaryBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 128, 0, 0.18)',
    borderWidth: 1.5,
    borderColor: '#FF8000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBadgeText: { color: '#FFFFFF', fontSize: 11 },
  secondaryCopy: { flex: 1, minWidth: 0, gap: 1 },
  secondaryTitle: { color: '#FFFFFF', fontSize: 13 },
  secondaryBody: { color: MUTED, fontSize: 10, lineHeight: 13 },
  secondaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0, 184, 255, 0.55)',
    backgroundColor: 'rgba(0, 72, 255, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    boxShadow: 'inset 0px 0px 10px 0px rgba(0, 72, 255, 0.35)',
  },
  pillYou: { color: '#FFFFFF', fontSize: 11 },
  pillArrow: { color: MUTED, fontSize: 11 },
  pillTarget: { color: GOOD, fontSize: 11 },

  cta: {
    height: 52,
    borderRadius: 100,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  ctaLabel: { color: '#07256D', fontSize: 16 },
  ctaArrow: { transform: [{ rotate: '-90deg' }] },
})
