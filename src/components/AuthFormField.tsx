import React, { useMemo, useState } from 'react'
import { TextInput, View, type TextInputProps, type StyleProp, type TextStyle } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { createAuthFormStyles, AUTH_ICON_COLOR } from './authFormStyles'

type AuthFormFieldProps = TextInputProps & {
  theme: {
    regularFont: string
    mediumFont: string
    textColor: string
    placeholderTextColor: string
  }
  hasError?: boolean
  fieldStyle?: StyleProp<TextStyle>
  /** Ionicons name shown before the text. */
  leftIcon?: React.ComponentProps<typeof Ionicons>['name']
}

export function AuthFormField({
  theme,
  hasError = false,
  fieldStyle,
  style,
  onFocus,
  onBlur,
  placeholderTextColor,
  leftIcon,
  ...rest
}: AuthFormFieldProps) {
  const [focused, setFocused] = useState(false)
  const styles = useMemo(() => createAuthFormStyles(theme), [theme])
  const stateStyles = [focused && !hasError && styles.inputFocused, hasError && styles.inputError]

  const input = (
    <TextInput
      style={leftIcon ? [styles.iconInput, style] : [styles.input, ...stateStyles, fieldStyle, style]}
      placeholderTextColor={placeholderTextColor ?? theme.placeholderTextColor}
      onFocus={(e) => {
        setFocused(true)
        onFocus?.(e)
      }}
      onBlur={(e) => {
        setFocused(false)
        onBlur?.(e)
      }}
      {...rest}
    />
  )

  if (!leftIcon) return input
  return (
    <View style={[styles.input, styles.iconField, ...stateStyles, fieldStyle]}>
      <Ionicons name={leftIcon} size={20} color={AUTH_ICON_COLOR} style={styles.leftIcon} />
      {input}
    </View>
  )
}
