import type { TextStyle } from 'react-native'

const TITLE_MEDIUM_FONT_SIZE = 22

/**
 * Title Medium — design: Inter Medium (500), 22px, line-height 100%, letter-spacing 0.
 * Pass `theme.mediumFont` (`Inter_500Medium`). Do not set `fontWeight`; the loaded face carries the weight.
 */
export function titleMedium(fontFamily: string): TextStyle {
  return {
    fontFamily,
    fontSize: TITLE_MEDIUM_FONT_SIZE,
    lineHeight: TITLE_MEDIUM_FONT_SIZE,
    letterSpacing: 0,
  }
}
