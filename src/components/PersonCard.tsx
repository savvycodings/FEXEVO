import React, { useContext, type ReactNode } from 'react'
import { Image, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext } from '../context'
import { CARD_GLOW, COACH_CARD_GLOW, UI } from './ui'
import { profileImageSource } from '../lib/defaultProfilePicture'
import { TierShield } from './TierShield'
import type { CoachTier } from '../lib/coachDirectoryApi'

const AVATAR = 64
const AVATAR_COACH_NARROW = 52
/** Coach card shield: 60 points, 52 on screens narrower than 375 points. */
const COACH_SHIELD = 60
const COACH_SHIELD_NARROW = 52
const NARROW_SCREEN = 375

/**
 * Search result card for a coach or friend: avatar, name, subtitle, location, optional tier shield.
 * `variant="coach"` is the Coaches list card: navy card with a glowing blue border, specialty
 * chips under the location, a larger shield, and `action` (the Follow button) in place of the
 * chevron. The default variant is the friend card and is unchanged.
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
  /** Coach variant: chip labels, already translated and capped by the caller. */
  chips?: string[]
  /** Coach variant: shown on the right in place of the chevron. */
  action?: ReactNode
}) {
  const { theme } = useContext(ThemeContext)
  const { width } = useWindowDimensions()
  const coach = variant === 'coach'
  const narrow = width < NARROW_SCREEN
  const avatar = coach && narrow ? AVATAR_COACH_NARROW : AVATAR
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
      <Image
        source={profileImageSource(imageUri)}
        style={{ width: avatar, height: avatar, borderRadius: avatar / 2 }}
        resizeMode="cover"
      />
      <View style={styles.textCol}>
        <View style={styles.nameRow}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.name, { fontFamily: theme.semiBoldFont }]}>
            {name}
          </Text>
          {verified ? <Ionicons name="checkmark-circle" size={18} color={UI.accentStrong} /> : null}
        </View>
        {subtitle ? (
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.subtitle, { fontFamily: theme.regularFont }]}>
            {subtitle}
          </Text>
        ) : null}
        {location ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={12} color={UI.textMuted} />
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.location, { fontFamily: theme.regularFont }]}>
              {location}
            </Text>
          </View>
        ) : null}
        {coach && chips && chips.length > 0 ? (
          <View style={styles.chipRow} testID={testID ? `${testID}-chips` : undefined}>
            {chips.map((label) => (
              <View key={label} style={styles.chip}>
                <Text allowFontScaling={false} numberOfLines={1} style={[styles.chipText, { fontFamily: theme.mediumFont }]}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {coach ? (
        // Shield above the action keeps the text column wide enough for chips at phone widths.
        <View style={styles.coachSide}>
          {tier ? <TierShield tier={tier} width={narrow ? COACH_SHIELD_NARROW : COACH_SHIELD} /> : null}
          {action}
        </View>
      ) : (
        <>
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
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: UI.coachCardBorder,
    backgroundColor: UI.coachCardBg,
    ...COACH_CARD_GLOW,
  },
  textCol: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 17, color: '#FFFFFF', flexShrink: 1 },
  subtitle: { fontSize: 12, color: UI.textMuted, marginTop: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  location: { fontSize: 12, color: '#FFFFFF', flexShrink: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: UI.radiusPill,
    borderWidth: 1,
    borderColor: UI.chipBorder,
    backgroundColor: UI.chipBg,
    justifyContent: 'center',
    maxWidth: '100%',
  },
  chipText: { fontSize: 12, color: '#FFFFFF' },
  coachSide: { alignItems: 'center', gap: 10 },
})
