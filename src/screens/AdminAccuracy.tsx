import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemeContext } from "../context";
import { LiquidScoreTile } from "../components/admin/LiquidScoreTile";
import {
  fetchAccuracyCatalog,
  fetchAccuracyHistory,
  runAccuracyTest,
  runAllAccuracyTests,
  type AccuracyTestDef,
  type AccuracyTestRun,
} from "../lib/adminAccuracyApi";
import { formatApiError } from "../lib/formatApiError";

type Props = {
  onClose: () => void;
  skipPasswordGate?: boolean;
};

function meshSummaryFromDetail(detail: Record<string, unknown> | null | undefined): string | null {
  const samples = detail?.samples;
  if (!Array.isArray(samples) || samples.length === 0) return null;
  const withMesh = samples.filter(
    (s) => s && typeof s === "object" && (s as Record<string, unknown>).mesh_used === true
  );
  if (withMesh.length === 0) return null;
  const first = withMesh[0] as Record<string, unknown>;
  const src = typeof first.embedding_source === "string" ? first.embedding_source : "mesh";
  const conf =
    typeof first.mesh_confidence === "number"
      ? Math.round(first.mesh_confidence * 100)
      : null;
  return conf != null ? `Mesh · ${src} · ${conf}%` : `Mesh · ${src}`;
}

function meshDetailLines(detail: Record<string, unknown> | null | undefined): string[] {
  const samples = detail?.samples;
  if (!Array.isArray(samples)) return [];
  const lines: string[] = [];
  for (const s of samples.slice(0, 5)) {
    if (!s || typeof s !== "object") continue;
    const row = s as Record<string, unknown>;
    if (!row.mesh_used && !row.mesh_enriched) continue;
    const id = typeof row.id === "string" ? row.id.slice(0, 8) : "?";
    const src = row.embedding_source ?? "—";
    const conf =
      typeof row.mesh_confidence === "number"
        ? `${Math.round(row.mesh_confidence * 100)}%`
        : "—";
    const frames = row.mesh_frame_count ?? "—";
    lines.push(`${id}… · ${String(src)} · conf ${conf} · ${frames} frame(s)`);
  }
  return lines;
}

