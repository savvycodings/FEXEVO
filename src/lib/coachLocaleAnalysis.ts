/**
 * Pick localized coach narrative from `ai_analysis.en` / `ai_analysis.es`.
 * Unsloth returns both; the UI must select by app language.
 */

export type CoachAnalysisLocaleBlock = Record<string, unknown>

function asLocaleBlock(raw: unknown): CoachAnalysisLocaleBlock | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw as CoachAnalysisLocaleBlock
}

function localeBlockHasUsableText(block: CoachAnalysisLocaleBlock | null): boolean {
  if (!block) return false
  const diagnosis = typeof block.diagnosis === 'string' ? block.diagnosis.trim() : ''
  if (diagnosis.length > 0) return true
  for (const key of ['strengths', 'technical_errors', 'actionable_corrections', 'observations', 'recommendations'] as const) {
    const arr = block[key]
    if (Array.isArray(arr) && arr.some((s) => typeof s === 'string' && s.trim().length > 0)) {
      return true
    }
  }
  return false
}

/** True when i18n language is Spanish (es, es-ES, es-MX, …). */
export function isSpanishAppLanguage(language: string | null | undefined): boolean {
  const lng = String(language || '').trim().toLowerCase()
  return lng === 'es' || lng.startsWith('es-')
}

const LEGACY_PLACEHOLDER_RE =
  /legacy\s*(fallback)?|recomendaci[oó]n\s*legacy|observaci[oó]n\s*legacy/i

const BARE_NUMBERED_STUB_RE =
  /^(recommendation|observation|recomendaci[oó]n|observaci[oó]n)\s*\d+$/i

/** True for Unsloth-copied analyze-prompt stubs like "Legacy fallback recommendation 1". */
export function isLegacyCoachPlaceholderLine(value: string): boolean {
  const t = value.trim()
  if (!t) return true
  if (LEGACY_PLACEHOLDER_RE.test(t)) return true
  if (BARE_NUMBERED_STUB_RE.test(t)) return true
  return false
}

/** Drop legacy placeholder lines from coach bullet arrays (Recommendations safety net). */
export function filterLegacyCoachPlaceholderLines(lines: unknown): string[] {
  if (!Array.isArray(lines)) return []
  return lines.filter(
    (item): item is string =>
      typeof item === 'string' && !isLegacyCoachPlaceholderLine(item)
  )
}

/**
 * Prefer `es` when the app is Spanish and that block has content; otherwise `en`.
 * Non-Spanish app language never falls back to `es`.
 * Falls back to top-level analysis fields if nested locale blocks are missing (legacy).
 */
export function pickCoachAnalysisLocale(
  aiAnalysis: Record<string, unknown> | null | undefined,
  language: string | null | undefined
): CoachAnalysisLocaleBlock | null {
  if (!aiAnalysis || typeof aiAnalysis !== 'object') return null

  const en = asLocaleBlock(aiAnalysis.en)
  const es = asLocaleBlock(aiAnalysis.es)
  const preferEs = isSpanishAppLanguage(language)

  if (preferEs && localeBlockHasUsableText(es)) return es
  if (localeBlockHasUsableText(en)) return en

  // Legacy: narrative fields at top level of ai_analysis
  if (localeBlockHasUsableText(aiAnalysis as CoachAnalysisLocaleBlock)) {
    return aiAnalysis as CoachAnalysisLocaleBlock
  }
  // English (or other non-Spanish): never return the Spanish block.
  if (!preferEs) return en ?? null
  return en ?? es ?? null
}
