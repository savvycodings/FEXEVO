import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Share } from "react-native";
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
import { ProfileHeroScoreBlock } from "../components/ProfileHeroScoreBlock";
import { ProLibraryGradientFrame } from "../components/ProLibraryGradientFrame";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Trans, useTranslation } from "react-i18next";
import { trainCategoryLabel } from "../i18n/taxonomyLabels";

const AI_INSIGHT_LOGO = require("../../assets/youpage/aiinsight.png");
const YOU_SHARE_ICON = require("../../assets/youpage/shareicon.svg");
const AI_INSIGHT_PATTERN = require("../../assets/dailyquests/Pattern.png");
const AI_INSIGHT_PATTERN_TILE_SCALE = 3.5;
const AI_INSIGHT_CARD_BG = "#050A18";

function ProfileAiInsightBanner({
  insight,
  onDismiss,
}: {
  insight: WeeklyInsight;
  onDismiss: () => void;
}) {
  const { theme } = useContext(ThemeContext);
  const { t } = useTranslation();
  const pillar = trainCategoryLabel(insight.pillarId);
  const highlightWrap = <Text style={aiInsightStyles.aiInsightHighlight} />;
  const insightKey = !insight.hasPriorWeek
    ? "you.insightGained"
    : insight.improved
      ? "you.insightImproved"
      : "you.insightShifted";

  return (
    <ProLibraryGradientFrame
      style={aiInsightStyles.aiInsightCardOuter}
      innerStyle={aiInsightStyles.aiInsightCardInnerShell}
      borderRadius={20}
      innerBorderRadius={18}
      strokeWidth={2}
      gradientVariant="default"
      innerShadow={false}
    >
      <View style={aiInsightStyles.aiInsightCardFill}>
        <Image
          source={AI_INSIGHT_PATTERN}
          style={aiInsightStyles.aiInsightPatternFill}
          resizeMode="repeat"
          pointerEvents="none"
          accessibilityIgnoresInvertColors
        />
        <LinearGradient
          colors={["rgba(4, 22, 65, 0.55)", "rgba(0, 75, 255, 0.3)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={aiInsightStyles.aiInsightHeadBg}
        >
          <View style={aiInsightStyles.aiInsightHead}>
            <View style={aiInsightStyles.aiInsightHeadLeft}>
              <Image source={AI_INSIGHT_LOGO} style={aiInsightStyles.aiInsightLogo} resizeMode="contain" />
              <Text allowFontScaling={false} style={[aiInsightStyles.aiInsightTitle, { fontFamily: theme.semiBoldFont }]}>
                {t("you.aiInsightTitle")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onDismiss}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={t("common.dismiss")}
            >
              <Ionicons name="close" size={18} color="#004BFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
        <View style={aiInsightStyles.aiInsightBodyWrap}>
          <Text allowFontScaling={false} style={[aiInsightStyles.aiInsightBody, { fontFamily: theme.semiBoldFont }]}>
            <Trans
              i18nKey={insightKey}
              values={{ pillar, highlight: insight.highlight }}
              components={{ highlight: highlightWrap }}
            />
          </Text>
          {insight.subtitlePillarId ? (
            <Text allowFontScaling={false} style={[aiInsightStyles.aiInsightSub, { fontFamily: theme.regularFont }]}>
              {t("you.insightLowestPillar", {
                pillar: trainCategoryLabel(insight.subtitlePillarId),
              })}
            </Text>
          ) : null}
        </View>
      </View>
    </ProLibraryGradientFrame>
  );
}

export function Profile(props?: { onProfileUpdated?: () => void; onDone?: () => void }) {
  const { ratingCategories, ratingLoading, profileName, overallPillarScore } = useSessionData();
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

  // Only surface the banner once there are 2 weeks of records (a prior-week
  // baseline exists) so it can show an actual week-over-week change.
  const showAiInsight =
    dismissLoaded &&
    !ratingLoading &&
    insight != null &&
    insight.hasPriorWeek &&
    Date.now() >= dismissedUntilMs;

  const onDismissInsight = useCallback(async () => {
    const until = await dismissAiInsightForOneWeek();
    setDismissedUntilMs(until);
  }, []);

  const onShareProfile = useCallback(async () => {
    try {
      const name = profileName?.trim() || "Player";
      const score = overallPillarScore != null ? String(overallPillarScore) : "—";
      await Share.share({
        message: `${name} · Score ${score} on Xevo`,
      });
    } catch {
      /* dismissed */
    }
  }, [profileName, overallPillarScore]);

  return (
    <ActivitiesCalendarFlow
      monthNavStyle="pill"
      showHeroRow={false}
      aboveActivitiesTitle={
        <>
          <ProfileHeroScoreBlock
            premiumLabelNudgeUp={4}
            marginTop={22}
            youPageLayout
            onSharePress={() => void onShareProfile()}
            shareIconModule={YOU_SHARE_ICON}
            shareIconSize={28}
            shareAccessibilityLabel="Share profile"
          />
          <ProfileRatingDashboard />
          {showAiInsight && insight ? (
            <ProfileAiInsightBanner insight={insight} onDismiss={onDismissInsight} />
          ) : null}
        </>
      }
    />
  );
}

const aiInsightStyles = StyleSheet.create({
    aiInsightCardOuter: {
      marginTop: 16,
      marginBottom: 12,
      width: "100%",
    },
    aiInsightCardInnerShell: {
      padding: 0,
      backgroundColor: AI_INSIGHT_CARD_BG,
      overflow: "hidden",
    },
    aiInsightCardFill: {
      overflow: "hidden",
      backgroundColor: AI_INSIGHT_CARD_BG,
      width: "100%",
      position: "relative",
    },
    aiInsightPatternFill: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      opacity: 0.7,
      transform: [{ scale: AI_INSIGHT_PATTERN_TILE_SCALE }],
      transformOrigin: "top left",
    },
    aiInsightHeadBg: {
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    aiInsightHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    aiInsightHeadLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    aiInsightLogo: {
      width: 20,
      height: 20,
    },
    aiInsightTitle: {
      fontSize: 12,
      color: "#004BFF",
      letterSpacing: 0.8,
      lineHeight: 15,
    },
    aiInsightBodyWrap: {
      backgroundColor: "rgba(4, 22, 65, 0.45)",
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 16,
      width: "100%",
    },
    aiInsightBody: {
      fontSize: 13,
      color: "#FFFFFF",
      lineHeight: 20,
    },
    aiInsightHighlight: {
      fontSize: 13,
      color: "#00BBFF",
      lineHeight: 20,
    },
    aiInsightSub: {
      fontSize: 13,
      lineHeight: 20,
      color: "rgba(134, 167, 210, 0.9)",
      marginTop: 8,
    },
});
