import React, { useMemo, useState } from 'react'
import { View, TextInput, TouchableOpacity, type TextInputProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LocalSvgAsset } from './LocalSvgAsset'
import { createAuthFormStyles, AUTH_ICON_COLOR } from './authFormStyles'

const SHOW_PASSWORD_ICON = require('../../assets/sighnin/showpassword.svg')
const HIDE_PASSWORD_ICON = require('../../assets/sighnin/hidepassword.svg')

type AuthPasswordFieldProps = Omit<TextInputProps, 'secureTextEntry'> & {
  theme: {
    regularFont: string
    mediumFont: string
    textColor: string
    placeholderTextColor: string
  }
  hasError?: boolean
  fieldStyle?: StyleProp<TextStyle>
  wrapStyle?: StyleProp<ViewStyle>
  /** Ionicons name shown before the text. */
  leftIcon?: React.ComponentProps<typeof Ionicons>['name']
  /** Visibility toggle art: the scan-frame SVG (default) or an eye icon. */
  toggleIcon?: 'scan' | 'eye'
}

export function AuthPasswordField({
  theme,
  hasError = false,
  fieldStyle,
  wrapStyle,
  style,
  onFocus,
  onBlur,
  placeholderTextColor,
  editable = true,
  leftIcon,
  toggleIcon = 'scan',
  ...rest
}: AuthPasswordFieldProps) {
  const [focused, setFocused] = useState(false)
  const [visible, setVisible] = useState(false)
  const styles = useMemo(() => createAuthFormStyles(theme), [theme])

  return (
    <View style={[styles.passwordWrap, wrapStyle]}>
      <View
        style={[
          styles.input,
          styles.passwordField,
          focused && !hasError && styles.inputFocused,
          hasError && styles.inputError,
          leftIcon && styles.iconField,
        ]}
      >
        {leftIcon ? (
          <Ionicons name={leftIcon} size={20} color={AUTH_ICON_COLOR} style={styles.leftIcon} />
        ) : null}
        <TextInput
          style={[
            styles.passwordInput,
            leftIcon && { paddingLeft: 0 },
            fieldStyle,
            style,
          ]}
          placeholderTextColor={placeholderTextColor ?? theme.placeholderTextColor}
          secureTextEntry={!visible}
          editable={editable}
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
        <TouchableOpacity
          style={styles.passwordToggle}
          onPress={() => setVisible((v) => !v)}
          disabled={!editable}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {toggleIcon === 'eye' ? (
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={AUTH_ICON_COLOR} />
          ) : (
            <LocalSvgAsset
              assetModule={visible ? SHOW_PASSWORD_ICON : HIDE_PASSWORD_ICON}
              width={24}
              height={24}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}
