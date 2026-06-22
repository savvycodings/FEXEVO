import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { BenchScoreRing } from "./BenchScoreRing";
import type { BenchStepResult } from "../../lib/adminRetrievalBenchApi";

type Props = {
  result: BenchStepResult | null;
  passThreshold: number;
  blendMeshWeight: number | null;
  onBlendWeightChange?: (w: number) => void;
  theme: { semiBoldFont: string; regularFont: string; mediumFont: string };
};

type RingPoint = { label: string; value: number };
type LinePoint = { label: string; value: number; mesh_weight?: number };

function asRingScores(charts: Record<string, unknown> | undefined): RingPoint[] {
  const raw = charts?.ringScores;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const row = x as Record<string, unknown>;
      return {
        label: String(row.label ?? ""),
        value: typeof row.value === "number" ? row.value : 0,
      };
    });
}

function asLineSeries(charts: Record<string, unknown> | undefined): LinePoint[] {
  const raw = charts?.lineSeries;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const row = x as Record<string, unknown>;
      return {
        label: String(row.label ?? ""),
        value: typeof row.value === "number" ? row.value : 0,
        mesh_weight: typeof row.mesh_weight === "number" ? row.mesh_weight : undefined,
      };
    });
}

function MiniLineChart({ points, width = 280, height = 72 }: { points: LinePoint[]; width?: number; height?: number }) {
  if (points.length < 2) return null;
  const pad = 8;
  const maxV = Math.max(1, ...points.map((p) => p.value));
  const step = (width - pad * 2) / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * step;
    const y = height - pad - (p.value / maxV) * (height - pad * 2);
    return { x, y };
  });
  const d = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  return (
    <Svg width={width} height={height}>
      <Line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="rgba(134,167,210,0.35)" />
      <Path d={d} stroke="#0059FF" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      {coords.map((c, i) => (
        <Circle key={i} cx={c.x} cy={c.y} r={3} fill="#0059FF" />
      ))}
    </Svg>
  );
}

