import React, { useContext } from 'react'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext } from '../context'
import { CARD_GLOW, UI } from './ui'
import { profileImageSource } from '../lib/defaultProfilePicture'
import { TierShield } from './TierShield'
import type { CoachTier } from '../lib/coachDirectoryApi'

const AVATAR = 64

/** Search result card for a coach or friend: avatar, name, subtitle, location, optional tier shield. */
export function PersonCard({
  name,
  imageUri,
  subtitle,
  location,
  verified,
  tier,
  onPress,
  testID,
}: {
  name: string
  imageUri: string | null
  subtitle?: string | null
  location?: string | null
  verified?: boolean
  tier?: CoachTier
  onPress?: () => void
  testID?: string
}) {
  const { theme } = useContext(ThemeContext)
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.88}
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={name}
    >
      <Image source={profileImageSource(imageUri)} style={styles.avatar} resizeMode="cover" />
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
      </View>
      {tier ? <TierShield tier={tier} width={46} /> : null}
      {onPress ? <Ionicons name="chevron-forward" size={20} color={UI.textMuted} /> : null}
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
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  textCol: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 17, color: '#FFFFFF', flexShrink: 1 },
  subtitle: { fontSize: 12, color: UI.textMuted, marginTop: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  location: { fontSize: 12, color: '#FFFFFF', flexShrink: 1 },
})
