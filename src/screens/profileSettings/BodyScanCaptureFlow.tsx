import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemeContext } from "../../context";
import { GlowButton } from "../../components/ui";
import { glow } from "../progress/progressTheme";
import { ProfileHubTitleBar } from "./ProfileHubParts";
import { BodyScanRotateRing } from "./BodyScanRotateRing";
import { BodyScanProcessingScreen } from "./BodyScanProcessingScreen";
import { BodyScanModelViewScreen } from "./BodyScanModelViewScreen";
import { BodyScanCalibrationComplete } from "./BodyScanCalibrationComplete";
import type { ScanResultsProfile } from "./BodyScanMeasurementsResults";

export type ScanCaptureStep = "front" | "right" | "back" | "left";
export type ScanCapturePhase =
  | "capture"
  | "review"
  | "rotate"
  | "processing"
  | "modelView"
  | "complete";

const STEPS: ScanCaptureStep[] = ["front", "right", "back", "left"];

const GUIDE: Record<ScanCaptureStep, ImageSourcePropType> = {
  // Same photographic athlete as the manual upper-body measurements page.
  front: require("../../../assets/calibration/upper.jpg"),
  right: require("../../../assets/bodyscan/right.png"),
  back: require("../../../assets/bodyscan/back.png"),
  left: require("../../../assets/bodyscan/left.png"),
};

const SHUTTER = require("../../../assets/bodyscan/shutter.png");
const TIP_CHECK = require("../../../assets/bodyscan/tip-check.png");
const ROTATE_HERO = require("../../../assets/bodyscan/rotate-hero-fit.png");
const CHECKLIST_TICK = require("../../../assets/bodyscan/checklist-tick.png");

/** Cropped hero art (athlete + platform + short fade), native px. */
const HERO_NATIVE_W = 360;
const HERO_NATIVE_H = 430;

type Phase = ScanCapturePhase;
type ThumbSheet = "gallery" | "actions" | "preview" | null;

function nextThumbIndex(list: (string | null)[], preferNear: number): number | null {
  for (let i = preferNear - 1; i >= 0; i--) if (list[i]) return i;
  for (let i = list.length - 1; i >= 0; i--) if (list[i]) return i;
  return null;
}