function TableBlock({
  title,
  rows,
  fontFamily,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
  fontFamily: string;
}) {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0] ?? {});
  return (
    <View style={styles.tableBlock}>
      <Text style={[styles.tableTitle, { fontFamily }]}>{title}</Text>
      {rows.slice(0, 12).map((row, i) => (
        <View key={i} style={styles.tableRow}>
          {keys.map((k) => (
            <Text key={k} style={[styles.tableCell, { fontFamily }]} numberOfLines={1}>
              {k}: {String(row[k] ?? "—")}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function BenchStepResultPanel({
  result,
  passThreshold,
  blendMeshWeight,
  onBlendWeightChange,
  theme,
}: Props) {
  const [expandedFailure, setExpandedFailure] = useState<number | null>(0);

  const rings = useMemo(() => (result ? asRingScores(result.charts) : []), [result]);
  const line = useMemo(() => (result ? asLineSeries(result.charts) : []), [result]);

  const byWeight = useMemo(() => {
    const t = result?.tables?.by_weight;
    return Array.isArray(t) ? (t as Array<Record<string, unknown>>) : [];
  }, [result]);

  const selectedBlendRow = useMemo(() => {
    if (blendMeshWeight == null || !byWeight.length) return null;
    return (
      byWeight.find((r) => r.mesh_weight === blendMeshWeight) ??
      byWeight.find((r) => Math.abs(Number(r.mesh_weight) - blendMeshWeight) < 0.01) ??
      null
    );
  }, [byWeight, blendMeshWeight]);

  if (!result) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { fontFamily: theme.regularFont }]}>Run a step</Text>
      </View>
    );
  }

  const passed = result.scorePercent >= passThreshold;

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <BenchScoreRing value={result.scorePercent} size={64} fontFamily={theme.semiBoldFont} />
        <View style={styles.headerText}>
          <Text style={[styles.summary, { fontFamily: theme.semiBoldFont }]}>{result.summary}</Text>
          <Text style={[styles.stepMeta, { fontFamily: theme.regularFont }]}>
            {result.title} · {passed ? "pass" : "fail"}
          </Text>
        </View>
      </View>

      {result.stepId === "3_blend" && byWeight.length > 0 && onBlendWeightChange ? (
        <View style={styles.blendRow}>
          {byWeight.map((row) => {
            const w = Number(row.mesh_weight);
            const label = String(row.label ?? w);
            const active = blendMeshWeight != null && Math.abs(blendMeshWeight - w) < 0.01;
            return (
              <TouchableOpacity
                key={label}
                style={[styles.blendChip, active && styles.blendChipActive]}
                onPress={() => onBlendWeightChange(w)}
              >
                <Text style={[styles.blendChipText, { fontFamily: theme.mediumFont }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {selectedBlendRow ? (
        <View style={styles.highlightBox}>
          <Text style={[styles.highlightText, { fontFamily: theme.mediumFont }]}>
            {String(selectedBlendRow.label)} · top1 {String(selectedBlendRow.top1_pct)}% · top3{" "}
            {String(selectedBlendRow.top3_pct)}%
          </Text>
        </View>
      ) : null}

      {result.failures.length > 0 ? (
        <View style={styles.failures}>
          {result.failures.slice(0, 6).map((f, i) => {
            const open = expandedFailure === i;
            return (
              <View key={i} style={styles.failureCard}>
                <TouchableOpacity onPress={() => setExpandedFailure(open ? null : i)}>
                  <Text style={[styles.failureReason, { fontFamily: theme.semiBoldFont }]}>
                    {String(f.reason ?? "fail")} · {String(f.id ?? "").slice(0, 8)}
                  </Text>
                </TouchableOpacity>
                {open && f.used && typeof f.used === "object" ? (
                  <Text style={[styles.failureEvidence, { fontFamily: theme.regularFont }]}>
                    {JSON.stringify(f.used, null, 0).slice(0, 1200)}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {rings.length > 0 ? (
        <View style={styles.ringRow}>
          {rings.map((r) => (
            <BenchScoreRing
              key={r.label}
              value={r.value}
              size={44}
              label={r.label}
              fontFamily={theme.mediumFont}
            />
          ))}
        </View>
      ) : null}

      {line.length > 1 ? (
        <View style={styles.chartWrap}>
          <MiniLineChart points={line} />
        </View>
      ) : null}

      <TableBlock
        title="by_shot"
        rows={
          Array.isArray(result.tables?.by_shot)
            ? (result.tables.by_shot as Array<Record<string, unknown>>)
            : []
        }
        fontFamily={theme.regularFont}
      />
      <TableBlock
        title="neighbors"
        rows={
          Array.isArray(result.tables?.neighbors)
            ? (result.tables.neighbors as Array<Record<string, unknown>>)
            : []
        }
        fontFamily={theme.regularFont}
      />
      <TableBlock
        title="signals"
        rows={
          Array.isArray(result.tables?.signals)
            ? (result.tables.signals as Array<Record<string, unknown>>)
            : []
        }
        fontFamily={theme.regularFont}
      />
      <TableBlock
        title="by_source"
        rows={
          Array.isArray(result.tables?.by_source)
            ? (result.tables.by_source as Array<Record<string, unknown>>)
            : []
        }
        fontFamily={theme.regularFont}
      />
      <TableBlock
        title="by_weight"
        rows={byWeight}
        fontFamily={theme.regularFont}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 24, alignItems: "center" },
  emptyText: { color: "rgba(255,255,255,0.45)", fontSize: 13 },
  panel: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(6, 18, 36, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerText: { flex: 1 },
  summary: { color: "#E8F2FF", fontSize: 15, lineHeight: 20 },
  stepMeta: { color: "#86A7D2", fontSize: 11, marginTop: 4 },
  blendRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  blendChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  blendChipActive: { backgroundColor: "rgba(0, 187, 255, 0.25)", borderWidth: 1, borderColor: "#00BBFF" },
  blendChipText: { color: "#C8DCF5", fontSize: 11 },
  highlightBox: {
    marginTop: 10,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(0, 89, 255, 0.12)",
  },
  highlightText: { color: "#9EC5FF", fontSize: 12 },
  failures: { marginTop: 12, gap: 8 },
  failureCard: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
  },
  failureReason: { color: "#FECACA", fontSize: 12 },
  failureEvidence: { color: "rgba(255,255,255,0.65)", fontSize: 10, marginTop: 6 },
  ringRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 14 },
  chartWrap: { marginTop: 10, alignItems: "center" },
  tableBlock: { marginTop: 14 },
  tableTitle: { color: "#86A7D2", fontSize: 11, marginBottom: 6, textTransform: "uppercase" },
  tableRow: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  tableCell: { color: "rgba(255,255,255,0.75)", fontSize: 10, lineHeight: 14 },
});
