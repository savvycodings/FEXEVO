import React, { useContext } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { ThemeContext } from "../../context";

const SIZE = 132;
const STROKE = 10;
const R = (SIZE - STROKE) / 2 - 4;

/**
 * Static 12s ring matching the Figma blue-circle asset.
 * SVG so progress / seconds can be animated later via props.
 */
export function BodyScanRotateRing({
  seconds = 12,
  progress = 0.78,
  size = SIZE,
}: {
  seconds?: number;
  /** 0–1 filled arc (clockwise from 12 o'clock). */
  progress?: number;
  size?: number;
}) {
  const { theme } = useContext(ThemeContext);
  const scale = size / SIZE;
  const stroke = STROKE * scale;
  const r = R * scale;
  const c = 2 * Math.PI * r;
  const center = size / 2;
  const filled = Math.max(0, Math.min(1, progress));
  const dashOffset = c * (1 - filled);

  // Leading knob at end of arc (clockwise from 12 o'clock).
  const theta = -Math.PI / 2 + filled * 2 * Math.PI;
  const knobX = center + r * Math.cos(theta);
  const knobY = center + r * Math.sin(theta);
  const knobR = 5.5 * scale;

  return (
    <View style={[st.wrap, { width: size, height: size }]} testID="scan-rotate-ring">
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="scanRotateArc" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#00E5FF" />
            <Stop offset="55%" stopColor="#0088FF" />
            <Stop offset="100%" stopColor="#2454FF" />
          </SvgLinearGradient>
          <RadialGradient id="scanRotateKnobGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="45%" stopColor="#7AECFF" stopOpacity={0.85} />
            <Stop offset="100%" stopColor="#00B8FF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <G transform={`rotate(-90 ${center} ${center})`}>
          <Circle
            cx={center}
            cy={center}
            r={r}
            stroke="rgba(0, 80, 160, 0.35)"
            strokeWidth={stroke}
            fill="transparent"
          />
          {/* Soft outer bloom */}
          <Circle
            cx={center}
            cy={center}
            r={r}
            stroke="url(#scanRotateArc)"
            strokeWidth={stroke + 8 * scale}
            strokeOpacity={0.22}
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={dashOffset}
            fill="transparent"
          />
          <Circle
            cx={center}
            cy={center}
            r={r}
            stroke="url(#scanRotateArc)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={dashOffset}
            fill="transparent"
          />
        </G>
        {/* Knob glow + core (not rotated — positioned in view coords) */}
        <Circle cx={knobX} cy={knobY} r={knobR * 2.2} fill="url(#scanRotateKnobGlow)" />
        <Circle cx={knobX} cy={knobY} r={knobR} fill="#FFFFFF" />
      </Svg>
      <View style={st.center} pointerEvents="none">
        <Text allowFontScaling={false} style={[st.seconds, { fontFamily: theme.semiBoldFont }]}>
          {`${seconds}s`}
        </Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  seconds: {
    fontSize: 28,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
});
