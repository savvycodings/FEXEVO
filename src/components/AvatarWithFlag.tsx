import React from 'react'
import { Image, StyleSheet, View } from 'react-native'
import { profileImageSource } from '../lib/defaultProfilePicture'
import { findCountry } from '../lib/countries'

/** Round avatar with the player's country flag in a circle at the bottom-right (when known). */
export function AvatarWithFlag({
  imageUri,
  areaLocation,
  size = 100,
  ring = false,
}: {
  imageUri: string | null
  areaLocation?: string | null
  size?: number
  /** Thin glowing ring, as on the request detail screen. */
  ring?: boolean
}) {
  const country = findCountry(areaLocation)
  const flag = Math.round(size * 0.28)
  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={profileImageSource(imageUri)}
        style={[
          { width: size, height: size, borderRadius: size / 2 },
          ring ? styles.ring : null,
        ]}
        resizeMode="cover"
      />
      {country ? (
        <View
          style={[
            styles.flagWrap,
            { width: flag, height: flag, borderRadius: flag / 2, right: size * 0.02, bottom: size * 0.02 },
          ]}
          accessibilityLabel={country.name}
        >
          <Image source={country.flag} style={{ width: flag * 1.5, height: flag }} resizeMode="cover" />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: 2,
    borderColor: 'rgba(0, 102, 255, 0.85)',
    boxShadow: '0px 0px 14px 0px #0048FF',
  },
  flagWrap: {
    position: 'absolute',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0B1F57',
    backgroundColor: '#0B1F57',
  },
})
