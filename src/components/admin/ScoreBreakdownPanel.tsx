import React, { useContext, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext } from '../../context'
import type { ScoreExplanation } from '../../lib/adminRetrievalBenchApi'
import { TEST_IDS } from '../../lib/testIds'

type Props = { explanation: ScoreExplanation | null | undefined }

const PILLARS = ['technique', 'outcome', 'tactics'] as const

/** What each boost factor means, in the order they weigh into merit (scoreCalibration.ts). */
const FACTORS: Array<{ key: string; label: string; weight: string; invert?: boolean }> = [
  { key: 'rawOverallNorm', label: 'Pillar average', weight: '40%' },
  { key: 'errorLoad', label: 'Errors found (fewer is better)', weight: '25%', invert: true },
  { key: 'confidenceNorm', label: 'Confidence', weight: '20%' },
  { key: 'strengthLoad', label: 'Strengths found', weight: '10%' },
  { key: 'pillarSpreadNorm', label: 'Pillar spread', weight: '5%' },
]

const pct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v * 100)}%`)
const n = (v: number | null | undefined) => (v == null ? '—' : String(Math.round(v)))

/**
 * Step-by-step trace of how an analysis' displayed technique score was built: analyzer inputs,
 * the model's pillars, the display boost and the final average. Each step expands.
 */
export function ScoreBreakdownPanel({ explanation: e }: Props) {
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])
  const [open, setOpen] = useState<Record<number, boolean>>({})
  if (!e) return null
  const toggle = (i: number) => setOpen((o) => ({ ...o, [i]: !o[i] }))

  const pillarLine = (p: ScoreExplanation['pillarsRaw']) =>
    p ? PILLARS.map((k) => p[k]).join(' / ') : '—'

  const steps: Array<{ title: string; value: string; body: React.ReactNode }> = [
    {
      title: 'Analyzer measures the clip',
      value: `${e.inputs.poseFrames} frames`,
      body: (
        <>
          <Row label="Pose frames (MediaPipe)" value={String(e.inputs.poseFrames)} styles={styles} />
          <Row label="Impact frame (YOLO)" value={n(e.inputs.impactFrame)} styles={styles} />
          <Row label="Shot" value={e.inputs.shot ?? '—'} styles={styles} />
          <Row
            label="Closest pro clip"
            value={
              e.inputs.topNeighbor
                ? `${e.inputs.topNeighbor.stroke}${e.inputs.topNeighbor.distance != null ? ` · d=${e.inputs.topNeighbor.distance.toFixed(3)}` : ''}`
                : 'none'
            }
            styles={styles}
          />
          <Row label="Embedding" value={e.inputs.embeddingSource ?? '—'} styles={styles} />
          <Row label="Padel detected" value={e.inputs.isPadel == null ? '—' : e.inputs.isPadel ? 'yes' : 'no'} styles={styles} />
          <Text style={styles.note}>These numbers go into the prompt for the AI model.</Text>
        </>
      ),
    },
    {
      title: 'AI model scores three pillars',
      value: e.pillarAverage != null ? `avg ${e.pillarAverage}` : '—',
      body: (
        <>
          {PILLARS.map((k) => (
            <Row key={k} label={k[0]!.toUpperCase() + k.slice(1)} value={n(e.pillarsRaw?.[k])} styles={styles} />
          ))}
          <Row label="Average of the three" value={n(e.pillarAverage)} styles={styles} strong />
          <Row label="Model's own overall" value={n(e.modelRaw)} styles={styles} />
          <Text style={styles.note}>Each pillar is 0–100, as the model returned it before any boost.</Text>
        </>
      ),
    },
    {
      title: 'Display boost',
      value: e.boost ? `+${e.boost.points}` : '—',
      body: e.boost ? (
        <>
          <Row label="Merit (0–1)" value={e.boost.merit != null ? e.boost.merit.toFixed(2) : '—'} styles={styles} />
          <Row label="Boost = 1 + merit × 11" value={`${e.boost.points} points`} styles={styles} strong />
          <Text style={[styles.subhead, { marginTop: 8 }]}>Merit comes from</Text>
          {FACTORS.map((f) => {
            const v = e.boost?.factors?.[f.key]
            return (
              <Row
                key={f.key}
                label={`${f.label} · weight ${f.weight}`}
                value={v == null ? '—' : f.invert ? `${pct(v)} → ${pct(1 - v)}` : pct(v)}
                styles={styles}
              />
            )
          })}
          {e.boost.perPillar ? (
            <Row
              label="Added per pillar"
              value={PILLARS.map((k) => `+${e.boost!.perPillar![k]}`).join(' / ')}
              styles={styles}
            />
          ) : null}
          <Text style={styles.note}>Higher pillars get slightly more of the boost: points × (0.88 + 0.12 × pillar/100).</Text>
        </>
      ) : (
        <Text style={styles.note}>No boost recorded for this analysis.</Text>
      ),
    },
    {
      title: 'Final score',
      value: String(e.final),
      body: (
        <>
          <Row label="Pillars before (tech / outcome / tactics)" value={pillarLine(e.pillarsRaw)} styles={styles} />
          <Row label="Pillars after boost" value={pillarLine(e.pillarsFinal)} styles={styles} />
          <Row label="Final = average after boost" value={`${e.final}${e.rating ? ` (${e.rating})` : ''}`} styles={styles} strong />
          <Row label="Old penalty formula (audit only)" value={n(e.legacyPenaltyScore)} styles={styles} />
          {e.scoringVersion ? <Text style={styles.note}>Scoring {e.scoringVersion}</Text> : null}
        </>
      ),
    },
    {
      title: 'Confidence',
      value: e.confidence?.band ?? '—',
      body: e.confidence ? (
        <>
          <Row label="Confidence" value={`${n(e.confidence.score)}${e.confidence.plusMinus != null ? ` ±${e.confidence.plusMinus}` : ''}`} styles={styles} strong />
          <Row label="Pose" value={n(e.confidence.pose)} styles={styles} />
          <Row label="Tracking" value={n(e.confidence.tracking)} styles={styles} />
          <Row label="Visibility" value={n(e.confidence.visibility)} styles={styles} />
        </>
      ) : (
        <Text style={styles.note}>No confidence recorded.</Text>
      ),
    },
    {
      title: 'What the model wrote',
      value: `${e.feedback.strengths.length} strengths · ${e.feedback.errors.length} errors`,
      body: (
        <>
          {e.feedback.diagnosis ? <Text style={styles.bullet}>{e.feedback.diagnosis}</Text> : null}
          <Bullets title="Strengths (raise merit)" items={e.feedback.strengths} styles={styles} />
          <Bullets title="Errors (lower merit)" items={e.feedback.errors} styles={styles} />
          <Bullets title="Corrections (lower merit)" items={e.feedback.corrections} styles={styles} />
        </>
      ),
    },
  ]

  return (
    <View style={styles.wrap} testID={TEST_IDS.scoreBreakdown}>
      <Text style={styles.title}>How this score was built</Text>
      <Text style={styles.formula}>
        {`${n(e.pillarAverage)} pillar average  +  ${e.boost ? e.boost.points : 0} boost  →  ${e.final}`}
      </Text>
      {steps.map((s, i) => (
        <View key={s.title} style={styles.step}>
          <TouchableOpacity
            style={styles.stepHead}
            onPress={() => toggle(i)}
            activeOpacity={0.8}
            testID={TEST_IDS.scoreBreakdownStep(i + 1)}
          >
            <Text style={styles.stepNum}>{i + 1}</Text>
            <Text style={styles.stepTitle}>{s.title}</Text>
            <Text style={styles.stepValue}>{s.value}</Text>
            <Ionicons name={open[i] ? 'chevron-up' : 'chevron-down'} size={16} color="#86A7D2" />
          </TouchableOpacity>
          {open[i] ? <View style={styles.stepBody}>{s.body}</View> : null}
        </View>
      ))}
    </View>
  )
}

type Styles = ReturnType<typeof getStyles>

function Row({ label, value, styles, strong }: { label: string; value: string; styles: Styles; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowStrong]}>{value}</Text>
    </View>
  )
}

function Bullets({ title, items, styles }: { title: string; items: string[]; styles: Styles }) {
  if (!items.length) return null
  return (
    <>
      <Text style={[styles.subhead, { marginTop: 8 }]}>{title}</Text>
      {items.map((t, i) => (
        <Text key={i} style={styles.bullet}>• {t}</Text>
      ))}
    </>
  )
}

function getStyles(theme: { semiBoldFont?: string; regularFont?: string; mediumFont?: string }) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      marginTop: 18,
      marginBottom: 8,
      padding: 14,
      borderRadius: 14,
      backgroundColor: 'rgba(13,27,48,0.85)',
      borderWidth: 1,
      borderColor: 'rgba(0,187,255,0.18)',
    },
    title: { color: '#E8F2FF', fontSize: 15, fontFamily: theme.semiBoldFont },
    formula: { color: '#00BBFF', fontSize: 13, fontFamily: theme.mediumFont, marginTop: 4, marginBottom: 10 },
    step: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
    stepHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 10 },
    stepNum: {
      width: 22,
      height: 22,
      borderRadius: 11,
      textAlign: 'center',
      lineHeight: 22,
      overflow: 'hidden',
      backgroundColor: 'rgba(0,187,255,0.15)',
      color: '#00BBFF',
      fontSize: 12,
      fontFamily: theme.semiBoldFont,
    },
    stepTitle: { flex: 1, color: '#E8F2FF', fontSize: 14, fontFamily: theme.mediumFont },
    stepValue: { color: '#86A7D2', fontSize: 13, fontFamily: theme.mediumFont },
    stepBody: { paddingLeft: 32, paddingBottom: 12 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, gap: 12 },
    rowLabel: { flex: 1, color: 'rgba(255,255,255,0.65)', fontSize: 13, fontFamily: theme.regularFont },
    rowValue: { color: '#E8F2FF', fontSize: 13, fontFamily: theme.mediumFont, textAlign: 'right', flexShrink: 1 },
    rowStrong: { color: '#00BBFF', fontFamily: theme.semiBoldFont },
    subhead: { color: '#86A7D2', fontSize: 12, fontFamily: theme.semiBoldFont, textTransform: 'uppercase', letterSpacing: 0.4 },
    bullet: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontFamily: theme.regularFont, lineHeight: 19, marginTop: 4 },
    note: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontFamily: theme.regularFont, marginTop: 6 },
  })
}
