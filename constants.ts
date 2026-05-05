import { Platform } from 'react-native'
import { AnthropicIcon } from './src/components/AnthropicIcon'
import { GeminiIcon } from './src/components/GeminiIcon'
import { OpenAIIcon } from './src/components/OpenAIIcon'

const normalizeDomain = (value?: string) => {
  if (!value) return ''
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value
  }
  return `http://${value}`
}

/**
 * Android emulator: `localhost` is the emulator itself, not the dev machine.
 * `10.0.2.2` is the special alias to the host loopback (where Metro / your API run).
 * Web and iOS simulator keep `localhost` as-is.
 */
const rewriteLocalhostForAndroidEmulator = (url: string) => {
  if (!__DEV__ || Platform.OS !== 'android' || !url) return url
  return url
    .replace(/^http:\/\/localhost(?=[:/]|$)/i, 'http://10.0.2.2')
    .replace(/^http:\/\/127\.0\.0\.1(?=[:/]|$)/i, 'http://10.0.2.2')
}

const backendUrl = rewriteLocalhostForAndroidEmulator(
  process.env.EXPO_PUBLIC_BACKEND_URL ||
    process.env.EXPO_PUBLIC_PROD_API_URL ||
    process.env.EXPO_PUBLIC_DEV_API_URL ||
    ''
)

export const DOMAIN = normalizeDomain(backendUrl || '')

/** Small extra inset below the status bar inside the header row (keep small — safe area already in `insets.top`). */
export const PAGE_TOP_EXTRA_PADDING = 4

/**
 * Extra space between the bottom of the header icon row and the tab/scene content below.
 * Keep modest: large values made the production header feel overly tall.
 */
export const HEADER_BELOW_CONTENT_GAP = 8

/**
 * Pixels from the top safe-area inset to the bottom edge of the main `Header` bar
 * (see `Header.tsx`: `paddingTop` extras + 44px row + `paddingBottom`).
 * Use with `KeyboardAvoidingView` `keyboardVerticalOffset` in the tab shell where `Header` is above the scene.
 */
export const MAIN_HEADER_CHROME_HEIGHT =
  PAGE_TOP_EXTRA_PADDING + 44 + 8 + HEADER_BELOW_CONTENT_GAP

export function mainHeaderKeyboardOffset(safeAreaTop: number) {
  return safeAreaTop + MAIN_HEADER_CHROME_HEIGHT
}

export const MODELS = {
  claudeOpus: {
    name: 'Claude Opus',
    label: 'claudeOpus',
    icon: AnthropicIcon
  },
  claudeSonnet: {
    name: 'Claude Sonnet',
    label: 'claudeSonnet',
    icon: AnthropicIcon
  },
  claudeHaiku: {
    name: 'Claude Haiku',
    label: 'claudeHaiku',
    icon: AnthropicIcon
  },
  claudeSonnet4: {
    name: 'Claude Sonnet 4',
    label: 'claudeSonnet4',
    icon: AnthropicIcon
  },
  gpt52: { name: 'GPT 5.2', label: 'gpt52', icon: OpenAIIcon },
  gpt5Mini: { name: 'GPT 5 Mini', label: 'gpt5Mini', icon: OpenAIIcon },
  gemini: { name: 'Gemini', label: 'gemini', icon: GeminiIcon },
}

export const IMAGE_MODELS = {
  nanoBanana: { name: 'Nano Banana (Gemini Flash Image)', label: 'nanoBanana' },
  nanoBananaPro: { name: 'Nano Banana Pro (Gemini 3 Pro)', label: 'nanoBananaPro' },
  fluxLora: { name: 'FLUX LoRA (fal.ai)', label: 'fluxLora' },
}
