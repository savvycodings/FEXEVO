import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Image,
  PanResponder,
  Modal,
  TouchableOpacity,
  Pressable,
  Platform,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native'
import { useContext } from 'react'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Circle as SvgCircle } from 'react-native-svg'
import { ThemeContext } from '../context'
import { ProLibraryGradientFrame } from './ProLibraryGradientFrame'

const COURT_IMG = require('../../assets/game/courtgame.png')
const PADDLE_IMG = require('../../assets/game/padle.png')
const BALL_IMG = require('../../assets/game/ball.png')
const XEVO_LOGO = require('../../assets/game/xevologo.png')

const MODAL_FILL = '#030A17'
const FRAME_OUTER_RADIUS = 28
const FRAME_STROKE = 2

/** Native court art aspect (302×526). */
const COURT_ASPECT = 302 / 526
const PADDLE_ASPECT = 66 / 13

/**
 * Playable blue area inside the thick black border of courtgame.png
 * (approx. native border ~12px on 302×526).
 */
const INSET_X = 0.045
const INSET_Y = 0.028

type Props = {
  paused?: boolean
}

type BallState = {
  x: number
  y: number
  vx: number
  vy: number
}

type CourtMetrics = {
  w: number
  h: number
  playLeft: number
  playTop: number
  playRight: number
  playBottom: number
  playW: number
  playH: number
  paddleW: number
  paddleH: number
  ballSize: number
  playerY: number
  aiY: number
}

function formatScore(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0')
}

type ScorePillProps = {
  variant: 'xevo' | 'you'
  value: number
  fontFamily?: string
}

