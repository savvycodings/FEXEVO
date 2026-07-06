import React, { useMemo, useState } from 'react'
import { TextInput, type TextInputProps, type StyleProp, type TextStyle } from 'react-native'
import { createAuthFormStyles } from './authFormStyles'

type AuthFormFieldProps = TextInputProps & {
  theme: {
    regularFont: string
    mediumFont: string
    textColor: string
    placeholderTextColor: string
  }
  hasError?: boolean
  fieldStyle?: StyleProp<TextStyle>
}

export function AuthFormField({
  theme,
  hasError = false,
  fieldStyle,
  style,
  onFocus,
  onBlur,
  placeholderTextColor,
  ...rest
}: AuthFormFieldProps) {
  const [focused, setFocused] = useState(false)
  const styles = useMemo(() => createAuthFormStyles(theme), [theme])

  return (
    <TextInput
      style={[
        styles.input,
        focused && !hasError && styles.inputFocused,
        hasError && styles.inputError,
        fieldStyle,
        style,
      ]}
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
}
