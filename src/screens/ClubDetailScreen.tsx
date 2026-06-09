import React, { useCallback, useContext, useMemo } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ThemeContext } from "../context";
import { Header } from "../components/Header";
import { MainTabBarChrome } from "../components/MainTabBarChrome";
import { LocalSvgAsset } from "../components/LocalSvgAsset";
import { ClubBannerImage } from "../components/ClubBannerImage";
import { ClubPfpImage } from "../components/ClubPfpImage";
import { getClubDetail } from "../lib/club-detail-data";
import type { MainStackParamList } from "../navigation/types";

const ABOUT_ICON = require("../../assets/youpage/abouticon.svg");
const UNFOLLOW_ICON = require("../../assets/youpage/unfollowicon.svg");
const BOOK_VIDEO_ICON = require("../../assets/youpage/bookvideocall.svg");
const SHARE_ICON_SVG = require("../../assets/coachs/shareicon.svg");

const SHARE_ICON_SIZE = 22;

const GALLERY_MODULES = [
  require("../../assets/youpage/img1.svg"),
  require("../../assets/youpage/img2.svg"),
  require("../../assets/youpage/img3.svg"),
  require("../../assets/youpage/img4.svg"),
  require("../../assets/youpage/img5.svg"),
] as const;

const CLUB_BANNER_ASPECT = 160 / 370;
const GALLERY_SIZE = 80;
const ACCENT = "#00B8FF";
const PILL_INACTIVE = "#0E1830";
const OUTLINE_BORDER = "rgba(0, 184, 255, 0.45)";
/** Inner logo size inside the white ring (matches reference proportions). */
const AVATAR_INNER = 66;
const AVATAR_RING = 3;
const AVATAR_OUTER = AVATAR_INNER + AVATAR_RING * 2;

type ClubDetailRoute = RouteProp<MainStackParamList, "ClubDetail">;
type ClubDetailNav = NativeStackNavigationProp<MainStackParamList, "ClubDetail">;

