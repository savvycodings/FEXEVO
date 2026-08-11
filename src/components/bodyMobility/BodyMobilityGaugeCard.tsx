import React, { useMemo } from 'react'
import { View, Text, Image, StyleSheet, type ImageSourcePropType } from 'react-native'
import Svg, { Circle, G, Path } from 'react-native-svg'
import {
  GAUGE_SEGMENT_COLORS_BY_JOINT,
  STATUS_COLORS,
  STATUS_PILL_BG,
  STATUS_PILL_TEXT,
  gaugeBinFromDeg,
  gaugeDisplayDeg,
  mobilityBlurb,
  statusFromWedgeColor,
  type MobilityJointKey,
  type MobilityJointReading,
  type BodySide,
} from '../../lib/bodyMobility'

const GAUGE_SIZE = 118
/** Original `guage.svg` artboard. */
const SVG_VB = 80
const SVG_CX = 40
const SVG_CY = 40
/** Midline radius of the SVG stroke wedges (approx). */
const SVG_R = 36
const EMBLEM = 76

/**
 * Exact paths from `app/assets/aicoachflow/guage.svg`, ordered left→right
 * (0° → 180°). Gaps / rounded caps come from the asset itself.
 * Fill colors are applied per joint via GAUGE_SEGMENT_COLORS_BY_JOINT.
 */
const GAUGE_WEDGE_PATHS: readonly string[] = [
  // Left
  'M2 40C0.895431 40 -0.00521602 39.1039 0.0499819 38.0007C0.382759 31.3498 2.37121 24.8862 5.83435 19.1983C6.40878 18.2549 7.65737 18.02 8.57094 18.6408V18.6408C9.48451 19.2617 9.7166 20.5029 9.14741 21.4496C6.1288 26.4699 4.38075 32.152 4.05553 38.001C3.99421 39.1038 3.10457 40 2 40V40Z',
  // Upper-left
  'M9.48871 17.3492C8.60182 16.6907 8.41281 15.4344 9.11471 14.5815C13.3463 9.43965 18.7957 5.43514 24.9668 2.93245C25.9904 2.51733 27.1329 3.07297 27.4964 4.11603V4.11603C27.8598 5.15909 27.3063 6.29406 26.285 6.71486C20.8688 8.94653 16.0783 12.4669 12.3307 16.9693C11.6241 17.8183 10.3756 18.0076 9.48871 17.3492V17.3492Z',
  // Top
  'M28.8899 3.66042C28.5669 2.60411 29.1606 1.48082 30.2317 1.21107C36.6893 -0.415234 43.4518 -0.403429 49.9037 1.24541C50.9739 1.5189 51.5636 2.64426 51.2369 3.69943V3.69943C50.9103 4.7546 49.7911 5.33945 48.7195 5.0719C43.0359 3.653 37.091 3.64262 31.4025 5.04167C30.3299 5.30548 29.2128 4.71672 28.8899 3.66042V3.66042Z',
  // Upper-right
  'M53.1021 4.33019C53.4829 3.29335 54.6346 2.75691 55.6511 3.18909C61.7795 5.79464 67.1611 9.88975 71.3061 15.1017C71.9937 15.9662 71.7837 17.2192 70.8859 17.8627V17.8627C69.9881 18.5061 68.743 18.296 68.0506 17.4354C64.3789 12.8709 59.6479 9.27087 54.2698 6.94892C53.2557 6.51109 52.7212 5.36703 53.1021 4.33019V4.33019Z',
  // Right
  'M72.0925 19.6512C73.0253 19.0597 74.2658 19.3342 74.81 20.2955C78.0904 26.0907 79.8723 32.6142 79.9934 39.2723C80.0135 40.3767 79.0848 41.2437 77.9808 41.2086V41.2086C76.8768 41.1735 76.0161 40.2495 75.9899 39.1452C75.8508 33.2889 74.2844 27.554 71.427 22.4402C70.8882 21.476 71.1596 20.2427 72.0925 19.6512V19.6512Z',
]

const JOINT_TITLE: Record<MobilityJointKey, string> = {
  head: 'Head',
  shoulder: 'Shoulder',
  wrist: 'Wrist',
  knee: 'Knee',
}

/** Map gauge 0–180° (left→right over top) onto the SVG artboard. */
function markerOnSvg(gaugeDeg: number) {
  const clamped = Math.max(0, Math.min(180, gaugeDeg))
  // 0° → left (π), 180° → right (0), over the top
  const rad = ((180 - clamped) * Math.PI) / 180
  return {
    x: SVG_CX + SVG_R * Math.cos(rad),
    y: SVG_CY - SVG_R * Math.sin(rad),
  }
}

export type BodyMobilityGaugeCardProps = {
  joint: MobilityJointKey
  reading: MobilityJointReading
  side: BodySide
  emblem: ImageSourcePropType
}