function ScorePill({ variant, value, fontFamily }: ScorePillProps) {
  const isXevo = variant === 'xevo'
  return (
    <View
      style={[
        stylesScorePill.glowWrap,
        isXevo ? stylesScorePill.glowXevo : stylesScorePill.glowYou,
      ]}
    >
      <View
        style={[
          stylesScorePill.pill,
          isXevo ? stylesScorePill.pillXevo : stylesScorePill.pillYou,
        ]}
      >
        {/* Inner shadow / inset glow clipped to the pill */}
        {isXevo ? (
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0, 89, 255, 0.55)', 'transparent', 'rgba(0, 89, 255, 0.35)']}
            locations={[0, 0.42, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={stylesScorePill.innerShadow}
          />
        ) : (
          <>
            <View pointerEvents="none" style={stylesScorePill.innerShadowYouRim} />
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(0, 255, 9, 0.85)', 'transparent', 'rgba(0, 255, 9, 0.65)']}
              locations={[0, 0.4, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={stylesScorePill.innerShadow}
            />
          </>
        )}

        {isXevo ? (
          <>
            <Image source={XEVO_LOGO} style={stylesScorePill.logo} resizeMode="contain" />
            <Text
              allowFontScaling={false}
              style={[stylesScorePill.labelXevo, fontFamily ? { fontFamily } : null]}
            >
              SCORE
            </Text>
          </>
        ) : (
          <Text
            allowFontScaling={false}
            style={[stylesScorePill.labelYou, fontFamily ? { fontFamily } : null]}
          >
            YOUR SCORE
          </Text>
        )}

        <View
          style={[
            stylesScorePill.circle,
            isXevo ? stylesScorePill.circleXevo : stylesScorePill.circleYou,
          ]}
        >
          {/* Soft #00B8FF inner blur (not a hard outline) */}
          <Svg
            pointerEvents="none"
            width={CIRCLE_SIZE}
            height={CIRCLE_SIZE}
            style={stylesScorePill.circleBlurSvg}
          >
            <Defs>
              <SvgRadialGradient
                id={isXevo ? 'scoreCircleBlurXevo' : 'scoreCircleBlurYou'}
                cx="50%"
                cy="50%"
                rx="50%"
                ry="50%"
              >
                <Stop offset="0%" stopColor="#00B8FF" stopOpacity="0" />
                <Stop offset="45%" stopColor="#00B8FF" stopOpacity="0.12" />
                <Stop offset="78%" stopColor="#00B8FF" stopOpacity="0.45" />
                <Stop offset="100%" stopColor="#00B8FF" stopOpacity="0.85" />
              </SvgRadialGradient>
            </Defs>
            <SvgCircle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={CIRCLE_SIZE / 2}
              fill={`url(#${isXevo ? 'scoreCircleBlurXevo' : 'scoreCircleBlurYou'})`}
            />
          </Svg>
          <Text
            allowFontScaling={false}
            style={[stylesScorePill.circleText, fontFamily ? { fontFamily } : null]}
          >
            {formatScore(value)}
          </Text>
        </View>
      </View>
    </View>
  )
}

const CIRCLE_SIZE = 34

const stylesScorePill = StyleSheet.create({
  glowWrap: {
    borderRadius: 999,
    alignSelf: 'flex-start',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  glowXevo: {
    shadowColor: '#0059FF',
    shadowRadius: 12,
  },
  glowYou: {
    shadowColor: '#00FF09',
    shadowRadius: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    minHeight: 40,
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 4,
    gap: 6,
    overflow: 'hidden',
  },
  pillXevo: {
    backgroundColor: '#041641',
  },
  pillYou: {
    backgroundColor: '#C2FF00',
  },
  innerShadow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
  },
  /** Visible #00FF09 inset rim on YOUR SCORE */
  innerShadowYouRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: '#00FF09',
  },
  logo: {
    width: 48,
    height: 16,
    marginRight: -2,
  },
  labelXevo: {
    color: '#00B8FF',
    fontSize: 10,
    letterSpacing: 0.6,
    fontWeight: '600',
    marginLeft: -4,
  },
  labelYou: {
    color: '#020A17',
    fontSize: 11,
    letterSpacing: 0.4,
    fontWeight: '700',
    marginLeft: 4,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  circleXevo: {
    backgroundColor: 'rgba(0, 89, 255, 0.5)',
  },
  circleYou: {
    backgroundColor: '#020A17',
  },
  circleBlurSvg: {
    ...StyleSheet.absoluteFillObject,
  },
  circleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 16,
    zIndex: 1,
  },
})

function randSign(): number {
  return Math.random() < 0.5 ? -1 : 1
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/** Reflect off a paddle face; never lose speed (side-spin only changes direction). */
function paddleFaceBounce(
  ballCx: number,
  paddleLeft: number,
  paddleW: number,
  speedBefore: number,
  boost: number,
  /** +1 = send downward (opponent), -1 = send upward (player) */
  dirY: number,
  minSpeed: number
): { vx: number; vy: number } {
  const hit = clamp((ballCx - (paddleLeft + paddleW / 2)) / (paddleW / 2), -1, 1)
  // Max ~50° from vertical so edge hits angle out without killing speed
  const angle = hit * (Math.PI / 3.6)
  const outSpeed = Math.max(speedBefore * boost, minSpeed)
  return {
    vx: Math.sin(angle) * outSpeed,
    vy: Math.cos(angle) * outSpeed * dirY,
  }
}

function buildMetrics(width: number, height: number): CourtMetrics {
  const playLeft = width * INSET_X
  const playTop = height * INSET_Y
  const playRight = width * (1 - INSET_X)
  const playBottom = height * (1 - INSET_Y)
  const playW = playRight - playLeft
  const playH = playBottom - playTop
  const paddleW = Math.round(playW * 0.3)
  const paddleH = Math.max(10, Math.round(paddleW / PADDLE_ASPECT))
  const ballSize = Math.round(playW * 0.07)
  const endPad = Math.max(4, playH * 0.018)
  return {
    w: width,
    h: height,
    playLeft,
    playTop,
    playRight,
    playBottom,
    playW,
    playH,
    paddleW,
    paddleH,
    ballSize,
    playerY: playBottom - paddleH - endPad,
    aiY: playTop + endPad,
  }
}

export function PaddlePongGame({ paused = false }: Props) {
  const { theme } = useContext(ThemeContext)
  const { width: winW } = useWindowDimensions()
  const styles = useMemo(() => getStyles(theme), [theme])
  const cardWidth = Math.min(340, Math.max(280, winW - 48))
  const innerRadius = Math.max(12, FRAME_OUTER_RADIUS - FRAME_STROKE)

  const [layoutW, setLayoutW] = useState(0)
  const [playerScore, setPlayerScore] = useState(0)
  const [opponentScore, setOpponentScore] = useState(0)
  const [missVisible, setMissVisible] = useState(false)
  const [missScore, setMissScore] = useState(0)
  const [frame, setFrame] = useState({
    playerX: 0,
    aiX: 0,
    ballX: 0,
    ballY: 0,
  })

  const metricsRef = useRef<CourtMetrics | null>(null)
  const playerXRef = useRef(0)
  const aiXRef = useRef(0)
  const ballRef = useRef<BallState>({ x: 0, y: 0, vx: 0, vy: 0 })
  const dragStartXRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef<number | null>(null)
  const readyRef = useRef(false)
  const pausedRef = useRef(paused)
  const missVisibleRef = useRef(false)
  const scoreLockRef = useRef(false)
  const playerScoreRef = useRef(0)
  const opponentScoreRef = useRef(0)
  /** Prevents counting multiple points while the ball is still overlapping the paddle. */
  const playerHitLockRef = useRef(false)
  const opponentHitLockRef = useRef(false)

  pausedRef.current = paused
  missVisibleRef.current = missVisible
  playerScoreRef.current = playerScore
  opponentScoreRef.current = opponentScore

  const metrics = metricsRef.current

  const resetBall = useCallback((_towardPlayer?: boolean) => {
    const m = metricsRef.current
    if (!m) return
    const speed = Math.max(250, m.playH * 0.55)
    // Serve from opponent: ball starts on their paddle, then moves down.
    const serveX = clamp(
      aiXRef.current + (m.paddleW - m.ballSize) / 2,
      m.playLeft,
      m.playRight - m.ballSize
    )
    ballRef.current = {
      x: serveX,
      y: m.aiY + m.paddleH + 2,
      vx: speed * 0.22 * randSign(),
      vy: Math.abs(speed),
    }
    scoreLockRef.current = false
  }, [])

  const onRetry = useCallback(() => {
    setPlayerScore(0)
    setOpponentScore(0)
    playerScoreRef.current = 0
    opponentScoreRef.current = 0
    setMissVisible(false)
    missVisibleRef.current = false
    playerHitLockRef.current = false
    opponentHitLockRef.current = false
    const m = metricsRef.current
    if (m) {
      const mid = m.playLeft + (m.playW - m.paddleW) / 2
      playerXRef.current = mid
      aiXRef.current = mid
      resetBall(true)
      setFrame({
        playerX: mid,
        aiX: mid,
        ballX: ballRef.current.x,
        ballY: ballRef.current.y,
      })
    }
    lastTsRef.current = null
  }, [resetBall])

  const onCourtLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    if (width <= 0 || height <= 0) return
    const prev = metricsRef.current
    if (prev && Math.abs(prev.w - width) < 1 && Math.abs(prev.h - height) < 1) return

    const m = buildMetrics(width, height)
    metricsRef.current = m
    setLayoutW(width)

    const mid = m.playLeft + (m.playW - m.paddleW) / 2
    playerXRef.current = mid
    aiXRef.current = mid

    const speed = Math.max(250, m.playH * 0.55)
    ballRef.current = {
      x: mid + (m.paddleW - m.ballSize) / 2,
      y: m.aiY + m.paddleH + 2,
      vx: speed * 0.22 * randSign(),
      vy: speed,
    }
    setFrame({
      playerX: mid,
      aiX: mid,
      ballX: ballRef.current.x,
      ballY: ballRef.current.y,
    })
    readyRef.current = true
    scoreLockRef.current = false
  }, [])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !missVisibleRef.current,
        onMoveShouldSetPanResponder: () => !missVisibleRef.current,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragStartXRef.current = playerXRef.current
        },
        onPanResponderMove: (_evt, gesture) => {
          if (missVisibleRef.current) return
          const m = metricsRef.current
          if (!m) return
          const minX = m.playLeft
          const maxX = m.playRight - m.paddleW
          playerXRef.current = clamp(dragStartXRef.current + gesture.dx, minX, maxX)
        },
      }),
    []
  )

  useEffect(() => {
    const tick = (ts: number) => {
      rafRef.current = requestAnimationFrame(tick)
      if (pausedRef.current || missVisibleRef.current || !readyRef.current) {
        lastTsRef.current = ts
        return
      }
      const last = lastTsRef.current
      lastTsRef.current = ts
      if (last == null) return
      const dt = Math.min(0.033, (ts - last) / 1000)
      const m = metricsRef.current
      if (!m) return

      let { x, y, vx, vy } = ballRef.current
      const { playLeft, playTop, playRight, playBottom, paddleW, paddleH, ballSize, playerY, aiY } =
        m
      const minPaddleX = playLeft
      const maxPaddleX = playRight - paddleW

      const ballCx = x + ballSize / 2
      const aiTarget = clamp(ballCx - paddleW / 2, minPaddleX, maxPaddleX)
      const aiSpeed = Math.max(200, m.playH * 0.65)
      const aiCur = aiXRef.current
      aiXRef.current = clamp(
        aiCur + clamp(aiTarget - aiCur, -aiSpeed * dt, aiSpeed * dt),
        minPaddleX,
        maxPaddleX
      )

      x += vx * dt
      y += vy * dt

      if (x < playLeft) {
        x = playLeft
        vx = Math.abs(vx)
      } else if (x + ballSize > playRight) {
        x = playRight - ballSize
        vx = -Math.abs(vx)
      }

      const playerLeft = playerXRef.current
      const aiLeft = aiXRef.current
      const ballCxNow = x + ballSize / 2
      const minBallSpeed = Math.max(250, m.playH * 0.55)

      // Opponent paddle
      if (
        vy < 0 &&
        y <= aiY + paddleH &&
        y + ballSize >= aiY &&
        x + ballSize >= aiLeft &&
        x <= aiLeft + paddleW
      ) {
        const speedBefore = Math.hypot(vx, vy)
        const centerOnFace = ballCxNow >= aiLeft && ballCxNow <= aiLeft + paddleW
        if (!centerOnFace) {
          // Glancing side hit — bounce horizontally, keep full speed
          if (ballCxNow < aiLeft + paddleW / 2) {
            x = aiLeft - ballSize
            vx = -Math.abs(vx || speedBefore * 0.5)
          } else {
            x = aiLeft + paddleW
            vx = Math.abs(vx || speedBefore * 0.5)
          }
          const keep = Math.max(speedBefore, minBallSpeed)
          const s = Math.hypot(vx, vy) || 1
          vx = (vx / s) * keep
          vy = (vy / s) * keep
        } else {
          y = aiY + paddleH
          const bounced = paddleFaceBounce(
            ballCxNow,
            aiLeft,
            paddleW,
            speedBefore,
            1.09,
            1,
            minBallSpeed
          )
          vx = bounced.vx
          vy = bounced.vy
          if (!opponentHitLockRef.current) {
            opponentHitLockRef.current = true
            setOpponentScore((s) => {
              const next = s + 1
              opponentScoreRef.current = next
              return next
            })
          }
        }
      } else if (vy > 0 || y > aiY + paddleH + 4) {
        opponentHitLockRef.current = false
      }

      // Player paddle
      if (
        vy > 0 &&
        y + ballSize >= playerY &&
        y <= playerY + paddleH &&
        x + ballSize >= playerLeft &&
        x <= playerLeft + paddleW
      ) {
        const speedBefore = Math.hypot(vx, vy)
        const centerOnFace = ballCxNow >= playerLeft && ballCxNow <= playerLeft + paddleW
        if (!centerOnFace) {
          if (ballCxNow < playerLeft + paddleW / 2) {
            x = playerLeft - ballSize
            vx = -Math.abs(vx || speedBefore * 0.5)
          } else {
            x = playerLeft + paddleW
            vx = Math.abs(vx || speedBefore * 0.5)
          }
          const keep = Math.max(speedBefore, minBallSpeed)
          const s = Math.hypot(vx, vy) || 1
          vx = (vx / s) * keep
          vy = (vy / s) * keep
        } else {
          y = playerY - ballSize
          const bounced = paddleFaceBounce(
            ballCxNow,
            playerLeft,
            paddleW,
            speedBefore,
            1.01,
            -1,
            minBallSpeed
          )
          vx = bounced.vx
          vy = bounced.vy
          if (!playerHitLockRef.current) {
            playerHitLockRef.current = true
            setPlayerScore((s) => {
              const next = s + 1
              playerScoreRef.current = next
              return next
            })
          }
        }
      } else if (vy < 0 || y + ballSize < playerY - 4) {
        playerHitLockRef.current = false
      }

      const maxSpeed = Math.max(520, m.playH * 1.45)
      const speed = Math.hypot(vx, vy)
      if (speed > maxSpeed) {
        const s = maxSpeed / speed
        vx *= s
        vy *= s
      }

      // Opponent missed — re-serve from opponent side toward the player
      if (!scoreLockRef.current && y < playTop) {
        scoreLockRef.current = true
        y = playTop
        ballRef.current = { x, y, vx, vy }
        setFrame({
          playerX: playerXRef.current,
          aiX: aiXRef.current,
          ballX: x,
          ballY: y,
        })
        resetBall(true)
        return
      }

      // Player missed — show score popup
      if (!scoreLockRef.current && y + ballSize > playBottom) {
        scoreLockRef.current = true
        y = playBottom - ballSize
        ballRef.current = { x, y, vx: 0, vy: 0 }
        setMissScore(playerScoreRef.current)
        setMissVisible(true)
        missVisibleRef.current = true
        setFrame({
          playerX: playerXRef.current,
          aiX: aiXRef.current,
          ballX: x,
          ballY: y,
        })
        return
      }

      x = clamp(x, playLeft, playRight - ballSize)
      y = clamp(y, playTop, playBottom - ballSize)

      ballRef.current = { x, y, vx, vy }
      setFrame({
        playerX: playerXRef.current,
        aiX: aiXRef.current,
        ballX: x,
        ballY: y,
      })
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      lastTsRef.current = null
    }
  }, [resetBall])

  const courtWidth = layoutW > 0 ? Math.min(layoutW, 340) : undefined

  return (
    <View style={styles.root} onLayout={(e) => setLayoutW(e.nativeEvent.layout.width)}>
      <View
        style={[
          styles.scoreRow,
          courtWidth != null ? { width: courtWidth } : null,
        ]}
      >
        <ScorePill
          variant="xevo"
          value={opponentScore}
          fontFamily={theme.semiBoldFont}
        />
        <ScorePill
          variant="you"
          value={playerScore}
          fontFamily={theme.semiBoldFont}
        />
      </View>

      <View
        style={[
          styles.courtOuter,
          courtWidth != null ? { width: courtWidth } : null,
        ]}
      >
        <View style={styles.court} onLayout={onCourtLayout} {...panResponder.panHandlers}>
          <Image source={COURT_IMG} style={styles.courtImage} resizeMode="stretch" />
          {metrics ? (
            <>
              <Image
                source={PADDLE_IMG}
                style={{
                  position: 'absolute',
                  left: frame.aiX,
                  top: metrics.aiY,
                  width: metrics.paddleW,
                  height: metrics.paddleH,
                }}
                resizeMode="stretch"
              />
              <Image
                source={PADDLE_IMG}
                style={{
                  position: 'absolute',
                  left: frame.playerX,
                  top: metrics.playerY,
                  width: metrics.paddleW,
                  height: metrics.paddleH,
                }}
                resizeMode="stretch"
              />
              <Image
                source={BALL_IMG}
                style={{
                  position: 'absolute',
                  left: frame.ballX,
                  top: frame.ballY,
                  width: metrics.ballSize,
                  height: metrics.ballSize,
                }}
                resizeMode="stretch"
              />
            </>
          ) : null}
        </View>
      </View>

      <Modal visible={missVisible} transparent animationType="fade" onRequestClose={onRetry}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onRetry} />
          <View style={[styles.cardWrap, { width: cardWidth }]} pointerEvents="box-none">
            <ProLibraryGradientFrame
              borderRadius={FRAME_OUTER_RADIUS}
              innerBorderRadius={innerRadius}
              strokeWidth={FRAME_STROKE}
              innerShadow={false}
              innerStyle={{ backgroundColor: MODAL_FILL }}
            >
              <View style={styles.modalContent}>
                <Text allowFontScaling={false} style={styles.modalTitle}>
                  Score
                </Text>
                <Text allowFontScaling={false} style={styles.modalScore}>
                  {formatScore(missScore)}
                </Text>
                <TouchableOpacity
                  style={styles.retryOuter}
                  onPress={onRetry}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Retry"
                >
                  <LinearGradient
                    colors={['#00BBFF', '#0022FF']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.retryGradient}
                  >
                    <Text allowFontScaling={false} style={styles.retryText}>
                      Retry
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ProLibraryGradientFrame>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function getStyles(theme: {
  backgroundColor?: string
  semiBoldFont?: string
  regularFont?: string
  mediumFont?: string
}) {
  return StyleSheet.create({
    root: {
      flex: 1,
      width: '100%',
      backgroundColor: theme.backgroundColor ?? '#030A17',
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingHorizontal: 0,
      paddingTop: 22,
      paddingBottom: 16,
    },
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      alignSelf: 'center',
      marginBottom: 14,
    },
    courtOuter: {
      alignSelf: 'center',
      maxWidth: '100%',
    },
    court: {
      width: '100%',
      aspectRatio: COURT_ASPECT,
      overflow: 'hidden',
    },
    courtImage: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 8, 20, 0.78)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    cardWrap: {
      maxWidth: '100%',
    },
    modalContent: {
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 24,
      alignItems: 'center',
    },
    modalTitle: {
      color: '#FFFFFF',
      fontFamily: theme.semiBoldFont ?? 'System',
      fontSize: 18,
      lineHeight: 22,
      textAlign: 'center',
    },
    modalScore: {
      marginTop: 12,
      color: '#00BBFF',
      fontFamily: theme.semiBoldFont ?? 'System',
      fontSize: 48,
      lineHeight: 56,
      letterSpacing: 2,
      textAlign: 'center',
    },
    retryOuter: {
      marginTop: 24,
      width: '100%',
      borderRadius: 16,
      overflow: 'hidden',
    },
    retryGradient: {
      minHeight: 54,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    retryText: {
      color: '#FFFFFF',
      fontFamily: theme.semiBoldFont ?? 'System',
      fontSize: 16,
    },
  })
}
