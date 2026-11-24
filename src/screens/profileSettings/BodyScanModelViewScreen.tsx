import React, { useContext, useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "../../context";
import { SegmentedPills } from "../progress/SegmentedPills";
import {
  BodyScanMeasurementsResults,
  type ScanResultsProfile,
} from "./BodyScanMeasurementsResults";
import { ProfileHubTitleBar } from "./ProfileHubParts";

const MODEL_FRONT = require("../../../assets/bodyscan/model-front.png");
const MODEL_SIDE = require("../../../assets/bodyscan/model-side-a.png");
const MODEL_SIDE_2 = require("../../../assets/bodyscan/model-side-b.png");
const ICON_FRONT = require("../../../assets/bodyscan/model-icon-front.png");
const ICON_SIDE = require("../../../assets/bodyscan/model-icon-side.png");
const ICON_360 = require("../../../assets/bodyscan/model-icon-360.png");

type HubTab = "model" | "measurements";
type Angle = "front" | "side" | "back" | "orbit";

const ANGLE_BTNS: {
  key: Angle;
  icon: ImageSourcePropType;
  mirror?: boolean;
  labelKey: "scanModelViewAngleFront" | "scanModelViewAngleSide" | "scanModelViewAngleBack" | "scanModelViewAngle360";
}[] = [
  { key: "front", icon: ICON_FRONT, labelKey: "scanModelViewAngleFront" },
  { key: "side", icon: ICON_SIDE, labelKey: "scanModelViewAngleSide" },
  { key: "back", icon: ICON_SIDE, mirror: true, labelKey: "scanModelViewAngleBack" },
  { key: "orbit", icon: ICON_360, labelKey: "scanModelViewAngle360" },
];

/** Bottom strip: front → side → front → side-2 (matches Figma order). */
const THUMBS: { key: Angle; body: ImageSourcePropType }[] = [
  { key: "front", body: MODEL_FRONT },
  { key: "side", body: MODEL_SIDE },
  { key: "back", body: MODEL_FRONT },
  { key: "orbit", body: MODEL_SIDE_2 },
];

const BODY_FOR_ANGLE: Record<Angle, ImageSourcePropType> = {
  front: MODEL_FRONT,
  side: MODEL_SIDE,
  back: MODEL_FRONT,
  orbit: MODEL_SIDE_2,
};

/** Native front hero — keep full figure visible (no crop). */
const FRONT_NATIVE_W = 280;
const FRONT_NATIVE_H = 473;

const ANGLE_TILE_W = 65;
const ANGLE_TILE_H = 66;
const THUMB_W = 88.75;
const THUMB_H = 90;

/** Top-aligned cover for thumbs only — head stays; bottom may clip. */
function TopCropImage({
  source,
  width,
  height,
  srcAspect = FRONT_NATIVE_W / FRONT_NATIVE_H,
}: {
  source: ImageSourcePropType;
  width: number;
  height: number;
  srcAspect?: number;
}) {
  const imgH = Math.max(height, Math.round(width / srcAspect));
  return (
    <View style={{ width, height, overflow: "hidden" }}>
      <Image source={source} style={{ width, height: imgH }} resizeMode="cover" />
    </View>
  );
}

/** Static 3D Model View — viewer chrome before real mesh interaction. */
export function BodyScanModelViewScreen({
  onBack,
  profile,
  onFinish,
}: {
  onBack: () => void;
  profile: ScanResultsProfile;
  onFinish: () => void;
}) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const windowDims = useWindowDimensions();
  const [hub, setHub] = useState<HubTab>("model");
  const [angle, setAngle] = useState<Angle>("front");

  const contentW = Math.min(370, Math.max(1, windowDims.width - 40));
  const railW = ANGLE_TILE_W;
  const stageGap = 12;
  const stageW = Math.max(160, contentW - railW - stageGap);
  // Full front art aspect so feet + grid stay visible; fade handles the soft exit.
  const stageH = Math.round((stageW * FRONT_NATIVE_H) / FRONT_NATIVE_W);
  const activeBody = BODY_FOR_ANGLE[angle];
  const stageContain = angle === "side" || angle === "orbit";

  if (hub === "measurements") {
    return (
      <BodyScanMeasurementsResults
        profile={profile}
        onBack={() => setHub("model")}
        onFinish={onFinish}
      />
    );
  }

  return (
    <View style={st.screen} testID="scan-model-view-screen">
      <ProfileHubTitleBar title={t("profileHub.scanModelViewTitle")} onBack={onBack} />

      <SegmentedPills<HubTab>
        variant="flat"
        options={[
          { key: "model", label: t("profileHub.scanModelViewTabModel"), testID: "scan-model-tab-model" },
          {
            key: "measurements",
            label: t("profileHub.scanModelViewTabMeasurements"),
            testID: "scan-model-tab-measurements",
          },
        ]}
        value={hub}
        onChange={setHub}
        fontFamily={theme.mediumFont}
        activeFontFamily={theme.semiBoldFont}
        style={st.segment}
      />

      <View style={[st.viewerRow, { width: contentW }]} testID="scan-model-stage">
        <View style={[st.stage, { width: stageW, height: stageH }]}>
          <Image
            source={activeBody}
            style={{ width: stageW, height: stageH }}
            resizeMode={stageContain ? "contain" : "cover"}
          />
          <LinearGradient
            colors={["rgba(3,10,23,0)", "rgba(3,10,23,0.45)", "#030A17"]}
            locations={[0.62, 0.82, 1]}
            style={st.stageFade}
            pointerEvents="none"
          />
        </View>

        <View style={st.angleRail} testID="scan-model-angle-rail">
          {ANGLE_BTNS.map((a) => {
            const active = a.key === angle;
            return (
              <TouchableOpacity
                key={a.key}
                activeOpacity={0.85}
                onPress={() => setAngle(a.key)}
                style={[st.angleBtn, active && st.angleBtnActive]}
                testID={`scan-model-angle-${a.key}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Image
                  source={a.icon}
                  style={[st.angleIcon, a.mirror ? { transform: [{ scaleX: -1 }] } : null]}
                  resizeMode="contain"
                />
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[st.angleLabel, active && st.angleLabelActive, { fontFamily: theme.mediumFont }]}
                >
                  {t(`profileHub.${a.labelKey}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[st.hintTile, { width: contentW }]} testID="scan-model-hint">
        <Text allowFontScaling={false} style={[st.hintText, { fontFamily: theme.mediumFont }]}>
          {t("profileHub.scanModelViewHint")}
        </Text>
      </View>

      <View style={[st.thumbs, { width: contentW }]} testID="scan-model-thumbs">
        {THUMBS.map((thumb) => {
          const active = thumb.key === angle;
          return (
            <TouchableOpacity
              key={`thumb-${thumb.key}`}
              activeOpacity={0.85}
              onPress={() => setAngle(thumb.key)}
              style={[st.thumb, active && st.thumbActive]}
              testID={`scan-model-thumb-${thumb.key}`}
            >
              <TopCropImage
                source={thumb.body}
                width={THUMB_W - 4}
                height={THUMB_H - 4}
                srcAspect={thumb.key === "side" || thumb.key === "orbit" ? 1 : FRONT_NATIVE_W / FRONT_NATIVE_H}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { width: "100%" },
  segment: { marginTop: 4, marginBottom: 12 },
  viewerRow: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  // No border / card chrome — full model + soft bottom fade like the Figma ref.
  stage: {
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  stageFade: {
    ...StyleSheet.absoluteFillObject,
  },
  angleRail: {
    width: ANGLE_TILE_W,
    gap: 5,
    alignItems: "center",
  },
  // Icon + label stacked inside the tile (tight gap).
  angleBtn: {
    width: ANGLE_TILE_W,
    height: ANGLE_TILE_H,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#0048FF",
    backgroundColor: "#0048FF26",
    paddingHorizontal: 6,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  angleBtnActive: {
    borderColor: "#00B8FF",
    backgroundColor: "rgba(0, 184, 255, 0.2)",
  },
  angleIcon: { width: 22, height: 22 },
  angleLabel: { fontSize: 10, color: "#A9C1F5", textAlign: "center", lineHeight: 12 },
  angleLabelActive: { color: "#FFFFFF" },
  // Same inset glow language as hub / capture tip tiles.
  hintTile: {
    alignSelf: "center",
    marginTop: 10,
    minHeight: 44,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#07256D",
    backgroundColor: "#030A17",
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 0px 30px 0px #0048FF80 inset",
  },
  hintText: { fontSize: 13, color: "#FFFFFF", textAlign: "center" },
  thumbs: {
    alignSelf: "center",
    marginTop: 14,
    flexDirection: "row",
    gap: 5,
    justifyContent: "space-between",
  },
  thumb: {
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#0048FF",
    backgroundColor: "#0048FF26",
    padding: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  thumbActive: {
    borderColor: "#00B8FF",
  },
});
