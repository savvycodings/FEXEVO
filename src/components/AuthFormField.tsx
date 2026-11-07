import React, { useMemo, useRef, useState } from 'react'
import { Pressable, Text, TextInput, View, type TextInputProps, type StyleProp, type TextStyle } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { createAuthFormStyles, AUTH_ICON_COLOR, AUTH_PLACEHOLDER_COLOR } from './authFormStyles'

type AuthFormFieldProps = TextInputProps & {
  theme: {
    regularFont: string
    mediumFont: string
    textColor: string
    placeholderTextColor: string
  }
  hasError?: boolean
  fieldStyle?: StyleProp<TextStyle>
  /** Ionicons name, or a custom icon element, shown before the text. */
  leftIcon?: React.ComponentProps<typeof Ionicons>['name'] | React.ReactElement
  /** Floating label shown inside the box above the value (login design). */
  label?: string
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
  label,
  ...rest
}: AuthFormFieldProps) {
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<TextInput>(null)
  const styles = useMemo(() => createAuthFormStyles(theme), [theme])
  const stateStyles = [focused && !hasError && styles.inputFocused, hasError && styles.inputError]
  const empty = !rest.value

  const input = (
    <TextInput
      ref={inputRef}
      style={[
        ...(label ? [styles.floatInput] : leftIcon ? [styles.iconInput] : [styles.input, ...stateStyles, fieldStyle]),
        style,
        empty && styles.placeholderText,
      ]}
      placeholderTextColor={placeholderTextColor ?? AUTH_PLACEHOLDER_COLOR}
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

  if (label) {
    return (
      <Pressable
        onPress={() => inputRef.current?.focus()}
        style={[styles.input, styles.floatField, ...stateStyles, fieldStyle]}
      >
        <Text allowFontScaling={false} style={styles.floatLabel}>
          {label}
        </Text>
        {input}
      </Pressable>
    )
  }
  if (!leftIcon) return input
  return (
    <View style={[styles.input, styles.iconField, ...stateStyles, fieldStyle]}>
      {typeof leftIcon === 'string' ? (
        <Ionicons name={leftIcon} size={24} color={AUTH_ICON_COLOR} style={styles.leftIcon} />
      ) : (
        <View style={styles.leftIcon}>{leftIcon}</View>
      )}
      {input}
    </View>
  )
}