export function ClubDetailScreen() {
  const navigation = useNavigation<ClubDetailNav>();
  const route = useRoute<ClubDetailRoute>();
  const insets = useSafeAreaInsets();
  const { theme } = useContext(ThemeContext);
  const { width: winW } = useWindowDimensions();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const clubId = route.params.clubId;
  const club = useMemo(() => getClubDetail(clubId), [clubId]);
  const horizontalPad = Math.max(16, insets.left, insets.right);
  const bannerW = winW;
  const bannerH = bannerW * CLUB_BANNER_ASPECT;

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

  if (!club) {
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
          <Text style={styles.fallbackText}>Club not found</Text>
        </View>
        <MainTabBarChrome />
      </View>
    );
  }

  const { title: clubTitle, subtitle: clubSubtitle, address: clubAddress } = club;

  async function onShare() {
    try {
      await Share.share({
        message: `${clubTitle} — ${clubSubtitle}\n${clubAddress}`,
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
        key={clubId}
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
            accessibilityLabel="Share club"
          >
            <LocalSvgAsset assetModule={SHARE_ICON_SVG} width={SHARE_ICON_SIZE} height={SHARE_ICON_SIZE} />
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <View style={[styles.bannerBleed, { marginHorizontal: -horizontalPad, width: bannerW }]}>
            <View style={styles.bannerClip}>
              <ClubBannerImage
                key={`banner-${clubId}`}
                bannerMod={club.bannerMod}
                bannerPng={club.bannerPng}
                width={bannerW}
                height={bannerH}
              />
            </View>
          </View>
          <View style={styles.heroOverlap}>
            {club.pfpUseWhiteRing === false ? (
              <ClubPfpImage
                key={`pfp-${clubId}`}
                pfpMod={club.pfpMod}
                pfpPng={club.pfpPng}
                size={AVATAR_OUTER}
              />
            ) : (
              <View style={styles.avatarOuter}>
                <ClubPfpImage
                  key={`pfp-${clubId}`}
                  pfpMod={club.pfpMod}
                  pfpPng={club.pfpPng}
                  size={AVATAR_INNER}
                />
              </View>
            )}
            <View style={styles.heroTitles}>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {club.title}
              </Text>
              <Text style={styles.heroSubtitle} numberOfLines={2}>
                {club.subtitle}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnFilled]} activeOpacity={0.85}>
            <LocalSvgAsset assetModule={ABOUT_ICON} width={16} height={16} />
            <Text style={styles.actionBtnTextFilled}>About</Text>
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
          {GALLERY_MODULES.map((mod, i) => (
            <View key={i} style={styles.galleryThumb}>
              <LocalSvgAsset assetModule={mod} width={GALLERY_SIZE} height={GALLERY_SIZE} />
            </View>
          ))}
        </ScrollView>

        <View style={styles.locSection}>
          <Text style={styles.locHeading}>Locaction</Text>
          <View style={styles.locRule} />
          <Text style={styles.addressText}>{club.address}</Text>
          <Text style={styles.infoLine}>
            <Text style={styles.infoLabel}>Teléfono: </Text>
            <Text style={styles.infoValue}>{club.phone}</Text>
          </Text>
          <Text style={styles.infoLine}>
            <Text style={styles.infoLabel}>Horario: </Text>
            <Text style={styles.infoValue}>{club.hours}</Text>
          </Text>
        </View>

        <View style={styles.aboutSection}>
          <Text style={styles.aboutHeading}>About</Text>
          <Text style={styles.aboutBody}>{club.aboutBody}</Text>
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
    hero: {
      marginBottom: 6,
    },
    bannerBleed: {
      alignSelf: "center",
    },
    bannerClip: {
      borderRadius: 0,
      overflow: "hidden",
    },
    heroOverlap: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 14,
    },
    avatarOuter: {
      width: AVATAR_OUTER,
      height: AVATAR_OUTER,
      borderRadius: AVATAR_OUTER / 2,
      backgroundColor: "#FFFFFF",
      padding: AVATAR_RING,
      justifyContent: "center",
      alignItems: "center",
    },
    heroTitles: {
      flex: 1,
      minWidth: 0,
      paddingLeft: 14,
    },
    heroTitle: {
      color: "#FFFFFF",
      fontFamily: theme.semiBoldFont ?? theme.mediumFont ?? "System",
      fontSize: 24,
      lineHeight: 28,
    },
    heroSubtitle: {
      marginTop: 6,
      color: "rgba(160, 180, 210, 0.95)",
      fontFamily: theme.regularFont ?? "System",
      fontSize: 14,
      lineHeight: 18,
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
    locSection: {
      marginTop: 28,
    },
    locHeading: {
      color: ACCENT,
      fontFamily: theme.semiBoldFont ?? theme.mediumFont ?? "System",
      fontSize: 16,
    },
    locRule: {
      height: 1,
      backgroundColor: "rgba(0, 184, 255, 0.35)",
      marginTop: 8,
      marginBottom: 14,
    },
    addressText: {
      color: "#FFFFFF",
      fontFamily: theme.regularFont ?? "System",
      fontSize: 15,
      lineHeight: 22,
    },
    infoLine: {
      marginTop: 12,
    },
    infoLabel: {
      color: ACCENT,
      fontFamily: theme.regularFont ?? "System",
      fontSize: 15,
    },
    infoValue: {
      color: "#FFFFFF",
      fontFamily: theme.regularFont ?? "System",
      fontSize: 15,
    },
    aboutSection: {
      marginTop: 28,
    },
    aboutHeading: {
      color: ACCENT,
      fontFamily: theme.semiBoldFont ?? theme.mediumFont ?? "System",
      fontSize: 16,
      marginBottom: 10,
    },
    aboutBody: {
      color: "rgba(255, 255, 255, 0.88)",
      fontFamily: theme.regularFont ?? "System",
      fontSize: 15,
      lineHeight: 22,
    },
  });
}
