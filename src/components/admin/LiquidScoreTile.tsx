import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";

type Props = {
  title: string;
  scorePercent: number | null;
  passThreshold?: number;
  summary?: string | null;
  loading?: boolean;
  onPress: () => void;
  theme: {
    textColor: string;
    regularFont: string;
    semiBoldFont: string;
    mediumFont: string;
  };
};

export function LiquidScoreTile({
  title,
  scorePercent,
  passThreshold = 60,
  summary,
  loading,
  onPress,
  theme,
}: Props) {
  const hasScore = scorePercent != null && !loading;
  const pct = hasScore ? Math.max(0, Math.min(100, scorePercent)) : 0;
  const passed = hasScore && pct >= passThreshold;
  const liquidColor = passed ? "#22c55e" : "#ef4444";
  const fillHeight = hasScore ? `${pct}%` : "8%";

  return (
    <TouchableOpacity
      style={styles.tile}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${hasScore ? `${pct} percent` : "not run"}`}
    >
      <View style={styles.liquidWell}>
        <View
          style={[
            styles.liquidFill,
            {
              height: fillHeight as `${number}%`,
              backgroundColor: liquidColor,
            },
          ]}
        />
        {loading ? (
          <View style={styles.centerOverlay}>
            <ActivityIndicator color="#fff" size="small" />
          </View>
        ) : hasScore ? (
          <View style={styles.centerOverlay}>
            <Text style={[styles.pctText, { fontFamily: theme.semiBoldFont }]}>{pct}%</Text>
          </View>
        ) : (
          <View style={styles.centerOverlay}>
            <Text style={[styles.tapText, { fontFamily: theme.mediumFont }]}>Tap</Text>
          </View>
        )}
      </View>
      <Text style={[styles.title, { color: theme.textColor, fontFamily: theme.semiBoldFont }]} numberOfLines={2}>
        {title}
      </Text>
      {summary ? (
        <Text style={[styles.summary, { fontFamily: theme.regularFont }]} numberOfLines={2}>
          {summary}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: "47%",
    minWidth: 140,
    marginBottom: 14,
  },
  liquidWell: {
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: "rgba(40, 10, 10, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  liquidFill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.92,
  },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  pctText: {
    color: "#fff",
    fontSize: 22,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  tapText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
  },
  title: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 17,
  },
  summary: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
});
