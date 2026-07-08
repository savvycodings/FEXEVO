import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemeContext } from "../context";
import { Header } from "../components/Header";
import { MainTabBarChrome } from "../components/MainTabBarChrome";
import { LocalSvgAsset } from "../components/LocalSvgAsset";
import { ProfileHeroScoreBlock } from "../components/ProfileHeroScoreBlock";
import { getCoachDetail, resolveCoachDetail } from "../lib/coach-detail-data";
import {
  fetchPlayerOverallScore,
  fetchPublicPlayerProfile,
} from "../lib/leaderboardPlayerApi";
import { resolveUploadUrl } from "../lib/mediaUrl";
import type { MainStackParamList } from "../navigation/types";

const UNFOLLOW_ICON = require("../../assets/youpage/unfollowicon.svg");
const BOOK_VIDEO_ICON = require("../../assets/youpage/bookvideocall.svg");
const MESSAGE_ICON = require("../../assets/mystudents/message.svg");
const PERSONAL_ICON = require("../../assets/coachs/personalicon.png");
const BD_ICON_SVG = require("../../assets/coachs/bdicon.svg");
const SHARE_ICON_SVG = require("../../assets/coachs/shareicon.svg");

const SHARE_ICON_SIZE = 28;

const COACH_GALLERY = [
  require("../../assets/coachs/img1.png"),
  require("../../assets/coachs/img2.png"),
  require("../../assets/coachs/img3.png"),
  require("../../assets/coachs/img4.png"),
  require("../../assets/coachs/img5.png"),
] as const;

const GALLERY_SIZE = 80;

type LiveCoachProfile = {
  name?: string;
  headline?: string;
  birthDisplay?: string | null;
  areaLocation?: string | null;
  imageUri?: string | null;
  score?: number | null;
};
const ACCENT = "#00B8FF";

type CoachDetailRoute = RouteProp<MainStackParamList, "CoachDetail">;
type CoachDetailNav = NativeStackNavigationProp<MainStackParamList, "CoachDetail">;

