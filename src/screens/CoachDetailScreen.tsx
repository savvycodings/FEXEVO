import React, { useCallback, useContext, useMemo } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,
  useWindowDimensions,
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
import { getCoachDetail } from "../lib/coach-detail-data";
import type { MainStackParamList } from "../navigation/types";

const UNFOLLOW_ICON = require("../../assets/youpage/unfollowicon.svg");
const BOOK_VIDEO_ICON = require("../../assets/youpage/bookvideocall.svg");
const PERSONAL_ICON = require("../../assets/coachs/personalicon.png");
const SHIELD_COACH = require("../../assets/coachs/shieldcoach.png");
const SCORE_GRAPHIC = require("../../assets/coachs/coachscore.png");
const BD_ICON_SVG = require("../../assets/coachs/bdicon.svg");
const MEDEL_SVG = require("../../assets/coachs/medel.svg");
const SHARE_ICON_SVG = require("../../assets/coachs/shareicon.svg");

const SHARE_ICON_SIZE = 22;

const COACH_GALLERY = [
  require("../../assets/coachs/img1.png"),
  require("../../assets/coachs/img2.png"),
  require("../../assets/coachs/img3.png"),
  require("../../assets/coachs/img4.png"),
  require("../../assets/coachs/img5.png"),
] as const;

const SHIELD_ASPECT = 211 / 170;
const SCORE_ASPECT = 176 / 195;
const GALLERY_SIZE = 80;
const MEDAL_ICON_SIZE = 52;
const ACCENT = "#00B8FF";
const PILL_INACTIVE = "#0E1830";
const OUTLINE_BORDER = "rgba(0, 184, 255, 0.45)";
const META_MUTED = "rgba(160, 180, 210, 0.95)";

type CoachDetailRoute = RouteProp<MainStackParamList, "CoachDetail">;
type CoachDetailNav = NativeStackNavigationProp<MainStackParamList, "CoachDetail">;

export function CoachDetailScreen() {
  const navigation = useNavigation<CoachDetailNav>();
  const route = useRoute<CoachDetailRoute>();
  const insets = useSafeAreaInsets();
  const { theme } = useContext(ThemeContext);
  const { width: winW } = useWindowDimensions();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const coachId = route.params.coachId;
  const coach = useMemo(() => getCoachDetail(coachId), [coachId]);
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
  const contentW = winW - horizontalPad * 2;
  const heroGap = 12;
  const shieldW = Math.min(168, Math.floor(contentW * 0.4));
  const shieldH = shieldW * SHIELD_ASPECT;
  const scoreColW = contentW - shieldW - heroGap;
  const scoreImgH = Math.min(scoreColW * SCORE_ASPECT, 200);

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

  async function onShare() {
    try {
      await Share.share({
        message: `${detail.fullLegalName}\n${detail.locationDisplay}`,
      });
    } catch {
      /* dismissed */
    }
  }

  return (
    <View style={styles.root}>
      <Header
        flatOverlay
        onBackPress={() => navigation.goBack()}
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
        <View style={styles.shareRow}>
          <TouchableOpacity
            onPress={() => void onShare()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Share coach"
          >
            <LocalSvgAsset assetModule={SHARE_ICON_SVG} width={SHARE_ICON_SIZE} height={SHARE_ICON_SIZE} />
          </TouchableOpacity>
        </View>

        <View style={[styles.heroRow, { gap: heroGap }]}>
          <Image
            source={SHIELD_COACH}
            style={{ width: shieldW, height: shieldH }}
            resizeMode="contain"
            accessibilityLabel={`${detail.displayName} shield`}
          />
          <View style={[styles.heroRight, { width: scoreColW }]}>
            <Image
              source={SCORE_GRAPHIC}
              style={{ width: scoreColW, height: scoreImgH }}
              resizeMode="contain"
              accessibilityLabel="Coach score"
            />
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnFilled]} activeOpacity={0.85}>
            <Image source={PERSONAL_ICON} style={styles.perfilIcon} resizeMode="contain" />
            <Text style={styles.actionBtnTextFilled}>Perfil</Text>
          </TouchableOpacity>
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
          <Text style={styles.legalName}>{detail.fullLegalName}</Text>
          <Text style={styles.headline}>{detail.headline}</Text>
          <View style={styles.personalMeta}>
            <View style={styles.metaLine}>
              <LocalSvgAsset assetModule={BD_ICON_SVG} width={18} height={18} />
              <Text style={styles.metaText}>{detail.birthDisplay}</Text>
              <View style={styles.metaBetween} />
              <Ionicons name="location-outline" size={18} color="#FFFFFF" />
              <Text style={[styles.metaText, styles.metaTextLocation]} numberOfLines={1}>
                {detail.locationDisplay}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.splitRow}>
          <View style={styles.achievementCard}>
            <LocalSvgAsset assetModule={MEDEL_SVG} width={MEDAL_ICON_SIZE} height={MEDAL_ICON_SIZE} />
            <Text style={styles.achievementTitle} numberOfLines={3}>
              {detail.achievementTitle}
            </Text>
            <Text style={styles.achievementSub} numberOfLines={2}>
              {detail.achievementSubtitle}
            </Text>
          </View>
          <View style={styles.perfilCol}>
            <Text style={styles.perfilHeading}>Perfil</Text>
            <View style={styles.perfilRule} />
            <Text style={styles.perfilBody}>{detail.perfilBody}</Text>
          </View>
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
    shareRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      marginBottom: 6,
    },
    scroll: {
      flex: 1,
    },
    scrollInner: {
      paddingBottom: 20,
    },
    heroRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
    },
    heroRight: {
      minWidth: 0,
    },
    actionRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 20,
    },
    actionBtn: {
      flex: 1,
      minWidth: 0,
      borderRadius: 20,
      paddingVertical: 12,
      paddingHorizontal: 6,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    actionBtnFilled: {
      backgroundColor: PILL_INACTIVE,
    },
    actionBtnOutline: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: OUTLINE_BORDER,
    },
    actionBtnTextFilled: {
      color: "#FFFFFF",
      fontFamily: theme.mediumFont ?? "System",
      fontSize: 12,
    },
    perfilIcon: {
      width: 16,
      height: 16,
    },
    actionBtnTextOutline: {
      color: "#FFFFFF",
      fontFamily: theme.mediumFont ?? "System",
      fontSize: 11,
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
    splitRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginTop: 28,
      gap: 12,
    },
    achievementCard: {
      width: "36%",
      minWidth: 118,
      backgroundColor: PILL_INACTIVE,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 12,
      alignItems: "center",
    },
    achievementTitle: {
      marginTop: 10,
      color: "#FFFFFF",
      fontFamily: theme.semiBoldFont ?? theme.mediumFont ?? "System",
      fontSize: 14,
      lineHeight: 18,
      textAlign: "center",
    },
    achievementSub: {
      marginTop: 6,
      color: META_MUTED,
      fontFamily: theme.regularFont ?? "System",
      fontSize: 12,
      lineHeight: 16,
      textAlign: "center",
    },
    perfilCol: {
      flex: 1,
      minWidth: 0,
    },
    perfilHeading: {
      color: ACCENT,
      fontFamily: theme.semiBoldFont ?? theme.mediumFont ?? "System",
      fontSize: 16,
    },
    perfilRule: {
      height: 1,
      backgroundColor: "rgba(0, 184, 255, 0.35)",
      marginTop: 8,
      marginBottom: 10,
    },
    perfilBody: {
      color: "rgba(255, 255, 255, 0.88)",
      fontFamily: theme.regularFont ?? "System",
      fontSize: 14,
      lineHeight: 21,
    },
  });
}
