import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Dimensions,
  PanResponder,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import Svg, { Path } from 'react-native-svg'
import { Video, ResizeMode } from 'expo-av'
import { captureRef } from 'react-native-view-shot'
import * as VideoThumbnails from 'expo-video-thumbnails'
import * as FileSystemLegacy from 'expo-file-system/legacy'

const { width: SCREEN_W } = Dimensions.get('window')
const CANVAS_W = SCREEN_W - 48
const SLIDER_H = 36

type Stroke = { d: string; color: string; width: number }

export type ReviewAnnotation = {
  imageUri: string
  comment: string
  timeMs: number
}

type Props = {
  visible: boolean
  videoUri: string | null
  durationMs: number
  onClose: () => void
  onSave: (annotation: ReviewAnnotation) => void
  theme: any
}

const COLORS = ['#DC2626', '#22C55E']
const BRUSH_SIZES = [3, 6, 10]

type PopupMode = null | 'draw' | 'comment'

export function VideoReviewModal({ visible, videoUri, durationMs, onClose, onSave, theme }: Props) {
  const insets = useSafeAreaInsets()

  const [videoAspect, setVideoAspect] = useState(1)
  const [videoReady, setVideoReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [positionMs, setPositionMs] = useState(0)
  const [totalDurMs, setTotalDurMs] = useState(durationMs)
  const videoRef = useRef<Video | null>(null)

  const [popupMode, setPopupMode] = useState<PopupMode>(null)
  const [drawVideoReady, setDrawVideoReady] = useState(false)
  const [drawVideoH, setDrawVideoH] = useState(0)
  const drawVideoRef = useRef<Video | null>(null)
  const [frameImageUri, setFrameImageUri] = useState<string | null>(null)

  const [strokes, setStrokes] = useState<Stroke[]>([])
  const strokesRef = useRef<Stroke[]>([])
  const [currentPath, setCurrentPath] = useState('')
  const [drawColor, setDrawColor] = useState('#DC2626')
  const [brushSize, setBrushSize] = useState(6)
  const [isDrawing, setIsDrawing] = useState(false)
  const pointsRef = useRef<{ x: number; y: number }[]>([])
  const drawColorRef = useRef('#DC2626')
  const brushSizeRef = useRef(6)

  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const drawAreaRef = useRef<View | null>(null)
  const [annotations, setAnnotations] = useState<ReviewAnnotation[]>([])
  const [captureTimeMs, setCaptureTimeMs] = useState(0)
  const frozenTimeRef = useRef(0)

  useEffect(() => { drawColorRef.current = drawColor }, [drawColor])
  useEffect(() => { brushSizeRef.current = brushSize }, [brushSize])

  useEffect(() => {
    if (visible) {
      setVideoReady(false)
      setIsPlaying(false)
      setPositionMs(0)
      setPopupMode(null)
      setStrokes([])
      strokesRef.current = []
      setComment('')
      setAnnotations([])
    }
  }, [visible])

  useEffect(() => {
    if (durationMs > 0) setTotalDurMs(durationMs)
  }, [durationMs])

  async function togglePlay() {
    if (!videoRef.current) return
    if (isPlaying) await videoRef.current.pauseAsync()
    else await videoRef.current.playAsync()
  }

  async function seekTo(ms: number) {
    setPositionMs(ms)
    if (videoRef.current) {
      try { await videoRef.current.setPositionAsync(ms, { toleranceMillisBefore: 50, toleranceMillisAfter: 50 }) } catch {}
    }
  }

  function handleSliderTouch(locationX: number) {
    void seekTo(Math.round(Math.max(0, Math.min(1, locationX / CANVAS_W)) * totalDurMs))
  }

  function openDraw() {
    if (videoRef.current) videoRef.current.pauseAsync().catch(() => {})
    const t = positionMs
    setCaptureTimeMs(t)
    frozenTimeRef.current = t
    strokesRef.current = []
    setStrokes([])
    setCurrentPath('')
    setComment('')
    setDrawVideoReady(false)
    setDrawVideoH(0)
    setFrameImageUri(null)
    setPopupMode('draw')
    if (videoUri) {
      VideoThumbnails.getThumbnailAsync(videoUri, { time: t })
        .then((thumb) => {
          setFrameImageUri(thumb.uri)
          if (thumb.width > 0 && thumb.height > 0) {
            setDrawVideoH(Math.round(CANVAS_W / (thumb.width / thumb.height)))
          }
          setDrawVideoReady(true)
        })
        .catch(() => {})
    }
  }

  function openComment() {
    if (videoRef.current) videoRef.current.pauseAsync().catch(() => {})
    const t = positionMs
    setCaptureTimeMs(t)
    frozenTimeRef.current = t
    setComment('')
    setDrawVideoReady(false)
    setDrawVideoH(0)
    setFrameImageUri(null)
    setPopupMode('comment')
    if (videoUri) {
      VideoThumbnails.getThumbnailAsync(videoUri, { time: t })
        .then((thumb) => {
          setFrameImageUri(thumb.uri)
          if (thumb.width > 0 && thumb.height > 0) {
            setDrawVideoH(Math.round(CANVAS_W / (thumb.width / thumb.height)))
          }
          setDrawVideoReady(true)
        })
        .catch(() => {})
    }
  }

  // Seek the draw popup's video to the frozen time once it loads
  useEffect(() => {
    if ((popupMode === 'draw' || popupMode === 'comment') && drawVideoReady && drawVideoRef.current) {
      drawVideoRef.current.setPositionAsync(frozenTimeRef.current, { toleranceMillisBefore: 0, toleranceMillisAfter: 0 }).catch(() => {})
    }
  }, [popupMode, drawVideoReady])

  // --- Drawing ---

  function pointsToD(pts: { x: number; y: number }[]): string {
    if (pts.length === 0) return ''
    let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
    for (let i = 1; i < pts.length; i++) d += ` L${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`
    return d
  }

  function commitStroke() {
    if (pointsRef.current.length > 1) {
      const newStroke: Stroke = {
        d: pointsToD(pointsRef.current),
        color: drawColorRef.current,
        width: brushSizeRef.current,
      }
      strokesRef.current = [...strokesRef.current, newStroke]
      setStrokes([...strokesRef.current])
    }
    pointsRef.current = []
    setCurrentPath('')
    setIsDrawing(false)
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => {
        setIsDrawing(true)
        const { locationX: x, locationY: y } = e.nativeEvent
        pointsRef.current = [{ x, y }]
        setCurrentPath(`M${x.toFixed(1)},${y.toFixed(1)}`)
      },
      onPanResponderMove: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent
        pointsRef.current.push({ x, y })
        setCurrentPath(pointsToD(pointsRef.current))
      },
      onPanResponderRelease: () => {
        commitStroke()
      },
      onPanResponderTerminate: () => {
        commitStroke()
      },
    }),
  ).current

  async function handleSave() {
    setSaving(true)
    try {
      let imageUri = ''
      if (drawAreaRef.current) {
        try {
          const base64 = await captureRef(drawAreaRef, {
            format: 'png',
            quality: 0.92,
            result: 'base64',
          })
          imageUri = base64 ? `data:image/png;base64,${base64}` : ''
        } catch {
          if (frameImageUri) imageUri = frameImageUri
        }
      } else if (frameImageUri) {
        imageUri = frameImageUri
      }
      if (!imageUri && videoUri) {
        try {
          const thumb = await VideoThumbnails.getThumbnailAsync(videoUri, { time: captureTimeMs })
          imageUri = thumb?.uri || ''
        } catch {
          imageUri = ''
        }
      }
      if (imageUri && !imageUri.startsWith('data:image/') && !imageUri.startsWith('http') && !imageUri.startsWith('/uploads/')) {
        try {
          const res = await fetch(imageUri)
          const blob = await res.blob()
          imageUri = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onerror = () => reject(new Error('file-reader-failed'))
            reader.onload = () => resolve(String(reader.result || ''))
            reader.readAsDataURL(blob)
          })
        } catch {
          try {
            const base64 = await FileSystemLegacy.readAsStringAsync(imageUri, { encoding: 'base64' as any })
            if (base64 && typeof base64 === 'string') {
              imageUri = `data:image/png;base64,${base64}`
            }
          } catch {
            imageUri = ''
          }
        }
      }
      if (!imageUri) {
        return
      }
      const ann: ReviewAnnotation = { imageUri, comment: comment.trim(), timeMs: captureTimeMs }
      setAnnotations((prev) => [...prev, ann])
      onSave(ann)
      setPopupMode(null)
    } catch {} finally {
      setSaving(false)
    }
  }

  function formatTime(ms: number) {
    const sec = Math.floor(ms / 1000)
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
  }

  const videoAspectClamped = Math.max(0.45, Math.min(1.9, videoAspect || 1))
  const popupVideoH = drawVideoH > 0 ? drawVideoH : Math.round(CANVAS_W / videoAspectClamped)

  if (!videoUri) return null

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={[st.root, { backgroundColor: theme.backgroundColor, paddingTop: insets.top }]}>
        <View style={st.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text allowFontScaling={false} style={[st.headerTitle, { fontFamily: theme.semiBoldFont }]}>Review Video</Text>
          <View style={{ width: 24 }} />
        </View>

        <KeyboardAwareScrollView
          style={st.scroll}
          contentContainerStyle={[st.scrollInner, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bottomOffset={insets.bottom + 20}
        >
          {/* Main video */}
          <View style={[st.videoWrap, { width: CANVAS_W, aspectRatio: videoAspectClamped }]}>
            <Video
              ref={videoRef}
              source={{ uri: videoUri }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.COVER}
              shouldPlay={false}
              isMuted={false}
              onLoad={(status) => {
                if (!status.isLoaded) return
                setVideoReady(true)
                if (typeof status.durationMillis === 'number' && status.durationMillis > 0) setTotalDurMs(status.durationMillis)
                const ns: any = (status as any).naturalSize
                if (ns?.width > 0 && ns?.height > 0) setVideoAspect(ns.width / ns.height)
              }}
              onPlaybackStatusUpdate={(status) => {
                if (!status.isLoaded) return
                setIsPlaying(!!status.isPlaying)
                setPositionMs(status.positionMillis ?? 0)
                if (typeof status.durationMillis === 'number' && status.durationMillis > 0) setTotalDurMs(status.durationMillis)
              }}
              onReadyForDisplay={(e) => {
                setVideoReady(true)
                const ns = e.naturalSize
                if (ns?.width > 0 && ns?.height > 0) setVideoAspect(ns.width / ns.height)
              }}
            />
            {!videoReady && (
              <View style={st.videoLoading}><ActivityIndicator color="#00BBFF" size="large" /></View>
            )}
          </View>

          <View style={st.controlsRow}>
            <TouchableOpacity onPress={togglePlay} style={st.playBtn} activeOpacity={0.7}>
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text allowFontScaling={false} style={[st.timeText, { fontFamily: theme.regularFont }]}>
              {formatTime(positionMs)} / {formatTime(totalDurMs)}
            </Text>
          </View>

          <View
            style={st.sliderTrack}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => handleSliderTouch(e.nativeEvent.locationX)}
            onResponderMove={(e) => handleSliderTouch(e.nativeEvent.locationX)}
          >
            <View style={[st.sliderFill, { width: `${totalDurMs > 0 ? (positionMs / totalDurMs) * 100 : 0}%` }]} />
            <View style={[st.sliderThumb, { left: totalDurMs > 0 ? (positionMs / totalDurMs) * (CANVAS_W - 14) : 0 }]} />
          </View>

          <View style={st.actionRow}>
            <TouchableOpacity style={[st.actionBtn, st.drawBtn]} onPress={openDraw} activeOpacity={0.85}>
              <Ionicons name="brush-outline" size={18} color="#FFFFFF" />
              <Text allowFontScaling={false} style={[st.actionBtnText, { fontFamily: theme.semiBoldFont }]}>Draw</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.actionBtn, st.commentBtn]} onPress={openComment} activeOpacity={0.85}>
              <Ionicons name="chatbubble-outline" size={18} color="#FFFFFF" />
              <Text allowFontScaling={false} style={[st.actionBtnText, { fontFamily: theme.semiBoldFont }]}>Comment</Text>
            </TouchableOpacity>
          </View>

          {annotations.length > 0 && (
            <View style={st.annotationsSection}>
              <Text allowFontScaling={false} style={[st.annotationsTitle, { fontFamily: theme.semiBoldFont }]}>
                Annotations ({annotations.length})
              </Text>
              {annotations.map((ann, idx) => (
                <View key={idx} style={st.annotationCard}>
                  {ann.imageUri ? <Image source={{ uri: ann.imageUri }} style={[st.annotationImage, { aspectRatio: videoAspectClamped }]} resizeMode="cover" /> : null}
                  {ann.comment ? <Text allowFontScaling={false} style={[st.annotationComment, { fontFamily: theme.regularFont }]}>{ann.comment}</Text> : null}
                  <View style={st.annotationMeta}>
                    <Text allowFontScaling={false} style={[st.annotationTime, { fontFamily: theme.regularFont }]}>Frame at {formatTime(ann.timeMs)}</Text>
                    <TouchableOpacity onPress={() => setAnnotations((p) => p.filter((_, i) => i !== idx))} hitSlop={8}>
                      <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.45)" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </KeyboardAwareScrollView>
      </View>

      {/* ========== DRAW POPUP ========== */}
      <Modal visible={popupMode === 'draw'} animationType="slide" transparent={false}>
        <View style={[st.root, { backgroundColor: theme.backgroundColor, paddingTop: insets.top }]}>
          <View style={st.header}>
            <TouchableOpacity onPress={() => setPopupMode(null)} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text allowFontScaling={false} style={[st.headerTitle, { fontFamily: theme.semiBoldFont }]}>Draw on Frame</Text>
            <View style={{ width: 24 }} />
          </View>
          <KeyboardAwareScrollView
            style={st.scroll}
            contentContainerStyle={[st.scrollInner, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!isDrawing}
            bottomOffset={insets.bottom + 20}
          >
            <View
              ref={drawAreaRef}
              collapsable={false}
              style={[st.canvasWrap, { width: CANVAS_W, height: popupVideoH, overflow: 'hidden' }]}
            >
              {frameImageUri ? (
                <Image
                  source={{ uri: frameImageUri }}
                  style={{ width: CANVAS_W, height: popupVideoH }}
                  resizeMode="cover"
                />
              ) : (
                <Video
                  ref={drawVideoRef}
                  source={{ uri: videoUri }}
                  style={{ width: CANVAS_W, height: popupVideoH }}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={false}
                  isMuted
                  positionMillis={frozenTimeRef.current}
                  onReadyForDisplay={(e) => {
                    setDrawVideoReady(true)
                    const ns = e.naturalSize
                    if (ns?.width > 0 && ns?.height > 0) {
                      setDrawVideoH(Math.round(CANVAS_W / (ns.width / ns.height)))
                    }
                  }}
                />
              )}
              <View style={[StyleSheet.absoluteFill]} {...panResponder.panHandlers}>
                <Svg width={CANVAS_W} height={popupVideoH} style={StyleSheet.absoluteFill}>
                  {strokes.map((sk, i) => (
                    <Path key={i} d={sk.d} stroke={sk.color} strokeWidth={sk.width} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  ))}
                  {currentPath ? (
                    <Path d={currentPath} stroke={drawColor} strokeWidth={brushSize} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  ) : null}
                </Svg>
              </View>
            </View>

            <View style={st.toolRow}>
              <TouchableOpacity onPress={() => { strokesRef.current = strokesRef.current.slice(0, -1); setStrokes([...strokesRef.current]) }} disabled={strokes.length === 0} style={st.toolBtn}>
                <Ionicons name="arrow-undo" size={20} color={strokes.length > 0 ? '#FFF' : 'rgba(255,255,255,0.3)'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { strokesRef.current = []; setStrokes([]) }} disabled={strokes.length === 0} style={st.toolBtn}>
                <Ionicons name="trash-outline" size={20} color={strokes.length > 0 ? '#FFF' : 'rgba(255,255,255,0.3)'} />
              </TouchableOpacity>
              <View style={st.colorRow}>
                {COLORS.map((c) => (
                  <TouchableOpacity key={c} onPress={() => setDrawColor(c)} style={[st.colorDot, { backgroundColor: c }, drawColor === c && st.colorDotActive]} />
                ))}
              </View>
              <View style={st.brushRow}>
                {BRUSH_SIZES.map((sz) => (
                  <TouchableOpacity key={sz} onPress={() => setBrushSize(sz)} style={[st.brushBtn, brushSize === sz && st.brushBtnActive]}>
                    <View style={{ width: sz * 2, height: sz * 2, borderRadius: sz, backgroundColor: drawColor }} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Add a comment (optional)…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              multiline
              style={[st.commentInput, { fontFamily: theme.regularFont }]}
            />

            <TouchableOpacity
              style={[st.saveBtn, (saving || !drawVideoReady) && st.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving || !drawVideoReady}
              activeOpacity={0.85}
            >
              {saving ? <ActivityIndicator size="small" color="#FFF" /> : (
                <Text allowFontScaling={false} style={[st.saveBtnText, { fontFamily: theme.semiBoldFont }]}>Save</Text>
              )}
            </TouchableOpacity>
          </KeyboardAwareScrollView>
        </View>
      </Modal>

      {/* ========== COMMENT POPUP ========== */}
      <Modal visible={popupMode === 'comment'} animationType="slide" transparent={false}>
        <View style={[st.root, { backgroundColor: theme.backgroundColor, paddingTop: insets.top }]}>
          <View style={st.header}>
            <TouchableOpacity onPress={() => setPopupMode(null)} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text allowFontScaling={false} style={[st.headerTitle, { fontFamily: theme.semiBoldFont }]}>Comment on Frame</Text>
            <View style={{ width: 24 }} />
          </View>
          <KeyboardAwareScrollView
            style={st.scroll}
            contentContainerStyle={[st.scrollInner, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bottomOffset={insets.bottom + 20}
          >
            <View
              collapsable={false}
              style={[st.canvasWrap, { width: CANVAS_W, height: popupVideoH, overflow: 'hidden' }]}
            >
              {frameImageUri ? (
                <Image
                  source={{ uri: frameImageUri }}
                  style={{ width: CANVAS_W, height: popupVideoH }}
                  resizeMode="cover"
                />
              ) : (
                <Video
                  source={{ uri: videoUri }}
                  style={{ width: CANVAS_W, height: popupVideoH }}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={false}
                  isMuted
                  positionMillis={frozenTimeRef.current}
                  onReadyForDisplay={(e) => {
                    const ns = e.naturalSize
                    if (ns?.width > 0 && ns?.height > 0) {
                      setDrawVideoH(Math.round(CANVAS_W / (ns.width / ns.height)))
                    }
                  }}
                />
              )}
            </View>

            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Write your comment here…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              multiline
              autoFocus
              style={[st.commentInput, st.commentInputTall, { fontFamily: theme.regularFont }]}
            />

            <TouchableOpacity
              style={[st.saveBtn, (saving || !comment.trim() || !drawVideoReady) && st.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving || !comment.trim() || !drawVideoReady}
              activeOpacity={0.85}
            >
              {saving ? <ActivityIndicator size="small" color="#FFF" /> : (
                <Text allowFontScaling={false} style={[st.saveBtnText, { fontFamily: theme.semiBoldFont }]}>Save Comment</Text>
              )}
            </TouchableOpacity>
          </KeyboardAwareScrollView>
        </View>
      </Modal>
    </Modal>
  )
}

const st = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 12 },
  headerTitle: { fontSize: 18, color: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollInner: { paddingHorizontal: 24 },
  videoWrap: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#000', marginBottom: 10 },
  videoLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  playBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  timeText: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  sliderTrack: { width: CANVAS_W, height: SLIDER_H, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6, justifyContent: 'center', marginBottom: 16, overflow: 'hidden' },
  sliderFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,102,255,0.35)', borderRadius: 6 },
  sliderThumb: { position: 'absolute', width: 14, height: SLIDER_H, backgroundColor: '#00BBFF', borderRadius: 3 },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 14 },
  drawBtn: { backgroundColor: '#0066FF' },
  commentBtn: { backgroundColor: 'rgba(0,102,255,0.25)', borderWidth: 1, borderColor: 'rgba(0,187,255,0.45)' },
  actionBtnText: { fontSize: 15, color: '#FFFFFF' },
  annotationsSection: { gap: 12, marginTop: 4 },
  annotationsTitle: { fontSize: 15, color: '#FFFFFF', marginBottom: 2 },
  annotationCard: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,102,255,0.3)', backgroundColor: 'rgba(0,20,64,0.45)', overflow: 'hidden' },
  annotationImage: { width: '100%', backgroundColor: '#000', borderRadius: 8 },
  annotationComment: { fontSize: 13, color: '#FFFFFF', paddingHorizontal: 12, paddingTop: 10 },
  annotationMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  annotationTime: { fontSize: 11, color: 'rgba(200,220,255,0.5)' },
  canvasWrap: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,102,255,0.3)', marginBottom: 12 },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  toolBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  colorRow: { flexDirection: 'row', gap: 6, marginLeft: 4 },
  colorDot: { width: 24, height: 24, borderRadius: 12 },
  colorDotActive: { borderWidth: 2.5, borderColor: '#FFFFFF' },
  brushRow: { flexDirection: 'row', gap: 6, marginLeft: 4 },
  brushBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  brushBtnActive: { borderWidth: 1.5, borderColor: '#00BBFF' },
  commentInput: { minHeight: 60, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,102,255,0.3)', backgroundColor: 'rgba(0,20,64,0.5)', color: '#FFFFFF', fontSize: 13, paddingHorizontal: 14, paddingVertical: 10, textAlignVertical: 'top', marginBottom: 14 },
  commentInputTall: { minHeight: 100 },
  saveBtn: { borderRadius: 24, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0066FF' },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { fontSize: 15, color: '#FFFFFF' },
})
