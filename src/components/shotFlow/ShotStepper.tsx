import React, { type ReactNode } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { PG, glow } from '../../screens/progress/progressTheme'

export type StepperStep<K extends string> = { key: K; label: string }

type Props<K extends string> = {
  steps: StepperStep<K>[]
  current: K
  /** Steps that can be tapped (completed or current); the rest are locked. */
  enabled: (key: K) => boolean
  onPress: (key: K) => void
  fontFamily?: string
  /** Clip thumbnail shown on the right. */
  thumbnail?: ReactNode
  /** Chevron on the left of the steps (design); omitted when the screen has its own back control. */
  onBack?: () => void
  backTestID?: string
  backAccessibilityLabel?: string
}

const CIRCLE = 32
const LINE_ON = '#2A88F4'
const LINE_OFF = '#0B2A6B'

/** Numbered 1–2–3 stepper joined by a line; the current step glows. */
export function ShotStepper<K extends string>({
  steps,
  current,
  enabled,
  onPress,
  fontFamily,
  thumbnail,
  onBack,
  backTestID,
  backAccessibilityLabel,
}: Props<K>) {
  const currentIdx = steps.findIndex((s) => s.key === current)
  return (
    <View style={styles.row}>
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          testID={backTestID}
          accessibilityRole="button"
          accessibilityLabel={backAccessibilityLabel}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={30} color={PG.labelBlue} />
        </TouchableOpacity>
      ) : null}
      <View style={styles.track}>
        {/* Line runs behind the circles, from the first circle's center to the last one's. */}
        <View style={styles.lineRow} pointerEvents="none">
          {steps.slice(1).map((s, i) => (
            <View key={s.key} style={[styles.line, { backgroundColor: i < currentIdx ? LINE_ON : LINE_OFF }]} />
          ))}
        </View>
        {steps.map((s, i) => {
          const active = i === currentIdx
          const done = i < currentIdx
          return (
            <TouchableOpacity
              key={s.key}
              style={styles.step}
              disabled={!enabled(s.key) || active}
              onPress={() => onPress(s.key)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active, disabled: !enabled(s.key) }}
              testID={`shot-step-${s.key}`}
            >
              <View
                style={[
                  styles.circle,
                  done && styles.circleDone,
                  active && styles.circleActive,
                  active && glow(12, 0.8),
                ]}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.num, (active || done) && styles.numOn, { fontFamily }]}
                >
                  {i + 1}
                </Text>
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.label, active && styles.labelActive, { fontFamily }]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
      {thumbnail ? <View style={styles.thumb}>{thumbnail}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  /** Lines the chevron up with the circles, not the circles + labels block. */
  back: { marginLeft: -6, marginBottom: 20 },
  track: { flex: 1, minWidth: 0, flexDirection: 'row', justifyContent: 'space-between' },
  lineRow: {
    position: 'absolute',
    top: CIRCLE / 2 - 1.5,
    left: CIRCLE / 2 + 12,
    right: CIRCLE / 2 + 12,
    flexDirection: 'row',
  },
  line: { flex: 1, height: 3, borderRadius: 2 },
  step: { alignItems: 'center', gap: 4, width: CIRCLE + 28 },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: '#0B1F5C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: { backgroundColor: '#0B2A6B' },
  circleActive: { backgroundColor: '#0B2A6B', borderWidth: 3, borderColor: PG.labelBlue },
  num: { fontSize: 15, color: '#2A5BBF' },
  numOn: { color: PG.labelBlue },
  label: { fontSize: 12, color: '#2A5BBF' },
  labelActive: { color: '#FFFFFF' },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4DA6FF',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
})
