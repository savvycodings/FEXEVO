import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

const RING_COLOR = "#40C0FF";
const RING_TRACK = "rgba(64, 192, 255, 0.22)";

type Props = {
  value: number;
  size?: number;
  label?: string;
  fontFamily?: string;
};

function clamp100(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

export function BenchScoreRing({ value, size = 52, label, fontFamily }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const stroke = Math.max(2.5, size * 0.05);
  const c = 2 * Math.PI * r;
  const p = clamp100(value) / 100;
  const dash = `${p * c} ${c}`;
  const display = Number.isInteger(value) ? String(clamp100(value)) : clamp100(value).toFixed(0);

  return (
    <View style={[styles.wrap, { width: size, height: size + (label ? 14 : 0) }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G transform={`rotate(-90 ${cx} ${cy})`}>
          <Circle cx={cx} cy={cy} r={r} stroke={RING_TRACK} strokeWidth={stroke} fill="none" />
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={RING_COLOR}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={dash}
          />
        </G>
      </Svg>
      <View style={[styles.center, { width: size, height: size }]} pointerEvents="none">
        <Text style={[styles.score, fontFamily ? { fontFamily } : null]} allowFontScaling={false}>
          {display}
        </Text>
      </View>
      {label ? (
        <Text style={[styles.label, fontFamily ? { fontFamily } : null]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  center: {
    position: "absolute",
    top: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  score: {
    color: "#E8F2FF",
    fontSize: 13,
    fontWeight: "600",
  },
  label: {
    color: "#86A7D2",
    fontSize: 9,
    marginTop: 2,
    maxWidth: 64,
    textAlign: "center",
  },
});
