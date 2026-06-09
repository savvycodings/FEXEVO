import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle, G } from 'react-native-svg'

const DEFAULT_RING_SIZE = 56
const SCORE_RING_STROKE = 3 * 1.15

function scoreToProgress(n: number) {
  return Math.min(100, Math.max(0, n)) / 100
}

type Props = {
  actualScore: number
  lastScore: number
  /** Theme font names */
  semiBoldFont: string
  size?: number
}

export function MyCoachScoreRing({ actualScore, lastScore, semiBoldFont, size = DEFAULT_RING_SIZE }: Props) {
  const actualP = scoreToProgress(actualScore)
  const lastP = scoreToProgress(lastScore)
  const cx = size / 2
  const cy = size / 2
  const w = SCORE_RING_STROKE
  const outerR = size / 2 - w / 2
  const innerR = outerR - w
  const lenOuter = 2 * Math.PI * outerR
  const lenInner = 2 * Math.PI * innerR
  const rotateTop = `rotate(-90 ${cx} ${cy})`

  return (
    <View style={[styles.ringWrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
        <Circle cx={cx} cy={cy} r={outerR} stroke="rgba(64, 192, 255, 0.28)" strokeWidth={w} fill="none" />
        <G transform={rotateTop}>
          <Circle
            cx={cx}
            cy={cy}
            r={outerR}
            stroke="#40C0FF"
            strokeWidth={w}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={lenOuter}
            strokeDashoffset={lenOuter * (1 - actualP)}
          />
        </G>
        <Circle cx={cx} cy={cy} r={innerR} stroke="rgba(43, 124, 255, 0.22)" strokeWidth={w} fill="none" />
        <G transform={rotateTop}>
          <Circle
            cx={cx}
            cy={cy}
            r={innerR}
            stroke="#2B7CFF"
            strokeWidth={w}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={lenInner}
            strokeDashoffset={lenInner * (1 - lastP)}
          />
        </G>
      </Svg>
      <View style={styles.ringInner} pointerEvents="none">
        <Text allowFontScaling={false} style={[styles.ringActual, { fontFamily: semiBoldFont }]}>
          {actualScore}
        </Text>
        <Text allowFontScaling={false} style={[styles.ringLast, { fontFamily: semiBoldFont }]}>
          {lastScore}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    alignItems: 'center',
  },
  ringActual: {
    color: '#2D86FF',
    fontSize: 14,
    lineHeight: 15,
  },
  ringLast: {
    color: '#5260A4',
    fontSize: 12,
    lineHeight: 12,
    marginTop: 1,
  },
})