export function BodyScanCaptureFlow({
  onBack,
  onDone,
  initialPhase = "capture",
  onPhaseChange,
  profile,
  onFinishResults,
  onGoProfile,
  onViewElite,
}: {
  onBack: () => void;
  onDone: () => void;
  /** TEMP: jump straight to rotate / processing while building later steps. */
  initialPhase?: Phase;
  onPhaseChange?: (phase: Phase) => void;
  profile?: ScanResultsProfile;
  /** After Measurements Results → Finish → Calibration Complete. */
  onFinishResults?: () => void;
  onGoProfile?: () => void;
  onViewElite?: () => void;
}) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const windowDims = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [stepIndex, setStepIndex] = useState(0);
  const [uris, setUris] = useState<(string | null)[]>([null, null, null, null]);
  const [lastThumbIndex, setLastThumbIndex] = useState<number | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [busy, setBusy] = useState(false);
  const [thumbSheet, setThumbSheet] = useState<ThumbSheet>(null);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  const step = STEPS[stepIndex];
  const title =
    phase === "review"
      ? t("profileHub.scanCaptureReviewTitle")
      : t(`profileHub.scanCaptureTitle_${step}`);
  const frontTip = tipLinesAreFront(step, uris[stepIndex]);

  const tipLines = useMemo(() => {
    if (phase === "review") return [];
    if (uris[stepIndex]) return [t("profileHub.scanCaptureTipInFrame")];
    if (step === "front") {
      return [t("profileHub.scanCaptureTipFront1"), t("profileHub.scanCaptureTipFront2")];
    }
    return [t("profileHub.scanCaptureTipInFrame")];
  }, [phase, uris, stepIndex, step, t]);

  const capturedCount = useMemo(() => uris.filter(Boolean).length, [uris]);
  const thumbUri = lastThumbIndex != null ? uris[lastThumbIndex] : null;
  const selectedUri = selectedPhotoIndex != null ? uris[selectedPhotoIndex] : null;
  // Figma guide frame: 360×429, radius 20 — scale to content width, keep aspect.
  const guideW = Math.min(360, Math.max(1, windowDims.width - 40));
  const guideH = Math.round((guideW * 429) / 360);

  async function takePhoto() {
    if (busy || phase !== "capture") return;
    setBusy(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t("profileHub.scanCapturePermissionTitle"), t("profileHub.scanCapturePermissionBody"));
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const uri = result.assets[0].uri;
      const capturedAt = stepIndex;
      setUris((prev) => {
        const next = [...prev];
        next[capturedAt] = uri;
        return next;
      });
      setLastThumbIndex(capturedAt);
      if (capturedAt >= STEPS.length - 1) {
        setPhase("rotate");
      } else {
        setStepIndex(capturedAt + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  function openGallery() {
    if (capturedCount === 0) return;
    setThumbSheet("gallery");
  }

  function openPhotoActions(index: number) {
    if (!uris[index]) return;
    setSelectedPhotoIndex(index);
    setThumbSheet("actions");
  }

  function clearPhoto(idx: number, goRetake: boolean) {
    setUris((prev) => {
      const next = [...prev];
      next[idx] = null;
      const thumb = nextThumbIndex(next, idx);
      setLastThumbIndex(thumb);
      return next;
    });
    if (goRetake) {
      setStepIndex(idx);
      setPhase("capture");
    }
    setSelectedPhotoIndex(null);
    setThumbSheet(null);
  }

  const photoSheets = (
    <>
      <Modal visible={thumbSheet === "gallery"} transparent animationType="fade" onRequestClose={() => setThumbSheet(null)}>
        <Pressable style={st.sheetBackdrop} onPress={() => setThumbSheet(null)}>
          <Pressable style={st.sheetCard} onPress={(e) => e.stopPropagation()}>
            <Text allowFontScaling={false} style={[st.galleryTitle, { fontFamily: theme.semiBoldFont }]}>
              {t("profileHub.scanCaptureYourPhotos")}
            </Text>
            <View style={st.galleryRow}>
              {STEPS.map((key, i) =>
                uris[i] ? (
                  <TouchableOpacity
                    key={key}
                    style={st.galleryCell}
                    onPress={() => openPhotoActions(i)}
                    testID={`scan-gallery-${key}`}
                  >
                    <Image source={{ uri: uris[i]! }} style={st.galleryThumb} resizeMode="cover" />
                    <Text allowFontScaling={false} style={[st.galleryLabel, { fontFamily: theme.mediumFont }]}>
                      {t(`profileHub.scanCaptureTitle_${key}`)}
                    </Text>
                  </TouchableOpacity>
                ) : null
              )}
            </View>
            <TouchableOpacity style={st.sheetBtn} onPress={() => setThumbSheet(null)} testID="scan-gallery-close">
              <Text allowFontScaling={false} style={[st.sheetBtnCancel, { fontFamily: theme.mediumFont }]}>
                {t("common.cancel")}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={thumbSheet === "actions"} transparent animationType="fade" onRequestClose={() => setThumbSheet("gallery")}>
        <Pressable style={st.sheetBackdrop} onPress={() => setThumbSheet("gallery")}>
          <Pressable style={st.sheetCard} onPress={(e) => e.stopPropagation()}>
            {selectedPhotoIndex != null ? (
              <Text allowFontScaling={false} style={[st.galleryTitle, { fontFamily: theme.semiBoldFont }]}>
                {t(`profileHub.scanCaptureTitle_${STEPS[selectedPhotoIndex]}`)}
              </Text>
            ) : null}
            <TouchableOpacity
              style={st.sheetBtn}
              onPress={() => setThumbSheet("preview")}
              testID="scan-thumb-view"
            >
              <Text allowFontScaling={false} style={[st.sheetBtnText, { fontFamily: theme.mediumFont }]}>
                {t("profileHub.scanCaptureView")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={st.sheetBtn}
              onPress={() => selectedPhotoIndex != null && clearPhoto(selectedPhotoIndex, true)}
              testID="scan-thumb-retake"
            >
              <Text allowFontScaling={false} style={[st.sheetBtnText, { fontFamily: theme.mediumFont }]}>
                {t("profileHub.scanCaptureRetake")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={st.sheetBtn}
              onPress={() => selectedPhotoIndex != null && clearPhoto(selectedPhotoIndex, false)}
              testID="scan-thumb-delete"
            >
              <Text allowFontScaling={false} style={[st.sheetBtnDanger, { fontFamily: theme.mediumFont }]}>
                {t("profileHub.scanCaptureDelete")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.sheetBtn} onPress={() => setThumbSheet("gallery")} testID="scan-thumb-cancel">
              <Text allowFontScaling={false} style={[st.sheetBtnCancel, { fontFamily: theme.mediumFont }]}>
                {t("common.cancel")}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={thumbSheet === "preview"} transparent animationType="fade" onRequestClose={() => setThumbSheet("actions")}>
        <Pressable style={st.previewBackdrop} onPress={() => setThumbSheet("actions")} testID="scan-thumb-preview">
          {selectedUri ? (
            <Image source={{ uri: selectedUri }} style={st.previewImage} resizeMode="contain" />
          ) : null}
        </Pressable>
      </Modal>
    </>
  );

  if (phase === "processing") {
    return <BodyScanProcessingScreen onBack={onBack} />;
  }

  if (phase === "complete") {
    return (
      <BodyScanCalibrationComplete
        onBack={onBack}
        onGoProfile={onGoProfile ?? onDone}
        onViewElite={onViewElite ?? onDone}
      />
    );
  }

  if (phase === "modelView") {
    return (
      <BodyScanModelViewScreen
        onBack={onBack}
        profile={profile ?? {}}
        onFinish={onFinishResults ?? onDone}
      />
    );
  }

  if (phase === "rotate") {
    const ringSize = 120;
    // ~half the ring sits on the hero fade; the rest peeks below.
    const ringOverlap = Math.round(ringSize * 0.55);
    const ringPeek = ringSize - ringOverlap;
    const titleBlockH = 78;
    const checklistH = 102;
    // Prefer one-screen fit; keep full art when possible — small screens can scroll.
    const chromeH = 56 + 78 + 20 + insets.top + insets.bottom;
    const viewportH = Math.max(320, windowDims.height - chromeH);
    const maxColW = Math.min(360, Math.max(1, windowDims.width - 40));
    const budget = Math.max(220, viewportH - titleBlockH - checklistH - ringPeek);
    let heroW = maxColW;
    let heroH = Math.round((heroW * HERO_NATIVE_H) / HERO_NATIVE_W);
    if (heroH > budget) {
      heroH = Math.round(budget);
      heroW = Math.round((heroH * HERO_NATIVE_W) / HERO_NATIVE_H);
    }
    const rotateTips = [
      t("profileHub.scanRotateTipPace"),
      t("profileHub.scanRotateTipGuide"),
      t("profileHub.scanRotateTipFull"),
    ];
    return (
      <View style={st.rotateScreen} testID="scan-rotate-screen">
        <ProfileHubTitleBar
          title={t("profileHub.scanRotateTitle")}
          onBack={() => {
            setStepIndex(STEPS.length - 1);
            setPhase("capture");
          }}
        />
        <Text allowFontScaling={false} style={[st.rotateSubtitle, { fontFamily: theme.regularFont }]}>
          {t("profileHub.scanRotateSubtitle")}
        </Text>

        <View style={[st.rotateColumn, { width: heroW }]}>
          <View style={[st.rotateHeroStack, { width: heroW, height: heroH + ringPeek }]}>
            <View style={[st.rotateHero, { width: heroW, height: heroH }]} testID="scan-rotate-hero">
              <Image source={ROTATE_HERO} style={{ width: heroW, height: heroH }} resizeMode="cover" />
              <LinearGradient
                colors={["rgba(3,10,23,0)", "rgba(3,10,23,0.35)", "#030A17"]}
                locations={[0.5, 0.72, 1]}
                style={st.rotateHeroFade}
                pointerEvents="none"
              />
            </View>
            <View style={[st.rotateRingWrap, { top: heroH - ringOverlap }]}>
              <BodyScanRotateRing seconds={12} progress={0.78} size={ringSize} />
            </View>
          </View>

          <View style={st.rotateChecklist} testID="scan-rotate-checklist">
            {rotateTips.map((line) => (
              <View key={line} style={st.rotateTipRow}>
                <Image source={CHECKLIST_TICK} style={st.rotateTipTick} resizeMode="contain" />
                <Text allowFontScaling={false} style={[st.rotateTipText, { fontFamily: theme.mediumFont }]}>
                  {line}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (phase === "review") {
    return (
      <View>
        <ProfileHubTitleBar title={title} onBack={onBack} />
        <Text allowFontScaling={false} style={[st.reviewBody, { fontFamily: theme.regularFont }]}>
          {t("profileHub.scanCaptureReviewBody")}
        </Text>
        <View style={st.reviewGrid}>
          {STEPS.map((key, i) => (
            <TouchableOpacity
              key={key}
              style={st.reviewCell}
              disabled={!uris[i]}
              onPress={() => openPhotoActions(i)}
              testID={`scan-review-${key}`}
            >
              {uris[i] ? (
                <Image source={{ uri: uris[i]! }} style={st.reviewThumb} resizeMode="cover" />
              ) : (
                <View style={[st.reviewThumb, st.reviewEmpty]} />
              )}
              <Text allowFontScaling={false} style={[st.reviewLabel, { fontFamily: theme.mediumFont }]}>
                {t(`profileHub.scanCaptureTitle_${key}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <GlowButton
          label={t("profileHub.scanCaptureDone")}
          onPress={onDone}
          variant="accent"
          testID="scan-capture-done"
          style={{ alignSelf: "stretch", marginTop: 20 }}
        />
        {photoSheets}
      </View>
    );
  }

  return (
    <View>
      <ProfileHubTitleBar title={title} onBack={onBack} />

      <View style={st.rail} testID="scan-capture-rail">
        <View style={st.railLine} />
        {STEPS.map((key, i) => {
          const active = i === stepIndex;
          return (
            <View key={key} style={st.railItem}>
              <View style={[st.railDot, active ? [st.railDotActive, glow(10, 0.85)] : st.railDotIdle]}>
                <Text
                  allowFontScaling={false}
                  style={[st.railNum, active ? st.railNumActive : st.railNumIdle, { fontFamily: theme.semiBoldFont }]}
                >
                  {i + 1}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={[st.guideFrame, { width: guideW, height: guideH }]} testID={`scan-guide-${step}`}>
        <Image source={GUIDE[step]} style={st.guideImage} resizeMode="cover" />
      </View>

      <View style={st.tipBanner} testID="scan-capture-tip">
        <View style={[st.tipInner, frontTip && st.tipInnerCentered]}>
          {!frontTip ? <Image source={TIP_CHECK} style={st.tipCheck} resizeMode="contain" /> : null}
          <View style={[st.tipTextCol, frontTip && st.tipTextColCentered]}>
            {tipLines.map((line) => (
              <Text
                key={line}
                allowFontScaling={false}
                style={[st.tipText, frontTip && st.tipTextCentered, { fontFamily: theme.mediumFont }]}
              >
                {line}
              </Text>
            ))}
          </View>
        </View>
      </View>

      <View style={st.controls}>
        <TouchableOpacity
          activeOpacity={thumbUri ? 0.85 : 1}
          disabled={!thumbUri}
          onPress={openGallery}
          style={st.thumbWrap}
          testID="scan-capture-thumb"
          accessibilityRole="button"
          accessibilityLabel={t("profileHub.scanCaptureThumbActions")}
        >
          {thumbUri ? (
            <Image source={{ uri: thumbUri }} style={st.thumb} resizeMode="cover" />
          ) : (
            <View style={[st.thumb, st.thumbEmpty]} />
          )}
          {capturedCount > 1 ? (
            <View style={st.thumbBadge}>
              <Text allowFontScaling={false} style={[st.thumbBadgeText, { fontFamily: theme.semiBoldFont }]}>
                {capturedCount}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => void takePhoto()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t("profileHub.scanCaptureShutter")}
          testID="scan-capture-shutter"
          style={st.shutterHit}
        >
          <Image source={SHUTTER} style={st.shutter} resizeMode="contain" />
        </TouchableOpacity>
        <View style={st.thumbSpacer} />
      </View>

      {photoSheets}
    </View>
  );
}

function tipLinesAreFront(step: ScanCaptureStep, uri: string | null): boolean {
  return step === "front" && !uri;
}

const st = StyleSheet.create({
  rail: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 36,
    position: "relative",
    height: 26,
  },
  railLine: {
    position: "absolute",
    left: 49,
    right: 49,
    top: 12,
    height: 2,
    backgroundColor: "#07256D",
  },
  railItem: { width: 26, height: 26, alignItems: "center", justifyContent: "center", zIndex: 1 },
  railDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  // Solid #07256D fill so the rail line never shows through; cyan border + glow sit on top.
  railDotActive: {
    backgroundColor: "#07256D",
    borderWidth: 2,
    borderColor: "#00B8FF",
    shadowColor: "#00B8FF",
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  railDotIdle: {
    backgroundColor: "#07256D",
    borderWidth: 0,
  },
  railNum: { fontSize: 13 },
  railNumActive: { color: "#00B8FF" },
  railNumIdle: { color: "rgba(0, 184, 255, 0.5)" },
  guideFrame: {
    alignSelf: "center",
    marginTop: 8,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#071433",
  },
  guideImage: {
    width: "100%",
    height: "100%",
  },
  // Figma tip tile: 370×44, radius 20, pad 10, gap 10, same inset glow as hub rows.
  tipBanner: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 370,
    minHeight: 44,
    marginTop: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#07256D",
    backgroundColor: "#030A17",
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0px 0px 30px 0px #0048FF80 inset",
  },
  tipInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    maxWidth: "100%",
  },
  tipInnerCentered: { width: "100%" },
  tipCheck: { width: 22, height: 22, flexShrink: 0 },
  tipTextCol: { flexShrink: 1, gap: 2 },
  tipTextColCentered: { width: "100%", alignItems: "center" },
  tipText: { fontSize: 14, color: "#FFFFFF", textAlign: "left" },
  tipTextCentered: { textAlign: "center", width: "100%" },
  controls: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  thumbWrap: { width: 56, height: 56 },
  thumbSpacer: { width: 56, height: 56 },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#07256D",
    backgroundColor: "#071433",
  },
  thumbEmpty: { opacity: 0.55 },
  thumbBadge: {
    position: "absolute",
    right: -4,
    top: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#00B8FF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  thumbBadgeText: { fontSize: 11, color: "#06204F" },
  shutterHit: { width: 88, height: 88, alignItems: "center", justifyContent: "center" },
  shutter: { width: 88, height: 88 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
    padding: 16,
  },
  sheetCard: {
    borderRadius: 16,
    backgroundColor: "#0A1638",
    borderWidth: 1,
    borderColor: "#07256D",
    overflow: "hidden",
  },
  galleryTitle: {
    fontSize: 16,
    color: "#FFFFFF",
    textAlign: "center",
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  galleryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 8,
    justifyContent: "center",
  },
  galleryCell: { width: 96, gap: 6, alignItems: "center" },
  galleryThumb: {
    width: 96,
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#07256D",
    backgroundColor: "#071433",
  },
  galleryLabel: { fontSize: 11, color: "#A9C1F5", textAlign: "center" },
  sheetBtn: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1A2F6B",
  },
  sheetBtnText: { fontSize: 16, color: "#FFFFFF", textAlign: "center" },
  sheetBtnDanger: { fontSize: 16, color: "#FF6B5E", textAlign: "center" },
  sheetBtnCancel: { fontSize: 16, color: "#86A7D2", textAlign: "center" },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  previewImage: { width: "100%", height: "75%" },
  reviewBody: { fontSize: 14, lineHeight: 20, color: "#86A7D2", marginTop: 8, marginBottom: 16 },
  reviewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  reviewCell: { width: "47%", gap: 8 },
  reviewThumb: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#07256D",
    backgroundColor: "#071433",
  },
  reviewEmpty: { opacity: 0.4 },
  reviewLabel: { fontSize: 13, color: "#A9C1F5" },
  // Prefer one-screen fit; scroll still works on short devices. Ring overlays the hero fade.
  rotateScreen: {
    width: "100%",
  },
  rotateSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#86A7D2",
    textAlign: "center",
    marginTop: 2,
    marginBottom: 6,
  },
  rotateColumn: {
    alignSelf: "center",
  },
  rotateHeroStack: {
    position: "relative",
    alignItems: "center",
  },
  rotateHero: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    backgroundColor: "#030A17",
  },
  rotateHeroFade: {
    ...StyleSheet.absoluteFillObject,
  },
  rotateRingWrap: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 2,
  },
  rotateChecklist: {
    marginTop: 14,
    width: "100%",
    gap: 12,
    // Ticks share the hero's left edge (no extra inset).
    paddingHorizontal: 0,
  },
  rotateTipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rotateTipTick: { width: 22, height: 22 },
  rotateTipText: { flex: 1, fontSize: 15, color: "#FFFFFF" },
});
