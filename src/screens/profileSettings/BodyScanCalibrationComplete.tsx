import React, { useContext } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "../../context";
import { GlowButton, UI } from "../../components/ui";
import { glow } from "../progress/progressTheme";
import { ProfileHubTitleBar } from "./ProfileHubParts";

const CHECK = require("../../../assets/bodyscan/calibration-complete-check.png");

/** Post-scan success — Profile uses accent CTA; Elite uses navy + cyan label. */
export function BodyScanCalibrationComplete({
  onBack,
  onGoProfile,
  onViewElite,
}: {
  onBack: () => void;
  onGoProfile: () => void;
  onViewElite: () => void;
}) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const S = 240;

  return (
    <View style={st.screen} testID="scan-calibration-complete">
      <ProfileHubTitleBar title={t("profileHub.scanCompleteTitle")} onBack={onBack} />

      <View style={{ alignItems: "center", width: "100%" }}>
        <View style={[{ width: S, height: S, marginTop: 8 }, glow(30, 0.55)]}>
          <Image source={CHECK} style={{ width: S, height: S }} resizeMode="contain" />
        </View>
        <Text allowFontScaling={false} style={[st.title, { fontFamily: theme.mediumFont }]}>
          {t("profileHub.scanCompleteHeading")}
        </Text>
        <Text allowFontScaling={false} style={[st.body, { fontFamily: theme.regularFont }]}>
          {t("profileHub.scanCompleteBody")}
        </Text>

        <GlowButton
          label={t("profileHub.scanCompleteGoProfile")}
          onPress={onGoProfile}
          variant="accent"
          testID="scan-complete-profile"
          style={{ alignSelf: "stretch", marginTop: 28 }}
        />
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onViewElite}
          style={st.eliteBtn}
          accessibilityRole="button"
          testID="scan-complete-elite"
        >
          <Text allowFontScaling={false} style={[st.eliteLabel, { fontFamily: theme.mediumFont }]}>
            {t("profileHub.scanCompleteViewElite")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { width: "100%" },
  title: { fontSize: 20, color: "#FFFFFF", marginTop: 32, textAlign: "center" },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: "#8D9BC9",
    marginTop: 14,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  eliteBtn: {
    alignSelf: "stretch",
    height: UI.buttonHeight,
    borderRadius: UI.btnRadius,
    backgroundColor: "#001950",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  eliteLabel: { fontSize: 17, color: "#00B8FF" },
});
