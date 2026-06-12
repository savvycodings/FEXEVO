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
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Trans, useTranslation } from "react-i18next";
import { trainCategoryLabel } from "../i18n/taxonomyLabels";

const AI_INSIGHT_LOGO = require("../../assets/youpage/aiinsight.png");
const YOU_SHARE_ICON = require("../../assets/youpage/shareicon.svg");

function ProfileAiInsightBanner({
  styles,
  insight,
  onDismiss,
}: {
  styles: ReturnType<typeof getAiInsightStyles>;
  insight: WeeklyInsight;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const pillar = trainCategoryLabel(insight.pillarId);
  const highlightWrap = <Text style={styles.aiInsightHighlight} />;
  const insightKey = !insight.hasPriorWeek
    ? "you.insightGained"
    : insight.improved
      ? "you.insightImproved"
      : "you.insightShifted";

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
              {t("you.aiInsightTitle")}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onDismiss}
            hitSlop={12}
            style={styles.aiInsightCloseHit}
            accessibilityLabel={t("common.dismiss")}
          >
            <Ionicons name="close" size={22} color="#006FFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.aiInsightDivider} />
        <Text allowFontScaling={false} style={styles.aiInsightBody}>
          <Trans
            i18nKey={insightKey}
            values={{ pillar, highlight: insight.highlight }}
            components={{ highlight: highlightWrap }}
          />
        </Text>
        {insight.subtitlePillarId ? (
          <>
            <View style={styles.aiInsightDivider} />
            <Text allowFontScaling={false} style={styles.aiInsightSub}>
              {t("you.insightLowestPillar", {
                pillar: trainCategoryLabel(insight.subtitlePillarId),
              })}
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

  const showAiInsight =
    dismissLoaded &&
    !ratingLoading &&
    insight != null &&
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
            <ProfileAiInsightBanner styles={styles} insight={insight} onDismiss={onDismissInsight} />
          ) : null}
        </>
      }
    />
  );
}

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
