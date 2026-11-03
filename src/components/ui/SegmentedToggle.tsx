import React, { useContext } from 'react'
import { ThemeContext } from '../../context'
import { SegmentedPills } from '../../screens/progress/SegmentedPills'

export type SegmentOption<T extends string> = {
  value: T
  label: string
  testID?: string
  /** Small count bubble after the label; hidden when 0 or unset. */
  badge?: number
}

/**
 * Single-choice pill track. Renders the shared `SegmentedPills` so form toggles and
 * view tabs look the same everywhere (light-blue active pill on a dark track).
 */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: SegmentOption<T>[]
  value: T | null | undefined
  onChange: (value: T) => void
  accessibilityLabel?: string
}) {
  const { theme } = useContext(ThemeContext)
  return (
    <SegmentedPills<T>
      role="radio"
      size="lg"
      accessibilityLabel={accessibilityLabel}
      options={options.map((opt) => ({
        key: opt.value,
        label: opt.label,
        testID: opt.testID,
        badge: opt.badge ? (opt.badge > 99 ? '99+' : opt.badge) : undefined,
      }))}
      value={value as T}
      onChange={onChange}
      fontFamily={theme.mediumFont}
      activeFontFamily={theme.semiBoldFont}
    />
  )
}
