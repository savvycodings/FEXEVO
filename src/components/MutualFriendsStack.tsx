import React, { useContext } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { profileImageSource } from '../lib/defaultProfilePicture'
import type { MutualFriends } from '../lib/friendsApi'
import { UI } from './ui'

const SIZE = 22
const OVERLAP = 8

/** Up to 3 overlapping mutual-friend avatars plus "N mutual friends". Renders nothing at 0. */
export function MutualFriendsStack({ mutual }: { mutual: MutualFriends }) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  if (mutual.count <= 0) return null
  const shown = mutual.friends.slice(0, 3)
  return (
    <View style={styles.row}>
      <View style={[styles.stack, { width: SIZE + (shown.length - 1) * (SIZE - OVERLAP) }]}>
        {shown.map((f, i) => (
          <Image
            key={f.id}
            source={profileImageSource(f.imageUri)}
            style={[styles.avatar, { left: i * (SIZE - OVERLAP), zIndex: shown.length - i }]}
          />
        ))}
      </View>
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.label, { fontFamily: theme.regularFont }]}>
        {t('friends.mutualFriends', { count: mutual.count })}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  stack: { height: SIZE },
  avatar: {
    position: 'absolute',
    top: 0,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    borderColor: '#8CB0E2',
  },
  label: { fontSize: 11, color: UI.textMuted, flexShrink: 1 },
})
