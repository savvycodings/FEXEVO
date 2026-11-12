import { useContext, useMemo } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { LinearGradient } from 'expo-linear-gradient'
import { ThemeContext } from '../../context'
import { CoachTabOrb } from '../../components/CoachCharacterAvatar'
import { LocalSvgAsset } from '../../components/LocalSvgAsset'
import { useContactJoints, type ContactJoint, type JointReading } from '../../lib/jointsApi'
import { mistakeFocusOrder, type MistakeId } from './BiggestMistakesView'

type Props = {
  shotLabel: string | null
  errors: string[]
  analysisId?: string | null
  /** Thumbnail at contact, when available. */
  thumbUri?: string | null
  onOpenFix: (id: MistakeId) => void
  onSeeCorrectMovement: () => void
}

const GOOD = '#11DF97'
const HIGH = '#E53C3C'
const ADJUST = '#FF8000'
const MUTED = 'rgba(255,255,255,0.75)'

const ICON_TARGET = require('../../../assets/aicoach/analysis/action-plan/icon-target.svg')
const ICON_ELBOW = require('../../../assets/aicoach/analysis/action-plan/icon-elbow.svg')
const ICON_RACKET = require('../../../assets/aicoach/analysis/action-plan/icon-racket.svg')
const ICON_CHEVRON = require('../../../assets/aicoach/analysis/action-plan/icon-chevron.svg')
const ICON_PLAY = require('../../../assets/aicoach/analysis/action-plan/icon-play.svg')
const ICON_ARROW = require('../../../assets/aicoach/analysis/action-plan/icon-arrow.svg')
const POSE_FALLBACK = require('../../../assets/aicoach/analysis/action-plan/pose-thumb.png')

const TITLE_KEY: Record<MistakeId, string> = {
  elbow: 'analysis.mistakeElbow',
  racket: 'analysis.mistakeRacket',
  torso: 'analysis.mistakeTorso',
  foot: 'analysis.mistakeFoot',
}

const JOINT_FOR: Record<MistakeId, ContactJoint | null> = {
  elbow: 'elbow',
  racket: 'wrist',
  torso: 'torso',
  foot: 'knee',
}

const ROW_ICON: Record<MistakeId, number> = {
  elbow: ICON_ELBOW,
  racket: ICON_RACKET,
  torso: ICON_ELBOW,
  foot: ICON_RACKET,
}

/**
 * Your analysis → Action Plan tab (Figma 6194:103613).
 * Coaching mascot card, Top Priority / Secondary Fixes with angles, Correct Movement CTA.
 */