export function AdminAccuracy({ onClose, skipPasswordGate }: Props) {
  const { theme } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme);

  const [catalog, setCatalog] = useState<AccuracyTestDef[]>([]);
  const [passThreshold, setPassThreshold] = useState(60);
  const [latestByTest, setLatestByTest] = useState<Record<string, AccuracyTestRun>>({});
  const [history, setHistory] = useState<AccuracyTestRun[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [detailRun, setDetailRun] = useState<AccuracyTestRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshHistory = useCallback(async () => {
    const h = await fetchAccuracyHistory();
    setHistory(h.runs);
    setLatestByTest(h.latestByTest);
  }, []);

  const load = useCallback(async () => {
    setLoadingCatalog(true);
    setError(null);
    try {
      const c = await fetchAccuracyCatalog();
      setCatalog(c.tests);
      setPassThreshold(c.passThresholdPercent);
      await refreshHistory();
    } catch (e: unknown) {
      setError(formatApiError(e, "Failed to load tests"));
    } finally {
      setLoadingCatalog(false);
    }
  }, [refreshHistory]);

  useEffect(() => {
    if (skipPasswordGate) void load();
  }, [skipPasswordGate, load]);

  async function onRunTest(testId: string) {
    setRunningId(testId);
    setError(null);
    try {
      const result = await runAccuracyTest(testId);
      await refreshHistory();
      const def = catalog.find((t) => t.id === testId);
      Alert.alert(
        def?.title ?? testId,
        `${result.scorePercent}% — ${result.summary}`,
        [{ text: "Details", onPress: () => showDetailForTest(testId) }, { text: "OK" }]
      );
    } catch (e: unknown) {
      setError(formatApiError(e, "Test failed"));
    } finally {
      setRunningId(null);
    }
  }

  async function onRunAll() {
    setRunningAll(true);
    setError(null);
    try {
      await runAllAccuracyTests();
      await refreshHistory();
      Alert.alert("Done", "All tests ran. Scores saved to history.");
    } catch (e: unknown) {
      setError(formatApiError(e, "Run all failed"));
    } finally {
      setRunningAll(false);
    }
  }

  function showDetailForTest(testId: string) {
    const run = latestByTest[testId] ?? history.find((r) => r.testId === testId);
    if (run) setDetailRun(run);
  }

  const catalogById = useMemo(() => new Map(catalog.map((t) => [t.id, t])), [catalog]);

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + 6, paddingBottom: 10 }]}>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.backBtn} accessibilityRole="button">
          <Ionicons name="chevron-back" size={22} color="#00BBFF" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Training accuracy</Text>
        <TouchableOpacity
          onPress={() => void load()}
          hitSlop={12}
          disabled={loadingCatalog}
          accessibilityRole="button"
          accessibilityLabel="Refresh"
        >
          <Ionicons name="refresh-outline" size={22} color="#00BBFF" />
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.runAllBtn, runningAll && styles.runAllBtnDisabled]}
          onPress={() => void onRunAll()}
          disabled={runningAll || loadingCatalog}
          activeOpacity={0.85}
        >
          {runningAll ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.runAllText}>Run all tests</Text>
          )}
        </TouchableOpacity>

        {loadingCatalog ? (
          <ActivityIndicator color="#00BBFF" style={{ marginTop: 24 }} />
        ) : (
          <View style={styles.grid}>
            {catalog.map((t) => {
              const latest = latestByTest[t.id];
              return (
                <LiquidScoreTile
                  key={t.id}
                  title={t.title}
                  scorePercent={latest?.scorePercent ?? null}
                  passThreshold={passThreshold}
                  summary={latest?.summary ?? t.description}
                  loading={runningId === t.id}
                  onPress={() => void onRunTest(t.id)}
                  theme={theme}
                />
              );
            })}
          </View>
        )}

        <Text style={styles.sectionTitle}>History</Text>
        {history.length === 0 ? (
          <Text style={styles.muted}>No runs yet. Tap a tile or Run all.</Text>
        ) : (
          history.slice(0, 25).map((run) => {
            const def = catalogById.get(run.testId);
            const passed = run.scorePercent >= passThreshold;
            return (
              <TouchableOpacity
                key={run.id}
                style={styles.historyRow}
                onPress={() => setDetailRun(run)}
                activeOpacity={0.8}
              >
                <View style={[styles.historyDot, { backgroundColor: passed ? "#22c55e" : "#ef4444" }]} />
                <View style={styles.historyTextCol}>
                  <Text style={styles.historyTitle}>
                    {def?.title ?? run.testId} · {run.scorePercent}%
                  </Text>
                  <Text style={styles.historySummary} numberOfLines={1}>
                    {run.summary}
                  </Text>
                  {meshSummaryFromDetail(run.detail ?? null) ? (
                    <Text style={styles.historyMesh} numberOfLines={1}>
                      {meshSummaryFromDetail(run.detail ?? null)}
                    </Text>
                  ) : null}
                  <Text style={styles.historyDate}>
                    {new Date(run.createdAt).toLocaleString()}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.35)" />
              </TouchableOpacity>
            );
          })
        )}
      </KeyboardAwareScrollView>

      <Modal visible={!!detailRun} transparent animationType="fade" onRequestClose={() => setDetailRun(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {detailRun ? (catalogById.get(detailRun.testId)?.title ?? detailRun.testId) : ""}
            </Text>
            {detailRun ? (
              <ScrollView style={{ maxHeight: 320 }}>
                <Text style={styles.modalBody}>
                  {detailRun.scorePercent}% — {detailRun.summary}
                </Text>
                {meshDetailLines(detailRun.detail ?? null).length > 0 ? (
                  <View style={styles.modalMeshBlock}>
                    <Text style={styles.modalMeshTitle}>Mesh / pose enrichment</Text>
                    {meshDetailLines(detailRun.detail ?? null).map((line) => (
                      <Text key={line} style={styles.modalMeshLine}>
                        {line}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {detailRun.detail ? (
                  <Text style={styles.modalJson}>
                    {JSON.stringify(detailRun.detail, null, 2)}
                  </Text>
                ) : null}
              </ScrollView>
            ) : null}
            <TouchableOpacity style={styles.modalClose} onPress={() => setDetailRun(null)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getStyles(theme: {
  backgroundColor: string;
  textColor: string;
  regularFont: string;
  semiBoldFont: string;
  mediumFont: string;
}) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.backgroundColor },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "rgba(255,255,255,0.1)",
    },
    backBtn: { padding: 4, width: 32 },
    topTitle: { color: theme.textColor, fontFamily: theme.semiBoldFont, fontSize: 17 },
    scroll: { padding: 20 },
    errorText: {
      color: "#f87171",
      fontFamily: theme.regularFont,
      fontSize: 13,
      marginBottom: 12,
    },
    runAllBtn: {
      backgroundColor: "#0022FF",
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginBottom: 20,
    },
    runAllBtnDisabled: { opacity: 0.7 },
    runAllText: { color: "#fff", fontFamily: theme.semiBoldFont, fontSize: 15 },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },
    sectionTitle: {
      color: theme.textColor,
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
      marginTop: 8,
      marginBottom: 12,
    },
    muted: {
      color: "rgba(255,255,255,0.5)",
      fontFamily: theme.regularFont,
      fontSize: 13,
    },
    historyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "rgba(255,255,255,0.08)",
    },
    historyDot: { width: 10, height: 10, borderRadius: 5 },
    historyTextCol: { flex: 1, minWidth: 0 },
    historyTitle: {
      color: theme.textColor,
      fontFamily: theme.mediumFont,
      fontSize: 14,
    },
    historySummary: {
      color: "rgba(255,255,255,0.65)",
      fontFamily: theme.regularFont,
      fontSize: 12,
      marginTop: 2,
    },
    historyMesh: {
      color: "#67e8f9",
      fontFamily: theme.regularFont,
      fontSize: 11,
      marginTop: 2,
    },
    historyDate: {
      color: "rgba(255,255,255,0.4)",
      fontFamily: theme.regularFont,
      fontSize: 11,
      marginTop: 2,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      justifyContent: "center",
      padding: 24,
    },
    modalCard: {
      backgroundColor: "rgba(8, 24, 72, 0.98)",
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: "rgba(0, 187, 255, 0.25)",
    },
    modalTitle: {
      color: theme.textColor,
      fontFamily: theme.semiBoldFont,
      fontSize: 17,
      marginBottom: 12,
    },
    modalBody: {
      color: "rgba(255,255,255,0.85)",
      fontFamily: theme.regularFont,
      fontSize: 14,
      marginBottom: 12,
    },
    modalMeshBlock: {
      marginBottom: 12,
      padding: 10,
      borderRadius: 8,
      backgroundColor: "rgba(0, 187, 255, 0.08)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(0, 187, 255, 0.2)",
    },
    modalMeshTitle: {
      color: "#67e8f9",
      fontFamily: theme.semiBoldFont,
      fontSize: 12,
      marginBottom: 6,
    },
    modalMeshLine: {
      color: "rgba(255,255,255,0.75)",
      fontFamily: theme.regularFont,
      fontSize: 11,
      marginBottom: 2,
    },
    modalJson: {
      color: "rgba(255,255,255,0.6)",
      fontFamily: theme.regularFont,
      fontSize: 11,
    },
    modalClose: {
      marginTop: 16,
      alignSelf: "center",
      paddingVertical: 10,
      paddingHorizontal: 24,
    },
    modalCloseText: {
      color: "#00BBFF",
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
    },
  });
}
