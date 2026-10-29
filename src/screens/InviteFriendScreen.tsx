import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Share,
  useWindowDimensions,
  TextInput,
  Text,
  Platform,
  ActivityIndicator,
  BackHandler,
  ScrollView,
  Modal,
  Pressable,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../navigation/types";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemeContext } from "../context";
import { Header } from "../components/Header";
import { MainTabBarChrome } from "../components/MainTabBarChrome";
import { PersonCard } from "../components/PersonCard";
import { GlowButton, SegmentedToggle, SELECTED_GLOW, UI } from "../components/ui";
import { useSessionData } from "../context/SessionDataContext";
import { findCountry } from "../lib/countries";
import { fetchMyFriends, type Friend } from "../lib/friendsApi";
import { ClubBannerImage } from "../components/ClubBannerImage";
import { ClubPfpImage } from "../components/ClubPfpImage";
import {
  fetchClubs,
  clubBannerUri,
  clubLogoUri,
  type ClubSummary,
} from "../lib/clubsApi";
import { fetchCoachCards, type CoachCard } from "../lib/coachDirectoryApi";
import { useTranslation } from "react-i18next";

type InviteSegment = "friends" | "coaches" | "clubs";
type FriendsView = "mine" | "requests";
type CoachFilter = "all" | "nearby";
type CoachSort = "relevance" | "rating" | "name";

const PLACEHOLDER = "rgba(255, 255, 255, 0.85)";

/** CClub banners 370×160 */
const CLUB_BANNER_ASPECT = 160 / 370;
const CLUB_AVATAR = 44;

function matchesQuery(query: string, fields: Array<string | null | undefined>): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => field?.toLowerCase().includes(needle));
}

type InviteSearchNav = NativeStackNavigationProp<MainStackParamList, "InviteSearch">;

