import React from 'react'
import { Text, StyleSheet, TouchableOpacity, View, type ImageSourcePropType, Image } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { glow } from '../../screens/progress/progressTheme'

type Props = {
  label?: string
  /** Camera tiles show an image instead of a label. */
  image?: ImageSourcePropType
  selected: boolean
  width: number
  height: number
  onPress: () => void
  fontFamily?: string
  testID?: string
  accessibilityLabel?: string
}

/** Tall rounded choice tile; the selected one gets a bright border and glow. */
export function ShotTile({
  label,
  image,
  selected,
  width,
  height,
  onPress,
  fontFamily,
  testID,
  accessibilityLabel,
}: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      aria-selected={selected}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[{ width, height }, selected && glow(16, 0.7), styles.radius]}
    >
      <LinearGradient
        colors={selected ? ['#0B2378', '#06124A'] : ['#06102E', '#020814']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.tile, selected ? styles.tileOn : styles.tileOff]}
      >
        {image ? (
          <Image source={image} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={styles.labelWrap}>
            <Text allowFontScaling={false} numberOfLines={2} style={[styles.label, { fontFamily }]}>
              {label}
            </Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  radius: { borderRadius: 24 },
  tile: { flex: 1, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  tileOff: { borderWidth: 1.5, borderColor: '#0B2160' },
  tileOn: { borderWidth: 2.5, borderColor: '#3D8BFF' },
  labelWrap: { paddingHorizontal: 12 },
  label: { fontSize: 17, lineHeight: 22, color: '#FFFFFF', textAlign: 'center' },
  image: { width: '100%', height: '100%' },
})
