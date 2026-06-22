import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemeContext } from "../context";
import { BenchSubmissionCard } from "../components/admin/BenchSubmissionCard";
import { BenchStepResultPanel } from "../components/admin/BenchStepResult";
import {
  fetchBenchSteps,
  fetchBenchSubmissions,
  runBenchStep,
  type BenchStepDef,
  type BenchStepResult,
  type BenchSubmission,
} from "../lib/adminRetrievalBenchApi";
import { formatApiError } from "../lib/formatApiError";

type Props = {
  onClose: () => void;
  skipPasswordGate?: boolean;
};

export function AdminRetrievalBench({ onClose, skipPasswordGate }: Props) {
  const { theme } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme);

  const [steps, setSteps] = useState<BenchStepDef[]>([]);
  const [passThreshold, setPassThreshold] = useState(60);
  const [submissions, setSubmissions] = useState<BenchSubmission[]>([]);
  const [search, setSearch] = useState("");
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [runningStepId, setRunningStepId] = useState<string | null>(null);
  const [stepResults, setStepResults] = useState<Record<string, BenchStepResult>>({});
  const [blendMeshWeight, setBlendMeshWeight] = useState<number | null>(0.4);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stepData, subs] = await Promise.all([
        fetchBenchSteps(),
        fetchBenchSubmissions(search || undefined),
      ]);
      setSteps(stepData.steps);
      setPassThreshold(stepData.passThresholdPercent);
      setSubmissions(subs);
      setSelectedAnalysisId((prev) => prev ?? subs[0]?.analysisId ?? null);
    } catch (e: unknown) {
      setError(formatApiError(e, "Failed to load bench"));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (skipPasswordGate) void load();
  }, [skipPasswordGate, load]);

  async function onRunStep(stepId: string) {
    setRunningStepId(stepId);
    setActiveStepId(stepId);
    setError(null);
    try {
      const body: { analysisId?: string; blendMeshWeight?: number } = {};
      if (stepId === "5_analysis_audit") {
        if (!selectedAnalysisId) {
          setError("Select a submission for step 5");
          return;
        }
        body.analysisId = selectedAnalysisId;
      }
      if (stepId === "2_loocv" && blendMeshWeight != null) {
        body.blendMeshWeight = blendMeshWeight;
      }
      const result = await runBenchStep(stepId, body);
      setStepResults((prev) => ({ ...prev, [stepId]: result }));
      if (stepId === "3_blend" && blendMeshWeight == null) {
        setBlendMeshWeight(0.4);
      }
    } catch (e: unknown) {
      setError(formatApiError(e, "Step failed"));
    } finally {
      setRunningStepId(null);
    }
  }

  const activeResult = activeStepId ? stepResults[activeStepId] ?? null : null;

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + 6, paddingBottom: 10 }]}>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#00BBFF" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Retrieval bench</Text>
        <TouchableOpacity onPress={() => void load()} hitSlop={12} disabled={loading}>
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

        <TextInput
          style={[styles.search, { fontFamily: theme.regularFont }]}
          placeholder="Filter username"
          placeholderTextColor="rgba(255,255,255,0.35)"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => void load()}
          returnKeyType="search"
        />

        <Text style={[styles.sectionLabel, { fontFamily: theme.semiBoldFont }]}>Submissions</Text>
        {loading ? (
          <ActivityIndicator color="#00BBFF" style={{ marginVertical: 12 }} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardScroll}>
            {submissions.map((s) => (
              <BenchSubmissionCard
                key={s.analysisId}
                item={s}
                selected={selectedAnalysisId === s.analysisId}
                onSelect={() => setSelectedAnalysisId(s.analysisId)}
                theme={theme}
              />
            ))}
          </ScrollView>
        )}

        <Text style={[styles.sectionLabel, { fontFamily: theme.semiBoldFont, marginTop: 16 }]}>
          Steps
        </Text>
        <View style={styles.stepsRow}>
          {steps.map((s) => {
            const running = runningStepId === s.id;
            const done = Boolean(stepResults[s.id]);
            const active = activeStepId === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.stepChip, active && styles.stepChipActive]}
                onPress={() => {
                  const rerunning = activeStepId === s.id && Boolean(stepResults[s.id]);
                  setActiveStepId(s.id);
                  if (!stepResults[s.id] || rerunning) void onRunStep(s.id);
                }}
                disabled={running}
              >
                {running ? (
                  <ActivityIndicator size="small" color="#00BBFF" />
                ) : (
                  <Text style={[styles.stepNum, { fontFamily: theme.semiBoldFont }]}>
                    {s.order}
                  </Text>
                )}
                <Text style={[styles.stepTitle, { fontFamily: theme.mediumFont }]} numberOfLines={1}>
                  {s.title}
                </Text>
                {done ? <View style={styles.stepDot} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <BenchStepResultPanel
          result={activeResult}
          passThreshold={passThreshold}
          blendMeshWeight={activeStepId === "3_blend" ? blendMeshWeight : null}
          onBlendWeightChange={setBlendMeshWeight}
          theme={theme}
        />
      </KeyboardAwareScrollView>
    </View>
  );
}

function getStyles(theme: { semiBoldFont: string }) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#020810" },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "rgba(255,255,255,0.1)",
    },
    backBtn: { width: 36, alignItems: "flex-start" },
    topTitle: {
      flex: 1,
      textAlign: "center",
      color: "#E8F2FF",
      fontSize: 17,
      fontFamily: theme.semiBoldFont,
    },
    scroll: { paddingHorizontal: 16, paddingTop: 12 },
    errorText: { color: "#f87171", fontSize: 13, marginBottom: 8 },
    search: {
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: "#E8F2FF",
      fontSize: 14,
      marginBottom: 8,
    },
    sectionLabel: { color: "#86A7D2", fontSize: 12, marginBottom: 8 },
    cardScroll: { marginHorizontal: -4 },
    stepsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    stepChip: {
      width: "30%",
      minWidth: 100,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 10,
      backgroundColor: "rgba(255,255,255,0.06)",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "transparent",
    },
    stepChipActive: { borderColor: "#00BBFF", backgroundColor: "rgba(0,100,180,0.2)" },
    stepNum: { color: "#00BBFF", fontSize: 16 },
    stepTitle: { color: "#C8DCF5", fontSize: 10, marginTop: 4, textAlign: "center" },
    stepDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#22c55e",
      marginTop: 4,
    },
  });
}
