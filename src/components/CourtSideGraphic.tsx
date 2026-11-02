import React from "react";
import { Image, StyleSheet, View } from "react-native";

const COURT_IMAGE = require("../../assets/court.png");
const BALL_IMAGE = require("../../assets/ball.png");
const COURT_NATIVE_W = 262;
const COURT_NATIVE_H = 151;
const BALL_NATIVE_W = 61;
const BALL_NATIVE_H = 21;
const COURT_ASPECT = COURT_NATIVE_W / COURT_NATIVE_H;
const BALL_ASPECT = BALL_NATIVE_W / BALL_NATIVE_H;
/** Ball anchor tuned to the near court surface in court.png (percent of court box). */
const BALL_BOTTOM_PCT = `${(43 / COURT_NATIVE_H) * 100}%`;
const BALL_SIDE_PCT = `${(62 / COURT_NATIVE_W) * 100}%`;
const BALL_WIDTH_PCT = `${(BALL_NATIVE_W / COURT_NATIVE_W) * 100}%`;
const COURT_MAX_W = 296;

/** The 3D padel court with a ball marking the chosen side (onboarding and Game Settings). */
export function CourtSideGraphic({ courtSide }: { courtSide: "left" | "right" | null }) {
  return (
    <View style={courtGraphicStyles.wrap}>
      <View style={courtGraphicStyles.stage}>
        <View style={courtGraphicStyles.courtFrame}>
          <Image source={COURT_IMAGE} style={courtGraphicStyles.courtImage} resizeMode="stretch" />
          {courtSide ? (
            <Image
              source={BALL_IMAGE}
              style={[
                courtGraphicStyles.courtBall,
                courtSide === "left" ? courtGraphicStyles.courtBallLeft : courtGraphicStyles.courtBallRight,
              ]}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const courtGraphicStyles = StyleSheet.create({
  wrap: {
    marginTop: 32,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 4,
  },
  stage: {
    width: "100%",
    maxWidth: COURT_MAX_W,
    alignSelf: "center",
  },
  courtFrame: {
    width: "100%",
    aspectRatio: COURT_ASPECT,
    position: "relative",
    overflow: "hidden",
  },
  courtImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  courtBall: {
    position: "absolute",
    width: BALL_WIDTH_PCT,
    aspectRatio: BALL_ASPECT,
    bottom: BALL_BOTTOM_PCT,
  },
  courtBallLeft: {
    left: BALL_SIDE_PCT,
  },
  courtBallRight: {
    right: BALL_SIDE_PCT,
  },
});
