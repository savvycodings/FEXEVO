import { Platform, StyleSheet } from 'react-native'
import { FIELD_BOX, FIELD_BOX_ACTIVE, FIELD_BORDER_WIDTH, FIELD_PLACEHOLDER_COLOR, FIELD_PLACEHOLDER_SIZE, UI } from './ui/tokens'

export const AUTH_INPUT_FOCUS_BORDER = '#00B8FF'
export const AUTH_PLACEHOLDER_COLOR = FIELD_PLACEHOLDER_COLOR
/** Same width as the resting (transparent) border, so focus/error never shift the layout. */
export const AUTH_INPUT_FOCUS_BORDER_WIDTH = FIELD_BORDER_WIDTH
export const AUTH_INPUT_ERROR_BORDER_WIDTH = FIELD_BORDER_WIDTH
export const AUTH_ICON_COLOR = UI.accent

export function createAuthFormStyles(theme: {
  regularFont: string
  mediumFont: string
  textColor: string
  placeholderTextColor: string
}) {
  return StyleSheet.create({
    input: {
      ...FIELD_BOX,
      paddingVertical: 0,
      fontSize: 15,
      fontFamily: theme.regularFont,
      color: theme.textColor,
    },
    inputFocused: FIELD_BOX_ACTIVE,
    /** Applied to the TextInput while it is empty, so the placeholder renders Inter 500 11px. */
    placeholderText: {
      fontSize: FIELD_PLACEHOLDER_SIZE,
      fontFamily: theme.mediumFont,
    },
    inputError: {
      borderColor: '#FF5A6A',
      backgroundColor: 'rgba(70, 12, 20, 0.35)',
      marginBottom: 6,
    },
    passwordWrap: {
      marginBottom: 10,
    },
    passwordField: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 0,
      paddingVertical: 0,
      paddingHorizontal: 0,
    },
    passwordInput: {
      flex: 1,
      borderWidth: 0,
      backgroundColor: 'transparent',
      marginBottom: 0,
      paddingVertical: 0,
      paddingLeft: 15,
      paddingRight: 8,
      alignSelf: 'stretch',
      fontSize: 15,
      fontFamily: theme.regularFont,
      color: theme.textColor,
    },
    iconField: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 0,
      paddingLeft: 15,
      paddingRight: 0,
    },
    leftIcon: {
      marginRight: 10,
    },
    iconInput: {
      flex: 1,
      minWidth: 0,
      borderWidth: 0,
      backgroundColor: 'transparent',
      paddingVertical: 0,
      paddingRight: 15,
      alignSelf: 'stretch',
      fontSize: 15,
      fontFamily: theme.regularFont,
      color: theme.textColor,
    },
    passwordToggle: {
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'stretch',
      paddingRight: 12,
      paddingLeft: 4,
      minWidth: 40,
    },
    /** Floating-label field: small label above the value, both inside the box. */
    floatField: {
      justifyContent: 'center',
      paddingVertical: 0,
    },
    floatColumn: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
      paddingLeft: 15,
    },
    floatLabel: {
      fontSize: 12,
      fontFamily: theme.regularFont,
      color: UI.textMuted,
      marginBottom: 2,
    },
    floatInput: {
      borderWidth: 0,
      backgroundColor: 'transparent',
      margin: 0,
      padding: 0,
      minHeight: 22,
      /** No browser focus ring inside the box on web; the box border shows focus. */
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
      fontSize: 16,
      fontFamily: theme.regularFont,
      color: theme.textColor,
    },
    errorText: {
      color: UI.error,
      fontSize: 12,
      fontFamily: theme.mediumFont,
      marginBottom: 10,
      marginTop: -2,
      paddingHorizontal: 4,
    },
  })
}
