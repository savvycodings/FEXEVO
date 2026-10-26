import React, { useCallback, useMemo, useState } from 'react'
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native'
import { useTranslation } from 'react-i18next'
import { PG, glow } from './progressTheme'

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

type Props = {
  sessionsThisWeek: number
  /** Mon=0 … Sun=6 */
  weekHits: boolean[]
  theme: any
}

export function TrainingConsistencyCard({ sessionsThisWeek, weekHits, theme }: Props) {
  const { t } = useTranslation()
  const [rowW, setRowW] = useState(0)
  const onLayout = useCallback((e: LayoutChangeEvent) => setRowW(e.nativeEvent.layout.width), [])

  /** 36pt circles; shrink only when the row is too narrow for seven of them. */
  const dot = useMemo(() => {
    if (rowW <= 0) return 36
    return Math.min(36, Math.max(22, Math.floor(rowW / 7 - 4)))
  }, [rowW])

  return (
    <View style={[styles.card, glow(10, 0.25)]}>
      <Text allowFontScaling={false} style={[styles.heading, { fontFamily: theme.semiBoldFont }]}>
        {t('progress.trainingConsistency')}
      </Text>
      <View style={styles.main}>
        <View style={styles.left}>
          <Text allowFontScaling={false} style={[styles.big, { fontFamily: theme.semiBoldFont }]}>
            {sessionsThisWeek}
          </Text>
          <Text allowFontScaling={false} style={[styles.sessions, { fontFamily: theme.semiBoldFont }]}>
            {t('progress.sessions')}
          </Text>
          <Text allowFontScaling={false} style={[styles.sub, { fontFamily: theme.regularFont }]}>
            {t('progress.thisWeek')}
          </Text>
        </View>
        <View style={styles.days} onLayout={onLayout}>
          {DAY_LABELS.map((d, i) => {
            const on = !!weekHits[i]
            return (
              <View
                key={`day-${i}`}
                style={[
                  styles.dot,
                  { width: dot, height: dot, borderRadius: dot / 2 },
                  on ? [styles.dotOn, glow(8, 0.6)] : styles.dotOff,
                ]}
              >
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.dayTxt,
                    { fontFamily: theme.mediumFont, fontSize: Math.round(dot * 0.42) },
                    on ? styles.dayTxtOn : styles.dayTxtOff,
                  ]}
                >
                  {d}
                </Text>
              </View>
            )
          })}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: PG.cardPlain,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PG.borderSoft,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    marginBottom: 16,
  },
  heading: { fontSize: 20, color: '#FFFFFF' },
  main: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 6 },
  left: { flexShrink: 0 },
  big: { fontSize: 52, color: PG.labelBlue, lineHeight: 58 },
  sessions: { fontSize: 17, color: PG.labelBlue },
  sub: { fontSize: 16, color: '#FFFFFF', marginTop: 4 },
  days: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 24,
  },
  dot: { alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: PG.dayOn },
  dotOff: { backgroundColor: PG.dayOff },
  dayTxt: { textAlign: 'center' },
  dayTxtOn: { color: PG.dayOnText },
  dayTxtOff: { color: PG.dayOffText },
})
