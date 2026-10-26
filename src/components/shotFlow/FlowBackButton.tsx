import React from 'react'
import { Text, StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { PG } from '../../screens/progress/progressTheme'

type Props = {
  onPress: () => void
  fontFamily?: string
  testID?: string
  style?: StyleProp<ViewStyle>
}

/** Outlined "< Back" pill used across the AI Coach upload flow. */
export function FlowBackButton({ onPress, fontFamily, testID, style }: Props) {
  const { t } = useTranslation()
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.btn, style]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={t('technique.shotPicker.back')}
      testID={testID}
    >
      <Ionicons name="chevron-back" size={20} color={PG.labelBlue} />
      <Text allowFontScaling={false} style={[styles.txt, { fontFamily }]}>
        {t('technique.shotPicker.back')}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderWidth: 1.5,
    borderColor: '#2F7BFF',
    borderRadius: 12,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 16,
    backgroundColor: 'rgba(4, 22, 65, 0.6)',
  },
  txt: { fontSize: 16, color: PG.labelBlue },
})
