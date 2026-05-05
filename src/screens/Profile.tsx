import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ThemeContext } from "../context";
import { useSessionData } from "../context/SessionDataContext";
import {
  computeWeeklyInsightFromRatingRows,
  dismissAiInsightForOneWeek,
  loadAiInsightDismissedUntilMs,
  type WeeklyInsight,
} from "../lib/weeklyAiInsight";
import { ActivitiesCalendarFlow } from "./Activities";
import { ProfileRatingDashboard } from "../components/ProfileRatingDashboard";
import { ShieldProportionalFrame } from "../components/ShieldProportionalFrame";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";

const AI_INSIGHT_LOGO = require("../../assets/youpage/aiinsight.png");
const SCORE_BG = require("../../assets/aicoach/scorepng.png");
const SMALL_SHIELD_CAP_REF_WIN_W = 430;

function ProfileHeroScoreBlock() {
  const { theme } = useContext(ThemeContext);
  const { width: winW } = useWindowDimensions();
  const { profileName, profileImageUri, overallPillarScore } = useSessionData();

  const heroH = useMemo(() => Math.min(220, Math.max(160, winW * 0.42)), [winW]);
  const shieldMaxW = useMemo(() => {
    const heroRowInnerW = winW - 40;
    const approxColW = (heroRowInnerW - 10) / 2;
    const current = Math.min(approxColW, winW * 0.44);
    const refHeroRowInnerW = SMALL_SHIELD_CAP_REF_WIN_W - 40;
    const refApproxColW = (refHeroRowInnerW - 10) / 2;
    const reference = Math.min(refApproxColW, SMALL_SHIELD_CAP_REF_WIN_W * 0.44);
    return Math.min(current, reference);
  }, [winW]);
  const heroLayout = useMemo(
    () => ({
      shieldCol: { flex: 1, alignItems: "center" as const, maxWidth: winW * 0.44 },
      scoreCol: { flex: 1, alignItems: "center" as const, maxWidth: winW * 0.5 },
    }),
    [winW]
  );

  return (
    <View style={heroStyles.block}>
      <View style={heroStyles.heroRow}>
        <View style={heroLayout.shieldCol}>
          <View style={[heroStyles.shieldSlot, { height: heroH }]}>
            <ShieldProportionalFrame
              maxWidth={shieldMaxW}
              maxHeight={heroH}
              variant="small"
              coachName={profileName?.trim() ?? ""}
              coachImageUri={profileImageUri}
              showName={false}
              showScore={false}
              showCrest={false}
              showFlag
              showPillarScores
            />
          </View>
        </View>
        <View style={heroLayout.scoreCol}>
          <View style={{ width: "100%", aspectRatio: 1, alignItems: "center", justifyContent: "center" }}>
            <Image source={SCORE_BG} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} resizeMode="contain" />
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", transform: [{ translateX: -5 }] }}>
              <View style={{ alignItems: "center", marginTop: 10 }}>
                <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: theme.semiBoldFont, fontSize: 13, color: "#FFFFFF", marginBottom: 1 }}>
                  {profileName ?? ""}
                </Text>
                <Text allowFontScaling={false} style={{ fontFamily: theme.mediumFont, fontSize: 10, color: "#00BBFF", letterSpacing: 0.5 }}>
                  Premium
                </Text>
              </View>
              <View style={{ position: "absolute", top: "50%", alignItems: "center", transform: [{ translateY: -27 }] }}>
                <Text allowFontScaling={false} style={{ fontFamily: theme.boldFont ?? theme.semiBoldFont, fontSize: 36, color: "#FFFFFF", lineHeight: 40 }}>
                  {overallPillarScore != null ? overallPillarScore : 54}
                </Text>
                <Text allowFontScaling={false} style={{ fontFamily: theme.regularFont, fontSize: 11, color: "rgba(200,220,255,0.7)", marginTop: -1 }}>
                  Score
                </Text>
              </View>
              <View style={{ position: "absolute", bottom: 12, flexDirection: "row", gap: 20 }}>
                <View style={{ alignItems: "center" }}>
                  <Text allowFontScaling={false} style={{ fontFamily: theme.semiBoldFont, fontSize: 15, color: "#FFFFFF", lineHeight: 18 }}>0</Text>
                  <Text allowFontScaling={false} style={{ fontFamily: theme.regularFont, fontSize: 9, color: "rgba(200,220,255,0.6)", marginTop: 1 }}>Following</Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  <Text allowFontScaling={false} style={{ fontFamily: theme.semiBoldFont, fontSize: 15, color: "#FFFFFF", lineHeight: 18 }}>0</Text>
                  <Text allowFontScaling={false} style={{ fontFamily: theme.regularFont, fontSize: 9, color: "rgba(200,220,255,0.6)", marginTop: 1 }}>Followers</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function ProfileAiInsightBanner({
  styles,
  insight,
  onDismiss,
}: {
  styles: ReturnType<typeof getAiInsightStyles>;
  insight: WeeklyInsight;
  onDismiss: () => void;
}) {
  const body = !insight.hasPriorWeek ? (
    <>
      Your {insight.pillarLabel.toLowerCase()} gained <Text style={styles.aiInsightHighlight}>{insight.highlight}</Text> this week
    </>
  ) : insight.improved ? (
    <>
      Your {insight.pillarLabel.toLowerCase()} improved <Text style={styles.aiInsightHighlight}>{insight.highlight}</Text>{" "}
      this week
    </>
  ) : (
    <>
      Your {insight.pillarLabel.toLowerCase()} shifted <Text style={styles.aiInsightHighlight}>{insight.highlight}</Text> vs
      last week
    </>
  );

  return (
    <LinearGradient
      colors={["#006EFF", "rgba(0, 110, 255, 0)", "#006EFF", "rgba(0, 110, 255, 0)"]}
      locations={[0, 0.33, 0.66, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.aiInsightGradient}
    >
      <View style={styles.aiInsightInner}>
        <View style={styles.aiInsightHeaderRow}>
          <View style={styles.aiInsightTitleRow}>
            <View style={styles.aiInsightIconWrap}>
              <Image source={AI_INSIGHT_LOGO} style={styles.aiInsightLogo} resizeMode="contain" />
            </View>
            <Text allowFontScaling={false} style={styles.aiInsightTitle}>
              AI INSIGHT
            </Text>
          </View>
          <TouchableOpacity onPress={onDismiss} hitSlop={12} style={styles.aiInsightCloseHit} accessibilityLabel="Dismiss">
            <Ionicons name="close" size={22} color="#006FFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.aiInsightDivider} />
        <Text allowFontScaling={false} style={styles.aiInsightBody}>
          {body}
        </Text>
        {insight.subtitle.trim() ? (
          <>
            <View style={styles.aiInsightDivider} />
            <Text allowFontScaling={false} style={styles.aiInsightSub}>
              {insight.subtitle}
            </Text>
          </>
        ) : null}
      </View>
    </LinearGradient>
  );
}

export function Profile(props?: { onProfileUpdated?: () => void; onDone?: () => void }) {
  const { theme } = useContext(ThemeContext);
  const styles = getAiInsightStyles(theme);
  const { ratingCategories, ratingLoading } = useSessionData();
  const [dismissLoaded, setDismissLoaded] = useState(false);
  const [dismissedUntilMs, setDismissedUntilMs] = useState(0);

  useEffect(() => {
    loadAiInsightDismissedUntilMs().then((v) => {
      setDismissedUntilMs(v);
      setDismissLoaded(true);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadAiInsightDismissedUntilMs().then(setDismissedUntilMs);
    }, [])
  );

  const insight = useMemo(() => computeWeeklyInsightFromRatingRows(ratingCategories), [ratingCategories]);

  const showAiInsight =
    dismissLoaded &&
    !ratingLoading &&
    insight != null &&
    Date.now() >= dismissedUntilMs;

  const onDismissInsight = useCallback(async () => {
    const until = await dismissAiInsightForOneWeek();
    setDismissedUntilMs(until);
  }, []);

  return (
    <ActivitiesCalendarFlow
      sectionTitle="Activities"
      monthNavStyle="pill"
      dayDetailBackLabel="Back to Profile"
      showHeroRow={false}
      aboveActivitiesTitle={
        <>
          <ProfileHeroScoreBlock />
          <ProfileRatingDashboard />
          {showAiInsight && insight ? (
            <ProfileAiInsightBanner styles={styles} insight={insight} onDismiss={onDismissInsight} />
          ) : null}
        </>
      }
    />
  );
}

const heroStyles = StyleSheet.create({
  block: {
    width: "100%",
    marginBottom: 12,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 10,
  },
  shieldSlot: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
});

function getAiInsightStyles(theme: any) {
  return StyleSheet.create({
    aiInsightGradient: {
      borderRadius: 18,
      padding: 1.5,
      overflow: "hidden",
      marginBottom: 12,
      width: "100%",
    },
    aiInsightInner: {
      borderRadius: 16,
      backgroundColor: "#001435",
      paddingVertical: 10,
      paddingHorizontal: 16,
      shadowColor: "#00BBFF",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 2,
    },
    aiInsightHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    aiInsightTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
      minWidth: 0,
    },
    aiInsightIconWrap: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    aiInsightLogo: {
      width: 32,
      height: 32,
    },
    aiInsightTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      letterSpacing: 0.8,
      color: "#006FFF",
    },
    aiInsightCloseHit: {
      padding: 4,
    },
    aiInsightDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: "rgba(0, 111, 255, 0.28)",
      marginVertical: 7,
    },
    aiInsightBody: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      lineHeight: 19,
      color: "#FFFFFF",
    },
    aiInsightHighlight: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: "#00BBFF",
    },
    aiInsightSub: {
      fontFamily: theme.regularFont,
      fontSize: 12,
      lineHeight: 15,
      color: "rgba(0, 111, 255, 0.88)",
    },
  });
}
