import React, { useCallback, useContext, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Share,
  useWindowDimensions,
  TextInput,
  Text,
  Platform,
  Image,
  BackHandler,
  ScrollView,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../navigation/types";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemeContext } from "../context";
import { Header } from "../components/Header";
import { MainTabBarChrome } from "../components/MainTabBarChrome";
import { LocalSvgAsset } from "../components/LocalSvgAsset";
import { ClubBannerImage } from "../components/ClubBannerImage";
import { ClubPfpImage } from "../components/ClubPfpImage";
import { CLUB_LIST_ROWS } from "../lib/club-detail-data";
import { COACH_CARD_ASPECT, COACH_INVITE_CARDS } from "../lib/coach-invite-data";
import { useTranslation } from "react-i18next";

const INVITE_SVG = require("../../assets/youpage/invitebutton.svg");
type InviteSegment = "friends" | "coaches" | "clubs";

const TAB_ACTIVE = "#0048CD";
const SEGMENT_INACTIVE_BG = "#041641";
const SEGMENT_INACTIVE_TEXT = "#00B8FF80";
const SEARCH_BORDER = "#0066FF40";
/** See-through search field; border carries the tint color. */
const SEARCH_FILL = "transparent";
const SEARCH_ICON_COLOR = "#336AB4";
const PLACEHOLDER_BLUE = "rgba(91, 157, 255, 0.55)";
const CLUB_PLACEHOLDER_WHITE = "rgba(255, 255, 255, 0.55)";

/** CClub banners 370×160 */
const CLUB_BANNER_ASPECT = 160 / 370;
const CLUB_AVATAR = 44;

type InviteSearchNav = NativeStackNavigationProp<MainStackParamList, "InviteSearch">;

export function InviteFriendScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<InviteSearchNav>();
  const { theme } = useContext(ThemeContext);
  const { width: winW } = useWindowDimensions();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [segment, setSegment] = useState<InviteSegment>("friends");
  const [query, setQuery] = useState("");

  const cardW = winW - 40;
  const bannerH = cardW * CLUB_BANNER_ASPECT;
  const coachCardH = cardW * COACH_CARD_ASPECT;
  const btnW = Math.min(370, winW - 40);
  const btnH = btnW * (60 / 370);

  const searchPlaceholder =
    segment === "friends"
      ? t("invite.searchFriends")
      : segment === "coaches"
        ? t("invite.searchCoach")
        : t("invite.searchClubs");

  const showRanking = segment === "friends";
  const showInviteFooter = segment === "friends";
  const searchPlaceholderColor = segment === "clubs" ? CLUB_PLACEHOLDER_WHITE : PLACEHOLDER_BLUE;

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        navigation.goBack();
        return true;
      });
      return () => sub.remove();
    }, [navigation]),
  );

  async function onInvitePress() {
    try {
      await Share.share({
        message: t("invite.shareMessage"),
      });
    } catch {
      /* dismissed */
    }
  }

  const scrollFooterStyle =
    segment === "friends"
      ? styles.scrollContentWithFooter
      : segment === "coaches" || segment === "clubs"
        ? styles.scrollContentList
        : styles.scrollContentWithFooter;

  const screenBg = theme.backgroundColor ?? "#030A17";

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

  return (
    <View style={[styles.root, { backgroundColor: screenBg }]}>
      <StatusBar style="light" />
      <Header
        flatOverlay
        onBackPress={() => navigation.goBack()}
        onProPress={() => navigation.navigate("ProSubscription")}
        onSettingsPress={() => navigation.navigate("ProfileSettings")}
        onNotificationsPress={() => navigation.navigate("Notifications")}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.kav}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={[styles.scroll, { backgroundColor: screenBg }]}
          contentContainerStyle={[
            styles.scrollContent,
            scrollFooterStyle,
            { paddingTop: 8, paddingBottom: 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        >
        <View style={styles.titleRow}>
          <Text
            allowFontScaling={false}
            style={[
              styles.screenTitle,
              { fontFamily: theme.semiBoldFont ?? theme.mediumFont ?? "System" },
            ]}
          >
            Search
          </Text>
        </View>
        <View style={styles.titleDivider} />
        <View style={styles.segmentRow}>
          {(
            [
              { key: "friends" as const, label: t("invite.friends") },
              { key: "coaches" as const, label: t("invite.coaches") },
              { key: "clubs" as const, label: t("invite.clubs") },
            ] as const
          ).map(({ key, label }) => {
            const active = segment === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.segmentPill, active ? styles.segmentPillActive : styles.segmentPillInactive]}
                onPress={() => setSegment(key)}
                activeOpacity={0.85}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.segmentLabel, active ? styles.segmentLabelActive : styles.segmentLabelInactive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {showRanking ? (
          <TouchableOpacity
            style={styles.rankingPill}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t("inviteExtra.ranking")}
          >
            <Text style={styles.rankingLabel}>Ranking</Text>
          </TouchableOpacity>
        ) : null}

        <View style={[styles.searchWrap, !showRanking && styles.searchWrapTightTop]}>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor={searchPlaceholderColor}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          <View style={styles.searchIconSlot} pointerEvents="none">
            <Ionicons name="search-outline" size={20} color={SEARCH_ICON_COLOR} />
          </View>
        </View>

        {segment === "coaches" ? (
          <View style={styles.coachesList}>
            {COACH_INVITE_CARDS.map((coach, index) => (
              <TouchableOpacity
                key={coach.id}
                activeOpacity={0.9}
                style={index > 0 ? styles.coachCardFollow : undefined}
                onPress={() => navigation.navigate("CoachDetail", { coachId: coach.id })}
                accessibilityRole="button"
                accessibilityLabel={coach.accessibilityLabel}
              >
                <View style={styles.coachCardOuter}>
                  <Image
                    source={coach.source}
                    style={{ width: cardW, height: coachCardH }}
                    resizeMode="contain"
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : segment === "clubs" ? (
          <View style={styles.clubsList}>
            {CLUB_LIST_ROWS.map((club, index) => (
              <TouchableOpacity
                key={club.id}
                activeOpacity={0.9}
                style={index > 0 ? styles.clubCardFollow : undefined}
                onPress={() => navigation.navigate("ClubDetail", { clubId: club.id })}
                accessibilityRole="button"
                accessibilityLabel={club.title}
              >
                <View
                  style={[
                    styles.clubBannerOuter,
                    { borderRadius: club.bannerCornerRadius ?? 16 },
                  ]}
                >
                  <ClubBannerImage
                    bannerMod={club.bannerMod}
                    bannerPng={club.bannerPng}
                    width={cardW}
                    height={bannerH}
                  />
                </View>
                <View style={styles.clubProfileRow}>
                  <View style={styles.clubAvatarSlot}>
                    <ClubPfpImage pfpMod={club.pfpMod} pfpPng={club.pfpPng} size={CLUB_AVATAR} />
                  </View>
                  <View style={styles.clubTextCol}>
                    <Text style={styles.clubTitle} numberOfLines={2}>
                      {club.title}
                    </Text>
                    <Text style={styles.clubSubtitle} numberOfLines={2}>
                      {club.subtitle}
                    </Text>
                  </View>
                </View>
                {index < CLUB_LIST_ROWS.length - 1 ? <View style={styles.clubDivider} /> : null}
              </TouchableOpacity>
            ))}
            <View style={styles.clubDivider} />
          </View>
        ) : (
          <>
            <View style={styles.emptyBlock} />
            <Text style={styles.hintText}>Send an invitation to a friend or club to join Xevo Padel</Text>
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => void onInvitePress()}
                accessibilityRole="button"
                accessibilityLabel={t("invite.inviteFriend")}
                style={styles.inviteHit}
              >
                <LocalSvgAsset assetModule={INVITE_SVG} width={btnW} height={btnH} />
              </TouchableOpacity>
          </>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    },
    kav: {
      flex: 1,
    },
    titleRow: {
      marginBottom: 12,
    },
    screenTitle: {
      fontSize: 20,
      color: "#FFFFFF",
    },
    titleDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: "rgba(255,255,255,0.12)",
      marginBottom: 12,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 32,
    },
    scrollContentWithFooter: {
      flexGrow: 1,
    },
    scrollContentList: {
      flexGrow: 0,
    },
    segmentRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 4,
    },
    segmentPill: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentPillActive: {
      backgroundColor: TAB_ACTIVE,
    },
    segmentPillInactive: {
      backgroundColor: SEGMENT_INACTIVE_BG,
    },
    segmentLabel: {
      fontFamily: theme.mediumFont ?? "System",
      fontSize: 14,
    },
    segmentLabelActive: {
      color: "#FFFFFF",
    },
    segmentLabelInactive: {
      color: SEGMENT_INACTIVE_TEXT,
    },
    rankingPill: {
      marginTop: 10,
      paddingVertical: 14,
      borderRadius: 20,
      backgroundColor: SEGMENT_INACTIVE_BG,
      alignItems: "center",
      justifyContent: "center",
    },
    rankingLabel: {
      fontFamily: theme.mediumFont ?? "System",
      fontSize: 15,
      color: SEGMENT_INACTIVE_TEXT,
    },
    searchWrap: {
      marginTop: 16,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: SEARCH_BORDER,
      borderRadius: 16,
      paddingLeft: 14,
      paddingRight: 10,
      minHeight: 48,
      backgroundColor: SEARCH_FILL,
    },
    searchWrapTightTop: {
      marginTop: 12,
    },
    searchInput: {
      flex: 1,
      fontFamily: theme.regularFont ?? "System",
      fontSize: 15,
      color: "#FFFFFF",
      paddingVertical: Platform.OS === "ios" ? 12 : 8,
    },
    searchIconSlot: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    coachesList: {
      marginTop: 16,
    },
    coachCardFollow: {
      marginTop: 16,
    },
    coachCardOuter: {
      borderRadius: 20,
      overflow: "hidden",
      backgroundColor: "#FFFFFF",
    },
    clubsList: {
      marginTop: 16,
    },
    clubCardFollow: {
      marginTop: 16,
    },
    clubBannerOuter: {
      borderRadius: 16,
      overflow: "hidden",
      width: "100%",
    },
    clubProfileRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 12,
      gap: 12,
    },
    clubAvatarSlot: {
      width: CLUB_AVATAR,
      height: CLUB_AVATAR,
    },
    clubTextCol: {
      flex: 1,
      minWidth: 0,
      justifyContent: "center",
    },
    clubTitle: {
      fontFamily: theme.semiBoldFont ?? theme.mediumFont ?? "System",
      fontSize: 16,
      lineHeight: 20,
      color: "#FFFFFF",
    },
    clubSubtitle: {
      fontFamily: theme.regularFont ?? "System",
      fontSize: 13,
      lineHeight: 18,
      marginTop: 4,
      color: "rgba(160, 180, 210, 0.95)",
    },
    clubDivider: {
      height: 1,
      backgroundColor: "rgba(21, 60, 120, 0.55)",
      marginTop: 16,
    },
    emptyBlock: {
      flex: 1,
      minHeight: 48,
    },
    hintText: {
      fontFamily: theme.regularFont ?? "System",
      fontSize: 15,
      lineHeight: 22,
      color: "rgba(255, 255, 255, 0.78)",
      textAlign: "center",
      marginBottom: 20,
      paddingHorizontal: 8,
    },
    inviteHit: {
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
    },
  });
}