export function InviteFriendScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<InviteSearchNav>();
  const { theme } = useContext(ThemeContext);
  const { width: winW } = useWindowDimensions();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { profileAreaLocation } = useSessionData();

  const [segment, setSegment] = useState<InviteSegment>("friends");
  const [friendsView, setFriendsView] = useState<FriendsView>("mine");
  const [coachFilter, setCoachFilter] = useState<CoachFilter>("all");
  const [sort, setSort] = useState<CoachSort>("relevance");
  const [sortOpen, setSortOpen] = useState(false);
  const [query, setQuery] = useState("");

  const [clubs, setClubs] = useState<ClubSummary[] | null>(null);
  const [coaches, setCoaches] = useState<CoachCard[] | null>(null);
  const [friends, setFriends] = useState<Friend[] | null>(null);

  const myCountry = useMemo(() => findCountry(profileAreaLocation)?.code ?? null, [profileAreaLocation]);

  const visibleCoaches = useMemo(() => {
    if (coaches == null) return null;
    const needle = query.trim().toLowerCase();
    const list = coaches.filter((coach) => {
      if (!matchesQuery(query, [coach.name, coach.username, coach.areaLocation])) return false;
      if (coachFilter === "nearby") {
        return myCountry != null && findCountry(coach.areaLocation)?.code === myCountry;
      }
      return true;
    });
    const byName = (a: CoachCard, b: CoachCard) => a.name.localeCompare(b.name);
    const byRating = (a: CoachCard, b: CoachCard) =>
      (b.overallScore ?? -1) - (a.overallScore ?? -1) || byName(a, b);
    if (sort === "name") return list.sort(byName);
    if (sort === "rating") return list.sort(byRating);
    // Relevance: names that start with the query first, then the best rated.
    return list.sort((a, b) => {
      if (needle) {
        const sa = a.name.toLowerCase().startsWith(needle) ? 0 : 1;
        const sb = b.name.toLowerCase().startsWith(needle) ? 0 : 1;
        if (sa !== sb) return sa - sb;
      }
      return byRating(a, b);
    });
  }, [coaches, query, coachFilter, myCountry, sort]);

  const visibleFriends = useMemo(() => {
    if (friends == null) return null;
    return friends.filter((f) => matchesQuery(query, [f.name, f.username, f.areaLocation]));
  }, [friends, query]);

  const visibleClubs = useMemo(() => {
    if (clubs == null) return null;
    return clubs.filter((club) =>
      matchesQuery(query, [club.name, club.city, club.country, club.region, club.address]),
    );
  }, [clubs, query]);

  useEffect(() => {
    let cancelled = false;
    void fetchClubs().then((result) => {
      if (!cancelled) setClubs(result);
    });
    void fetchCoachCards().then((result) => {
      if (!cancelled) setCoaches(result);
    });
    void fetchMyFriends().then((result) => {
      if (!cancelled) setFriends(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const cardW = winW - 40;
  const bannerH = cardW * CLUB_BANNER_ASPECT;

  const searchPlaceholder =
    segment === "friends"
      ? t("inviteExtra.searchFriendsHint")
      : segment === "coaches"
        ? t("inviteExtra.searchCoachesHint")
        : t("inviteExtra.searchClubsHint");

  const sortLabels: Record<CoachSort, string> = {
    relevance: t("inviteExtra.sortRelevance"),
    rating: t("inviteExtra.sortRating"),
    name: t("inviteExtra.sortName"),
  };

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

  function onFriendsView(view: FriendsView | "ranking") {
    if (view === "ranking") {
      navigation.navigate("Main", { screen: "Progress", params: { screen: "Ranking" } });
      return;
    }
    setFriendsView(view);
  }

  const screenBg = theme.backgroundColor ?? "#030A17";
  const showCoachMeta = segment === "coaches" && visibleCoaches != null && (query.trim() !== "" || coachFilter !== "all");

  const coachesBody =
    visibleCoaches == null ? (
      <ActivityIndicator style={styles.listLoading} color={UI.accent} />
    ) : visibleCoaches.length === 0 ? (
      <Text style={styles.emptyListText}>
        {coaches != null && coaches.length === 0
          ? t("inviteExtra.noCoaches")
          : coachFilter === "nearby" && !query.trim()
            ? t("inviteExtra.noNearbyCoaches")
            : t("inviteExtra.noCoachesMatch")}
      </Text>
    ) : (
      <View style={styles.cardList}>
        {visibleCoaches.map((coach) => (
          <PersonCard
            key={coach.id}
            name={coach.name}
            imageUri={coach.imageUri}
            subtitle={t("inviteExtra.coachSubtitle")}
            location={coach.areaLocation}
            verified
            tier={coach.tier}
            onPress={() =>
              navigation.navigate("CoachDetail", {
                coachId: coach.id,
                coachName: coach.name,
                coachImageUri: coach.imageUri,
              })
            }
          />
        ))}
      </View>
    );

  const friendsBody =
    friendsView === "requests" ? (
      <Text style={styles.emptyListText}>{t("inviteExtra.noRequests")}</Text>
    ) : visibleFriends == null ? (
      <ActivityIndicator style={styles.listLoading} color={UI.accent} />
    ) : visibleFriends.length === 0 ? (
      <Text style={styles.emptyListText}>
        {friends != null && friends.length === 0 ? t("inviteExtra.noFriends") : t("inviteExtra.noFriendsMatch")}
      </Text>
    ) : (
      <View style={styles.cardList}>
        {visibleFriends.map((f) => (
          <PersonCard
            key={f.id}
            name={f.name}
            imageUri={f.imageUri}
            subtitle={f.relation === "coach" ? t("inviteExtra.yourCoach") : t("inviteExtra.yourStudent")}
            location={f.areaLocation}
            verified={f.relation === "coach"}
            onPress={
              f.relation === "coach"
                ? () =>
                    navigation.navigate("CoachDetail", {
                      coachId: f.id,
                      coachName: f.name,
                      coachImageUri: f.imageUri,
                    })
                : undefined
            }
          />
        ))}
      </View>
    );

  const clubsBody =
    visibleClubs == null ? (
      <ActivityIndicator style={styles.listLoading} color={UI.accent} />
    ) : visibleClubs.length === 0 ? (
      <Text style={styles.emptyListText}>
        {clubs != null && clubs.length > 0 ? "No clubs match your search" : "No clubs yet"}
      </Text>
    ) : (
      <View style={styles.clubsList}>
        {visibleClubs.map((club, index) => {
          const subtitle = [club.city, club.country].filter(Boolean).join(", ");
          return (
            <TouchableOpacity
              key={club.id}
              activeOpacity={0.9}
              style={index > 0 ? styles.clubCardFollow : undefined}
              onPress={() => navigation.navigate("ClubDetail", { clubId: club.slug })}
              accessibilityRole="button"
              accessibilityLabel={club.name}
            >
              <View style={[styles.clubBannerOuter, { borderRadius: 16 }]}>
                <ClubBannerImage uri={clubBannerUri(club)} width={cardW} height={bannerH} />
              </View>
              <View style={styles.clubProfileRow}>
                <View style={styles.clubAvatarSlot}>
                  <ClubPfpImage uri={clubLogoUri(club)} size={CLUB_AVATAR} fallbackLabel={club.name} />
                </View>
                <View style={styles.clubTextCol}>
                  <Text style={styles.clubTitle} numberOfLines={2}>
                    {club.name}
                  </Text>
                  {subtitle ? (
                    <Text style={styles.clubSubtitle} numberOfLines={2}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
              </View>
              {index < visibleClubs.length - 1 ? <View style={styles.clubDivider} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
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
          contentContainerStyle={[styles.scrollContent, { paddingTop: 12, paddingBottom: 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        >
          <View style={styles.segmentRow}>
            {(
              [
                { key: "friends" as const, label: t("invite.friends") },
                { key: "coaches" as const, label: t("invite.coaches") },
                { key: "clubs" as const, label: t("invite.clubs") },
              ] as const
            ).map(({ key, label }) => (
              <Pill
                key={key}
                label={label}
                active={segment === key}
                onPress={() => setSegment(key)}
                style={styles.segmentPill}
                textStyle={styles.segmentLabel}
                role="tab"
              />
            ))}
          </View>

          {segment === "friends" ? (
            <View style={styles.subTabs}>
              <SegmentedToggle<FriendsView | "ranking">
                options={[
                  { value: "mine", label: t("inviteExtra.myFriends") },
                  { value: "requests", label: t("inviteExtra.requests") },
                  { value: "ranking", label: t("inviteExtra.ranking") },
                ]}
                value={friendsView}
                onChange={onFriendsView}
              />
            </View>
          ) : null}

          <View style={styles.searchRow}>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={20} color={UI.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={PLACEHOLDER}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {query ? (
                <TouchableOpacity
                  onPress={() => setQuery("")}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t("inviteExtra.clearSearch")}
                >
                  <Ionicons name="close-circle" size={20} color={UI.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() => setSortOpen(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t("inviteExtra.filters")}
              disabled={segment !== "coaches"}
            >
              <Ionicons name="filter" size={22} color={segment === "coaches" ? "#FFFFFF" : UI.textMuted} />
            </TouchableOpacity>
          </View>

          {segment === "coaches" ? (
            <View style={styles.chipRow}>
              <Pill
                label={t("inviteExtra.allCoaches")}
                active={coachFilter === "all"}
                onPress={() => setCoachFilter("all")}
                style={styles.chip}
                textStyle={styles.chipLabel}
              />
              <Pill
                label={t("inviteExtra.nearby")}
                active={coachFilter === "nearby"}
                onPress={() => setCoachFilter("nearby")}
                style={styles.chip}
                textStyle={styles.chipLabel}
              />
            </View>
          ) : null}

          {showCoachMeta ? (
            <View style={styles.metaRow}>
              <Text allowFontScaling={false} style={styles.metaText}>
                {visibleCoaches!.length === 1
                  ? t("inviteExtra.coachFound", { count: 1 })
                  : t("inviteExtra.coachesFound", { count: visibleCoaches!.length })}
              </Text>
              <TouchableOpacity style={styles.sortBtn} onPress={() => setSortOpen(true)} hitSlop={8}>
                <Text allowFontScaling={false} style={styles.metaText}>
                  {t("inviteExtra.sortLabel", { sort: sortLabels[sort] })}
                </Text>
                <Ionicons name="chevron-down" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : null}

          {segment === "coaches" ? coachesBody : segment === "clubs" ? clubsBody : friendsBody}
        </ScrollView>
        {segment === "friends" ? (
          <View style={styles.footer}>
            <GlowButton
              label={t("invite.inviteFriend")}
              onPress={() => void onInvitePress()}
              leadingIcon="person-add"
              arrow
              radius={UI.radiusCard}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSortOpen(false)} />
          <View style={styles.modalCard}>
            <Text allowFontScaling={false} style={styles.modalTitle}>
              {t("inviteExtra.sortTitle")}
            </Text>
            {(["relevance", "rating", "name"] as const).map((key) => {
              const selected = sort === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.modalRow, selected && styles.modalRowActive]}
                  onPress={() => {
                    setSort(key);
                    setSortOpen(false);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.modalRowText, selected && styles.modalRowTextActive]}>{sortLabels[key]}</Text>
                  {selected ? <Ionicons name="checkmark" size={18} color={UI.accent} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
      <MainTabBarChrome />
    </View>
  );
}

/** Gradient + glow when active, dark outlined pill otherwise (top tabs and filter chips). */
function Pill({
  label,
  active,
  onPress,
  style,
  textStyle,
  role = "button",
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  style: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
  role?: "tab" | "button";
}) {
  return (
    <TouchableOpacity
      style={[style, active ? pillStyles.active : pillStyles.idle]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole={role}
      accessibilityState={{ selected: active }}
    >
      {active ? (
        <>
          <LinearGradient
            colors={UI.gradient}
            locations={UI.gradientLocations}
            start={UI.gradientStart}
            end={UI.gradientEnd}
            style={[StyleSheet.absoluteFill, pillStyles.fill]}
          />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, pillStyles.fill, SELECTED_GLOW]} />
        </>
      ) : null}
      <Text allowFontScaling={false} numberOfLines={1} style={[textStyle, { color: active ? "#FFFFFF" : UI.textMuted }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const pillStyles = StyleSheet.create({
  active: { borderColor: "transparent" },
  idle: { backgroundColor: UI.surface, borderColor: UI.surfaceBorder },
  fill: { borderRadius: 999 },
});

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
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 32,
    },
    segmentRow: {
      flexDirection: "row",
      gap: 8,
    },
    segmentPill: {
      flex: 1,
      height: 50,
      borderRadius: 999,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentLabel: {
      fontFamily: theme.mediumFont ?? "System",
      fontSize: 16,
    },
    subTabs: {
      marginTop: 14,
    },
    searchRow: {
      marginTop: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    searchWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      height: 54,
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: UI.trackBorder,
      backgroundColor: "rgba(0, 10, 30, 0.6)",
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      fontFamily: theme.regularFont ?? "System",
      fontSize: 14,
      color: "#FFFFFF",
      paddingVertical: 0,
      // The field's pill border is the focus cue; drop the browser's outline.
      ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}),
    },
    filterBtn: {
      width: 54,
      height: 54,
      borderRadius: 27,
      borderWidth: 1,
      borderColor: UI.trackBorder,
      backgroundColor: "rgba(0, 10, 30, 0.6)",
      alignItems: "center",
      justifyContent: "center",
    },
    chipRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 14,
    },
    chip: {
      height: 40,
      paddingHorizontal: 18,
      borderRadius: 999,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    chipLabel: {
      fontFamily: theme.mediumFont ?? "System",
      fontSize: 14,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 18,
    },
    metaText: {
      fontFamily: theme.regularFont ?? "System",
      fontSize: 15,
      color: "#FFFFFF",
    },
    sortBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    cardList: {
      marginTop: 16,
      gap: 12,
    },
    listLoading: {
      marginTop: 32,
    },
    emptyListText: {
      marginTop: 32,
      textAlign: "center",
      color: "rgba(255, 255, 255, 0.6)",
      fontFamily: theme.regularFont ?? "System",
      fontSize: 14,
      lineHeight: 20,
      paddingHorizontal: 16,
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 96,
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
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    modalCard: {
      width: "100%",
      maxWidth: 360,
      borderRadius: UI.radiusCard,
      borderWidth: 1,
      borderColor: UI.cardBorder,
      backgroundColor: UI.cardBg,
      padding: 16,
      gap: 6,
    },
    modalTitle: {
      fontFamily: theme.semiBoldFont ?? "System",
      fontSize: 17,
      color: "#FFFFFF",
      marginBottom: 6,
    },
    modalRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
    },
    modalRowActive: {
      backgroundColor: UI.surface,
    },
    modalRowText: {
      fontFamily: theme.mediumFont ?? "System",
      fontSize: 15,
      color: UI.textMuted,
    },
    modalRowTextActive: {
      color: "#FFFFFF",
    },
  });
}