export function BodyMobilityGaugeCard({
  joint,
  reading,
  side,
  emblem,
}: BodyMobilityGaugeCardProps) {
  const styles = useMemo(() => getStyles(), [])
  const gaugeDeg =
    reading.gaugeDeg ?? gaugeDisplayDeg(joint, reading.you, reading.ideal)
  const activeBin = gaugeBinFromDeg(gaugeDeg)
  const status = statusFromWedgeColor(joint, activeBin) ?? reading.status
  const segmentColors = GAUGE_SEGMENT_COLORS_BY_JOINT[joint]
  const wedgeColor =
    activeBin != null ? segmentColors[activeBin] : 'rgba(255,255,255,0.35)'
  const blurb = mobilityBlurb(joint, { ...reading, status })
  const sideChip = side === 'RIGHT' ? 'R' : 'L'

  const marker = gaugeDeg != null ? markerOnSvg(gaugeDeg) : null

  return (
    <View style={styles.card}>
      <View style={styles.leftCol}>
        <Text allowFontScaling={false} style={styles.sideChipText}>
          {sideChip}
        </Text>
        <View style={styles.gaugeWrap}>
          <Svg width={GAUGE_SIZE} height={GAUGE_SIZE} viewBox={`0 0 ${SVG_VB} ${SVG_VB}`}>
            <G>
              {GAUGE_WEDGE_PATHS.map((d, bin) => (
                <Path
                  key={bin}
                  d={d}
                  fill={segmentColors[bin]}
                  opacity={activeBin === bin ? 1 : 0.25}
                />
              ))}
            </G>
            {marker ? (
              <Circle
                cx={marker.x}
                cy={marker.y}
                r={4.5}
                fill={wedgeColor}
                stroke="#020F26"
                strokeWidth={1.25}
              />
            ) : null}
          </Svg>
          <View style={styles.emblemWrap} pointerEvents="none">
            <Image source={emblem} style={styles.emblem} resizeMode="contain" />
          </View>
        </View>
        {status ? (
          <View style={[styles.statusPill, { backgroundColor: STATUS_PILL_BG[status] }]}>
            <Text
              allowFontScaling={false}
              style={[styles.statusPillText, { color: STATUS_PILL_TEXT[status] }]}
            >
              {status.toUpperCase()}
            </Text>
          </View>
        ) : (
          <View style={[styles.statusPill, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
            <Text allowFontScaling={false} style={[styles.statusPillText, { color: '#FFFFFF' }]}>
              -
            </Text>
          </View>
        )}
      </View>

      <View style={styles.rightCol}>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: wedgeColor }]} />
            <Text allowFontScaling={false} style={styles.legendText}>
              You{' '}
              <Text allowFontScaling={false} style={styles.legendValue}>
                {reading.you != null ? `${reading.you}°` : '-'}
              </Text>
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS.good }]} />
            <Text allowFontScaling={false} style={styles.legendText}>
              Ideal{' '}
              <Text allowFontScaling={false} style={styles.legendValue}>
                {reading.ideal != null ? `${reading.ideal}°` : '-'}
              </Text>
            </Text>
          </View>
        </View>
        <Text allowFontScaling={false} style={styles.title}>
          {JOINT_TITLE[joint]}
        </Text>
        <Text allowFontScaling={false} style={styles.blurb} numberOfLines={4}>
          {blurb}
        </Text>
      </View>
    </View>
  )
}

function getStyles() {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
      paddingVertical: 20,
      paddingHorizontal: 18,
      borderRadius: 20,
      backgroundColor: 'rgba(0, 75, 255, 0.1)',
      marginBottom: 12,
    },
    leftCol: {
      width: GAUGE_SIZE + 12,
      alignItems: 'center',
      paddingTop: 4,
    },
    sideChipText: {
      position: 'absolute',
      left: 2,
      top: 0,
      zIndex: 2,
      color: 'rgba(0, 184, 255, 0.55)',
      fontSize: 13,
      fontWeight: '600',
    },
    gaugeWrap: {
      width: GAUGE_SIZE,
      height: GAUGE_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emblemWrap: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 4,
    },
    emblem: {
      width: EMBLEM,
      height: EMBLEM,
    },
    statusPill: {
      marginTop: 10,
      minWidth: 72,
      paddingHorizontal: 18,
      paddingVertical: 6,
      borderRadius: 999,
      alignItems: 'center',
    },
    statusPillText: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    rightCol: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 4,
      justifyContent: 'center',
      gap: 10,
    },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: 18,
      rowGap: 6,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    legendDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
    },
    legendText: {
      color: 'rgba(160, 200, 230, 0.85)',
      fontSize: 13,
      fontWeight: '500',
    },
    legendValue: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    title: {
      color: '#7EC8FF',
      fontSize: 26,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    blurb: {
      color: 'rgba(180, 210, 240, 0.72)',
      fontSize: 14,
      lineHeight: 20,
    },
  })
}