export function CoachDetailScreen() {
  const navigation = useNavigation<CoachDetailNav>();
  const route = useRoute<CoachDetailRoute>();
  const insets = useSafeAreaInsets();
  const { theme } = useContext(ThemeContext);
  const styles = useMemo(() => getStyles(theme), [theme]);

  const coachId = route.params.coachId;
  const coachName = route.params.coachName;
  const coachImageUri = route.params.coachImageUri ?? null;
  const coach = useMemo(
    () => resolveCoachDetail(coachId, coachName),
    [coachId, coachName]
  );
  /** Known sample coaches (invite flow) keep their static location; live coaches don't. */
  const isSampleCoach = useMemo(() => getCoachDetail(coachId) != null, [coachId]);
  const horizontalPad = Math.max(16, insets.left, insets.right);

  const navigateMainTab = useCallback(
    (screen: "AICoach" | "You") => {
      if (screen === "You") {
        navigation.navigate("Main", {
          screen: "You",
          params: { screen: "YouMain" },
        });
      } else {
        navigation.navigate("Main", { screen: "AICoach" });
      }
    },
    [navigation]
  );

  // Live coach profile (name, headline, birth date, location) + overall score.
  const [live, setLive] = useState<LiveCoachProfile | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [profile, overall] = await Promise.all([
        fetchPublicPlayerProfile(coachId),
        fetchPlayerOverallScore(coachId),
      ]);
      if (cancelled) return;
      if (profile) {
        setLive({
          name: profile.user.name,
          headline: profile.profile.headline,
          birthDisplay: profile.profile.birthDisplay,
          areaLocation: profile.profile.areaLocation,
          imageUri: resolveUploadUrl(profile.user.image),
          score: overall,
        });
      } else {
        setLive({ score: overall });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coachId]);

  if (!coach) {
    return (
      <View style={styles.root}>
        <Header
          flatOverlay
          onBackPress={() => navigation.goBack()}
          onProPress={() => navigation.navigate("ProSubscription")}
          onSettingsPress={() => navigation.navigate("ProfileSettings")}
          onNotificationsPress={() => navigation.navigate("Notifications")}
        />
        <View style={[styles.fallback, { paddingHorizontal: horizontalPad }]}>
          <Text style={styles.fallbackText}>Coach not found</Text>
        </View>
        <MainTabBarChrome />
      </View>
    );
  }

  const detail = coach;

  // Prefer live coach data; fall back to the sample profile for known sample coaches.
  const displayName = live?.name?.trim() || detail.displayName;
  const displayLegalName = live?.name?.trim() || detail.fullLegalName;
  const displayHeadline = live?.headline?.trim() || (isSampleCoach ? detail.headline : "");
  const displayBirth =
    live?.birthDisplay?.trim() || (isSampleCoach ? detail.birthDisplay : "");
  const displayLocation =
    live?.areaLocation?.trim() || (isSampleCoach ? detail.locationDisplay : "");
  const displayImage = coachImageUri ?? live?.imageUri ?? null;
  const displayScore = live?.score ?? null;

  async function onShare() {
    try {
      await Share.share({
        message: displayLocation ? `${displayLegalName}\n${displayLocation}` : displayLegalName,
      });
    } catch {
      /* dismissed */
    }
  }

  const onOpenMessage = useCallback(() => {
    navigation.navigate("CoachStudentChat", {
      peerUserId: coachId,
      peerName: displayName,
      peerLocation: displayLocation,
      actualScore: displayScore ?? 0,
      lastScore: 0,
      peerImageUri: displayImage,
      peerRole: "coach",
    });
  }, [navigation, coachId, displayName, displayLocation, displayScore, displayImage]);

  return (
    <View style={styles.root}>
      <Header
        flatOverlay
        headerLeftMode="search"
        onSearchPress={() => navigation.navigate("InviteSearch")}
        onProPress={() => navigation.navigate("ProSubscription")}
        onSettingsPress={() => navigation.navigate("ProfileSettings")}
        onNotificationsPress={() => navigation.navigate("Notifications")}
      />
      <ScrollView
        key={detail.id}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollInner, { paddingHorizontal: horizontalPad }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <View style={styles.topActionRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
            style={styles.backRow}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 12 }}
            accessibilityLabel="Back to coaches"
          >
            <Ionicons name="chevron-back" size={30} color="#86A7D2" />
            <Text style={styles.backLabel}>Back to Coaches</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => void onShare()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Share coach"
          >
            <LocalSvgAsset
              assetModule={SHARE_ICON_SVG}
              width={SHARE_ICON_SIZE}
              height={SHARE_ICON_SIZE}
              strokeColor="#86A7D2"
            />
          </TouchableOpacity>
        </View>

        <ProfileHeroScoreBlock
          horizontalPadding={horizontalPad}
          premiumLabelNudgeUp={4}
          marginTop={4}
          marginBottom={0}
          youPageLayout
          ratingUserId={coachId}
          playerOverride={{
            name: displayName,
            imageUri: displayImage,
            areaLocation: displayLocation || null,
            score: displayScore,
          }}
        />

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnFilled]} activeOpacity={0.85}>
            <Image source={PERSONAL_ICON} style={styles.perfilIcon} resizeMode="contain" />
            <Text style={styles.actionBtnTextFilled}>Perfil</Text>
          </TouchableOpacity>
          {!isSampleCoach ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnOutline]}
              activeOpacity={0.85}
              onPress={onOpenMessage}
            >
              <LocalSvgAsset
                assetModule={MESSAGE_ICON}
                width={16}
                height={16}
                strokeColor="#1F6CD0"
              />
              <Text style={styles.actionBtnTextOutline}>Message</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} activeOpacity={0.85}>
            <LocalSvgAsset assetModule={UNFOLLOW_ICON} width={16} height={16} />
            <Text style={styles.actionBtnTextOutline}>Unfollow</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} activeOpacity={0.85}>
            <LocalSvgAsset assetModule={BOOK_VIDEO_ICON} width={16} height={16} />
            <Text style={[styles.actionBtnTextOutline, styles.actionBtnTextNarrow]} numberOfLines={2}>
              Book Video Call
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.galleryScroll}
          nestedScrollEnabled
        >
          {COACH_GALLERY.map((src, i) => (
            <View key={i} style={styles.galleryThumb}>
              <Image
                source={src}
                style={{ width: GALLERY_SIZE, height: GALLERY_SIZE }}
                resizeMode="cover"
              />
            </View>
          ))}
        </ScrollView>

        <View style={styles.personalBlock}>
          <Text style={styles.legalName}>{displayLegalName}</Text>
          {displayHeadline ? <Text style={styles.headline}>{displayHeadline}</Text> : null}
          {displayBirth || displayLocation ? (
            <View style={styles.personalMeta}>
              <View style={styles.metaLine}>
                {displayBirth ? (
                  <>
                    <LocalSvgAsset assetModule={BD_ICON_SVG} width={18} height={18} />
                    <Text style={styles.metaText}>{displayBirth}</Text>
                  </>
                ) : null}
                {displayBirth && displayLocation ? <View style={styles.metaBetween} /> : null}
                {displayLocation ? (
                  <>
                    <Ionicons name="location-outline" size={18} color="#FFFFFF" />
                    <Text style={[styles.metaText, styles.metaTextLocation]} numberOfLines={1}>
                      {displayLocation}
                    </Text>
                  </>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
      <MainTabBarChrome />
    </View>
  );
}

function getStyles(theme: {
  backgroundColor?: string;
  mediumFont?: string;
  regularFont?: string;
  semiBoldFont?: string;
}) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.backgroundColor ?? "#030A17",
    },
    fallback: {
      justifyContent: "center",
      alignItems: "center",
    },
    fallbackText: {
      color: "#FFFFFF",
      fontFamily: theme.regularFont ?? "System",
    },
    topActionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 16,
      marginBottom: 16,
    },
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    backLabel: {
      color: "#86A7D2",
      fontFamily: theme.regularFont ?? "System",
      fontSize: 13,
      lineHeight: 18,
    },
    scroll: {
      flex: 1,
    },
    scrollInner: {
      paddingBottom: 20,
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 20,
    },
    actionBtn: {
      flex: 1,
      minWidth: 0,
      height: 38,
      borderRadius: 19,
      paddingHorizontal: 6,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    actionBtnFilled: {
      backgroundColor: "#041641",
    },
    actionBtnOutline: {
      backgroundColor: "transparent",
      borderWidth: 2,
      borderColor: "#0E2969",
    },
    actionBtnTextFilled: {
      color: "#00B8FF",
      fontFamily: theme.mediumFont ?? "System",
      fontSize: 12,
    },
    perfilIcon: {
      width: 16,
      height: 16,
    },
    actionBtnTextOutline: {
      color: "#1F6CD0",
      fontFamily: theme.mediumFont ?? "System",
      fontSize: 11,
      lineHeight: 13,
      textAlign: "center",
    },
    actionBtnTextNarrow: {
      flexShrink: 1,
    },
    galleryScroll: {
      paddingVertical: 4,
      paddingRight: 8,
      marginTop: 20,
    },
    galleryThumb: {
      borderRadius: 12,
      overflow: "hidden",
      marginRight: 12,
    },
    personalBlock: {
      marginTop: 28,
      alignItems: "center",
      alignSelf: "stretch",
    },
    legalName: {
      color: "#FFFFFF",
      fontFamily: theme.semiBoldFont ?? theme.mediumFont ?? "System",
      fontSize: 22,
      lineHeight: 28,
      textAlign: "center",
      alignSelf: "stretch",
    },
    headline: {
      marginTop: 8,
      color: ACCENT,
      fontFamily: theme.mediumFont ?? "System",
      fontSize: 15,
      lineHeight: 20,
      textAlign: "center",
      alignSelf: "stretch",
    },
    personalMeta: {
      marginTop: 16,
      alignItems: "center",
      alignSelf: "stretch",
    },
    metaLine: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
      gap: 8,
      paddingHorizontal: 4,
    },
    metaBetween: {
      width: 16,
    },
    metaText: {
      color: "#FFFFFF",
      fontFamily: theme.regularFont ?? "System",
      fontSize: 15,
    },
    metaTextLocation: {
      flexShrink: 1,
      maxWidth: "52%",
    },
  });
}
