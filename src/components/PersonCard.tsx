import React, { useContext, useState, type ReactNode } from 'react'
import { Image, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext } from '../context'
import { CARD_GLOW, UI } from './ui'
import { profileImageSource } from '../lib/defaultProfilePicture'
import { fitChipCount } from '../lib/coachSpecialties'
import { TierShield } from './TierShield'
import { VerifiedBadge } from './VerifiedBadge'
import type { CoachTier } from '../lib/coachDirectoryApi'

const AVATAR = 64
/** Coach card avatar: a little smaller than the friend card's, to leave room for the text. */
const AVATAR_COACH = 62
const AVATAR_COACH_NARROW = 52
/** Coach card shield: 48 points, 40 on screens narrower than 375 points. */
const COACH_SHIELD = 48
const COACH_SHIELD_NARROW = 40
/** Design: subtitle, location and pin in a soft lavender. */
const COACH_MUTED = '#86A7D2'
const NARROW_SCREEN = 375
const CHIP_GAP = 5
/** Widest "+N" a card can need (at most 8 specialties, so N is one digit). */
const PLUS_TEMPLATE = '+8'

/**
 * One row of specialty chips: as many as fit (at most 3), then "+N" for the rest. Never wraps.
 * Chip widths are measured off-screen first, so the row only renders chips that fit whole.
 */
function ChipRow({ labels, font, testID }: { labels: string[]; font?: string; testID?: string }) {
  const [rowW, setRowW] = useState<number | null>(null)
  const [widths, setWidths] = useState<Record<number, number>>({})
  const [plusW, setPlusW] = useState<number | null>(null)
  const measured = rowW != null && plusW != null && labels.every((_, i) => widths[i] != null)
  const count = measured
    ? fitChipCount(labels.map((_, i) => widths[i]!), plusW!, rowW!, CHIP_GAP)
    : 0
  const rest = labels.length - count
  const chip = (label: string, key: string, onWidth?: (w: number) => void) => (
    <View
      key={key}
      style={styles.chip}
      onLayout={onWidth ? (e) => onWidth(Math.ceil(e.nativeEvent.layout.width)) : undefined}
    >
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.chipText, { fontFamily: font }]}>
        {label}
      </Text>
    </View>
  )
  return (
    <View style={styles.chipRow} onLayout={(e) => setRowW(Math.floor(e.nativeEvent.layout.width))} testID={testID}>
      {/* Off-screen measuring copy: every chip plus the widest "+N". */}
      <View style={styles.chipMeasure} pointerEvents="none" aria-hidden>
        {labels.map((label, i) =>
          chip(label, `m-${label}`, (w) => setWidths((prev) => (prev[i] === w ? prev : { ...prev, [i]: w }))),
        )}
        {chip(PLUS_TEMPLATE, 'm-plus', (w) => setPlusW(w))}
      </View>
      {measured ? (
        <>
          {labels.slice(0, count).map((label) => chip(label, label))}
          {rest > 0 ? chip(`+${rest}`, 'plus') : null}
        </>
      ) : null}
    </View>
  )
}

/**
 * Search result card for a coach or friend: avatar, name, subtitle, location, optional tier shield.
 * `variant="coach"` is the Coaches list card (design): dark card with an inner blue glow, a big
 * avatar, name / lavender subtitle / location with one row of specialty chips under the text, the
 * tier shield and a chevron. `action`, when given, replaces the chevron.
 * The default variant is the friend card and is unchanged.
 */
export function PersonCard({
  name,
  imageUri,
  subtitle,
  location,
  verified,
  tier,
  onPress,
  testID,
  variant = 'default',
  chips,
  action,
}: {
  name: string
  imageUri: string | null
  subtitle?: string | null
  location?: string | null
  verified?: boolean
  tier?: CoachTier
  onPress?: () => void
  testID?: string
  variant?: 'default' | 'coach'
  /** Coach variant: every chip label, translated, in display order. The card fits what it can. */
  chips?: string[]
  /** Coach variant: optional control shown on the right in place of the chevron. */
  action?: ReactNode
}) {
  const { theme } = useContext(ThemeContext)
  const { width } = useWindowDimensions()
  const coach = variant === 'coach'
  const narrow = width < NARROW_SCREEN
  const avatar = coach ? (narrow ? AVATAR_COACH_NARROW : AVATAR_COACH) : AVATAR

  const identity = (
    <>
      <Image
        source={profileImageSource(imageUri)}
        style={{ width: avatar, height: avatar, borderRadius: avatar / 2 }}
        resizeMode="cover"
      />
      <View style={styles.textCol}>
        <View style={styles.nameRow}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.name, coach && styles.nameCoach, { fontFamily: theme.semiBoldFont }]}
          >
            {name}
          </Text>
          {verified ? <VerifiedBadge size={14} /> : null}
        </View>
        {subtitle ? (
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.subtitle, coach && styles.subtitleCoach, { fontFamily: coach ? theme.mediumFont : theme.regularFont }]}
          >
            {subtitle}
          </Text>
        ) : null}
        {location ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={coach ? 14 : 12} color={coach ? COACH_MUTED : UI.textMuted} />
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.location, coach && styles.locationCoach, { fontFamily: theme.regularFont }]}
            >
              {location}
            </Text>
          </View>
        ) : null}
        {coach && chips && chips.length > 0 ? (
          <ChipRow labels={chips} font={theme.mediumFont} testID={testID ? `${testID}-chips` : undefined} />
        ) : null}
      </View>
    </>
  )

  return (
    <TouchableOpacity
      style={coach ? styles.coachCard : styles.card}
      activeOpacity={0.88}
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={name}
    >
      {coach ? (
        <>
          <View style={styles.coachTop}>{identity}</View>
          {tier ? <TierShield tier={tier} width={narrow ? COACH_SHIELD_NARROW : COACH_SHIELD} /> : null}
          {action ?? (onPress ? <Ionicons name="chevron-forward" size={22} color={COACH_MUTED} /> : null)}
        </>
      ) : (
        <>
          {identity}
          {tier ? <TierShield tier={tier} width={46} /> : null}
          {onPress ? <Ionicons name="chevron-forward" size={20} color={UI.textMuted} /> : null}
        </>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: UI.radiusCard,
    borderWidth: 1,
    borderColor: UI.cardBorder,
    backgroundColor: UI.cardBg,
    ...CARD_GLOW,
  },
  coachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#07256D',
    backgroundColor: '#030A17',
    boxShadow: '0px 0px 20px 0px rgba(0, 72, 255, 0.20), 0px 0px 30px 0px rgba(0, 72, 255, 0.50) inset',
  },
  coachTop: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  textCol: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 17, color: '#FFFFFF', flexShrink: 1 },
  nameCoach: { fontSize: 18 },
  subtitle: { fontSize: 12, color: UI.textMuted, marginTop: 2 },
  subtitleCoach: { fontSize: 11, color: COACH_MUTED },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  location: { fontSize: 12, color: '#FFFFFF', flexShrink: 1 },
  locationCoach: { fontSize: 13, color: COACH_MUTED },
  chipRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: CHIP_GAP, height: 24, overflow: 'hidden', marginTop: 8 },
  chipMeasure: { position: 'absolute', left: 0, top: 0, flexDirection: 'row', opacity: 0 },
  chip: {
    height: 24,
    paddingHorizontal: 9,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#1A2D80',
    backgroundColor: '#030A17',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chipText: { fontSize: 12, color: '#FFFFFF' },
})