export function ActionPlanPage({
  shotLabel,
  errors,
  analysisId = null,
  thumbUri = null,
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

  const shotName = shotLabel?.trim() || t('analysis.viewAnglesPage.shotFallback')
  const reading = (id: MistakeId): JointReading | null => {
    const joint = JOINT_FOR[id]
    if (!joint || !contact) return null
    return contact.joints[joint] ?? null
  }

  return (
    <View style={styles.page} testID="action-plan">
      <View style={styles.planCard}>
        <View style={styles.mascot} accessibilityElementsHidden>
          {/* Same Assistant-tab orb + multicolor radial ring. */}
          <CoachTabOrb ring ballSize={36} />
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

      <View style={styles.sections}>
        <View style={styles.block}>
          <SectionHead
            tone="high"
            title={t('analysis.topPriority')}
            subtitle={t('analysis.fixFirst')}
            fontMed={theme.mediumFont}
          />
          <FixRow
            id={ordered.first}
            badge={1}
            severity="high"
            thumbUri={thumbUri}
            reading={reading(ordered.first)}
            onPress={() => onOpenFix(ordered.first)}
            fontMed={theme.mediumFont}
            fontBold={theme.boldFont ?? theme.semiBoldFont}
          />
        </View>

        {ordered.rest.length ? (
          <View style={styles.block}>
            <SectionHead
              tone="medium"
              title={t('analysis.secondaryFixes')}
              subtitle={t('analysis.improveNext')}
              fontMed={theme.mediumFont}
            />
            {ordered.rest.map((id, i) => (
              <View key={id}>
                {i > 0 ? <View style={styles.rowDivider} /> : null}
                <FixRow
                  id={id}
                  badge={i + 2}
                  severity="medium"
                  thumbUri={thumbUri}
                  reading={reading(id)}
                  onPress={() => onOpenFix(id)}
                  fontMed={theme.mediumFont}
                  fontBold={theme.boldFont ?? theme.semiBoldFont}
                />
              </View>
            ))}
          </View>
        ) : null}
      </View>

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
        <LocalSvgAsset assetModule={ICON_PLAY} width={32} height={32} />
        <Text allowFontScaling={false} style={[styles.ctaLabel, { fontFamily: theme.semiBoldFont }]}>
          {t('analysis.seeCorrectMovement')}
        </Text>
        <View style={styles.ctaArrow}>
          <LocalSvgAsset assetModule={ICON_ARROW} width={32} height={32} />
        </View>
      </Pressable>
    </View>
  )
}

function SectionHead({
  tone,
  title,
  subtitle,
  fontMed,
}: {
  tone: 'high' | 'medium'
  title: string
  subtitle: string
  fontMed?: string
}) {
  const high = tone === 'high'
  return (
    <View style={styles.sectionHead}>
      <View
        style={[
          styles.sectionIcon,
          high ? styles.sectionIconHigh : styles.sectionIconMed,
        ]}
      >
        <LocalSvgAsset assetModule={ICON_TARGET} width={20} height={20} />
      </View>
      <View style={styles.sectionHeadCopy}>
        <Text allowFontScaling={false} style={[styles.sectionTitle, { fontFamily: fontMed }]}>
          {title}
        </Text>
        <Text allowFontScaling={false} style={[styles.sectionSub, { fontFamily: fontMed }]}>
          {subtitle}
        </Text>
      </View>
    </View>
  )
}

function FixRow({
  id,
  badge,
  severity,
  thumbUri,
  reading,
  onPress,
  fontMed,
  fontBold,
}: {
  id: MistakeId
  badge: number
  severity: 'high' | 'medium'
  thumbUri: string | null
  reading: JointReading | null
  onPress: () => void
  fontMed?: string
  fontBold?: string
}) {
  const { t } = useTranslation()
  const high = severity === 'high'
  const tone = high ? HIGH : ADJUST
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
  const pill = high ? t('analysis.mistakeHighPriority') : t('analysis.adjustPriority')

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.fixRow}>
      <View style={styles.thumb}>
        <Image
          source={thumbUri ? { uri: thumbUri } : POSE_FALLBACK}
          style={styles.thumbImg}
          resizeMode="cover"
        />
        <View style={[styles.badge, { backgroundColor: high ? '#FF0000' : ADJUST }]}>
          <Text allowFontScaling={false} style={[styles.badgeText, { fontFamily: fontBold }]}>
            {badge}
          </Text>
        </View>
      </View>

      <View style={styles.fixMid}>
        <View style={styles.fixTitleRow}>
          <LocalSvgAsset assetModule={ROW_ICON[id]} width={24} height={24} />
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.fixTitle, { fontFamily: fontMed }]}>
            {t(TITLE_KEY[id])}
          </Text>
        </View>
        <View style={styles.metricRow}>
          <Text allowFontScaling={false} style={[styles.metricDeg, { color: tone, fontFamily: fontMed }]}>
            {you != null ? `${you}°` : '—'}
          </Text>
          <View style={styles.metricCopy}>
            <Text allowFontScaling={false} style={[styles.metricLine, { fontFamily: fontMed }]}>
              {t('analysis.viewAnglesPage.target')}
              <Text style={{ color: GOOD }}>{target != null ? `${target}°` : '—'}</Text>
            </Text>
            <Text allowFontScaling={false} style={[styles.metricLine, { fontFamily: fontMed }]}>
              {t('analysis.viewAnglesPage.difference')}
              <Text style={{ color: tone }}>
                {diff != null ? `${diff > 0 ? '+' : ''}${diff}°` : '—'}
              </Text>
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.fixRight}>
        <View
          style={[
            styles.sevPill,
            high ? styles.sevPillHigh : styles.sevPillMed,
          ]}
        >
          <Text
            allowFontScaling={false}
            style={[styles.sevLabel, { color: high ? '#FF7676' : ADJUST, fontFamily: fontMed }]}
          >
            {pill}
          </Text>
        </View>
        <LocalSvgAsset assetModule={ICON_CHEVRON} width={20} height={40} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  page: { alignSelf: 'stretch', gap: 20, paddingVertical: 15, paddingBottom: 8 },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00B8FF',
    backgroundColor: 'rgba(0, 72, 255, 0.2)',
    padding: 10,
    boxShadow: 'inset 0px 0px 20px 0px #0048FF',
  },
  mascot: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  planCopy: { flex: 1, minWidth: 0, gap: 5 },
  planTitle: { color: '#FFFFFF', fontSize: 16 },
  planBody: { color: MUTED, fontSize: 11, lineHeight: 15 },
  sections: { gap: 10, alignSelf: 'stretch' },
  block: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#001950',
    backgroundColor: '#030A17',
    overflow: 'hidden',
    boxShadow: 'inset 0px 0px 20px 0px #0048FF',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: 'rgba(7, 37, 109, 0.5)',
  },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconHigh: {
    borderColor: '#FF0000',
    backgroundColor: 'rgba(255, 0, 0, 0.25)',
  },
  sectionIconMed: {
    borderColor: ADJUST,
    backgroundColor: 'rgba(255, 128, 0, 0.25)',
  },
  sectionHeadCopy: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16 },
  sectionSub: { color: MUTED, fontSize: 9, flex: 1 },
  fixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 15,
    paddingRight: 10,
    paddingVertical: 10,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(134,167,210,0.35)',
    marginLeft: 15,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#00B8FF',
    overflow: 'hidden',
    backgroundColor: '#030A17',
  },
  thumbImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 9 },
  fixMid: { flex: 1, minWidth: 0, gap: 5 },
  fixTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  fixTitle: { color: '#FFFFFF', fontSize: 16, flexShrink: 1 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metricDeg: { fontSize: 32, lineHeight: 32 },
  metricCopy: { flex: 1, minWidth: 0, gap: 2 },
  metricLine: { color: MUTED, fontSize: 11 },
  fixRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sevPill: {
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sevPillHigh: {
    borderColor: '#FF0000',
    backgroundColor: 'rgba(255, 0, 4, 0.2)',
  },
  sevPillMed: {
    borderColor: ADJUST,
    backgroundColor: 'rgba(255, 128, 0, 0.15)',
  },
  sevLabel: { fontSize: 11 },
  cta: {
    height: 60,
    borderRadius: 100,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 35,
  },
  ctaLabel: { color: '#07256D', fontSize: 18 },
  ctaArrow: { transform: [{ rotate: '-90deg' }] },
})
