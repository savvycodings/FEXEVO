import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Image,
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
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../navigation/types";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemeContext } from "../context";
import { Header } from "../components/Header";
import { MainTabBarChrome } from "../components/MainTabBarChrome";
import { PersonCard } from "../components/PersonCard";
import { GlowButton, SegmentedToggle, UI } from "../components/ui";
import { useSessionData } from "../context/SessionDataContext";
import { PillChip } from "./progress/SegmentedPills";
import { COACH_SPECIALTY_KEYS, specialtyI18nKey, type CoachSpecialtyKey } from "../lib/coachSpecialties";
import { findCountry } from "../lib/countries";
import {
  acceptRequest,
  declineRequest,
  fetchIncomingRequests,
  fetchMyFriends,
  type Friend,
  type FriendRequest,
} from "../lib/friendsApi";
import { FriendRequestCard } from "../components/FriendRequestCard";
import { ClubRequestCard } from "../components/ClubRequestCard";
import { ClubBannerImage } from "../components/ClubBannerImage";
import { ClubPfpImage } from "../components/ClubPfpImage";
import { profileImageSource } from "../lib/defaultProfilePicture";
import { resolveUploadUrl } from "../lib/mediaUrl";
import {
  acceptClubInvite,
  declineClubInvite,
  fetchClubInvites,
  fetchClubs,
  clubBannerUri,
  clubLogoUri,
  type ClubInvite,
  type ClubSummary,
} from "../lib/clubsApi";
import { fetchCoachCards, type CoachCard } from "../lib/coachDirectoryApi";
import { fetchMyFollows } from "../lib/followsApi";
import { specialtyLabels } from "../lib/coachSpecialties";
import { TEST_IDS } from "../lib/testIds";
import { FriendsRankingView, type FriendsRankingScope } from "../components/ranking/FriendsRankingView";
import type { RankedCountry, RankedPlayer } from "../lib/rankingApi";
import { useTranslation } from "react-i18next";

type InviteSegment = "friends" | "coaches" | "clubs";
type FriendsView = "mine" | "requests" | "ranking";
type CoachFilter = "all" | "pro" | "nearby";
type CoachSort = "relevance" | "rating" | "name";
type ClubFilter = "all" | "near" | "courts";
type RequestSort = "newest" | "oldest";

const ERROR_TOAST_MS = 3500;

function clubCityLabel(club: ClubSummary): string | null {
  return [club.city, club.country].filter(Boolean).join(", ") || null;
}

const PLACEHOLDER = "rgba(255, 255, 255, 0.85)";

/** CClub banners 370×160 */
const CLUB_BANNER_ASPECT = 160 / 370;
const CLUB_AVATAR = 56;

function matchesQuery(query: string, fields: Array<string | null | undefined>): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => field?.toLowerCase().includes(needle));
}

type InviteSearchNav = NativeStackNavigationProp<MainStackParamList, "InviteSearch">;
type InviteSearchRoute = RouteProp<MainStackParamList, "InviteSearch">;

export function InviteFriendScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<InviteSearchNav>();
  const route = useRoute<InviteSearchRoute>();
  const { theme } = useContext(ThemeContext);
  const { width: winW } = useWindowDimensions();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { profileAreaLocation } = useSessionData();

  const [segment, setSegment] = useState<InviteSegment>("friends");
  const [friendsView, setFriendsView] = useState<FriendsView>(route.params?.friendsView ?? "mine");
  const [coachFilter, setCoachFilter] = useState<CoachFilter>("all");
  const [sort, setSort] = useState<CoachSort>("relevance");
  const [sortOpen, setSortOpen] = useState(false);
  const [clubFilter, setClubFilter] = useState<ClubFilter>("all");
  const [clubCity, setClubCity] = useState<string | null>(null);
  const [cityOpen, setCityOpen] = useState(false);
  const [coachSpecialty, setCoachSpecialty] = useState<CoachSpecialtyKey | null>(null);
  const [specialtyOpen, setSpecialtyOpen] = useState(false);
  const [query, setQuery] = useState("");
  /** Friends › Ranking scope and filter; kept here so they survive My Friends / Requests and back. */
  const [rankingScope, setRankingScope] = useState<FriendsRankingScope>("world");
  const [rankingFriendsOnly, setRankingFriendsOnly] = useState(false);

  const [clubs, setClubs] = useState<ClubSummary[] | null>(null);
  const [coaches, setCoaches] = useState<CoachCard[] | null>(null);
  const [friends, setFriends] = useState<Friend[] | null>(null);

  /** Pending incoming friend requests (server order: newest first). */
  const [requests, setRequests] = useState<FriendRequest[] | null>(null);
  /** Accepted on this screen; kept only while the Requests view stays open. */
  const [recentAccepted, setRecentAccepted] = useState<FriendRequest[]>([]);
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const [requestSort, setRequestSort] = useState<RequestSort>("newest");
  const [requestSortOpen, setRequestSortOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestsRef = useRef<FriendRequest[] | null>(null);
  requestsRef.current = requests;

  /** Pending club invites (newest first), plus the ones accepted while Requests stays open. */
  const [clubInvites, setClubInvites] = useState<ClubInvite[] | null>(null);
  /** Accepted club invites keep their card (with the Accepted pill) until Requests is left. */
  const [acceptedClubInvites, setAcceptedClubInvites] = useState<Map<string, ClubInvite>>(() => new Map());

  const myCountry = useMemo(() => findCountry(profileAreaLocation)?.code ?? null, [profileAreaLocation]);

  const visibleCoaches = useMemo(() => {
    if (coaches == null) return null;
    const needle = query.trim().toLowerCase();
    const list = coaches.filter((coach) => {
      if (!matchesQuery(query, [coach.name, coach.username, coach.areaLocation])) return false;
      if (coachSpecialty && !coach.specialties.includes(coachSpecialty)) return false;
      // PRO Trainers: the medal-tier coaches (gold / silver / bronze, the best rated).
      if (coachFilter === "pro") return coach.tier !== "blue";
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
    // Relevance: names that start with the query first, then coaches you follow, then the best rated.
    return list.sort((a, b) => {
      if (needle) {
        const sa = a.name.toLowerCase().startsWith(needle) ? 0 : 1;
        const sb = b.name.toLowerCase().startsWith(needle) ? 0 : 1;
        if (sa !== sb) return sa - sb;
      }
      if (a.following !== b.following) return a.following ? -1 : 1;
      return byRating(a, b);
    });
  }, [coaches, query, coachFilter, coachSpecialty, myCountry, sort]);

  const visibleFriends = useMemo(() => {
    if (friends == null) return null;
    return friends.filter((f) => matchesQuery(query, [f.name, f.username, f.areaLocation]));
  }, [friends, query]);

  const clubCities = useMemo(() => {
    const set = new Set<string>();
    for (const c of clubs ?? []) {
      const label = clubCityLabel(c);
      if (label) set.add(label);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [clubs]);

  const visibleClubs = useMemo(() => {
    if (clubs == null) return null;
    const list = clubs.filter((club) => {
      const country = findCountry(club.country ?? "");
      if (
        !matchesQuery(query, [club.name, club.city, club.country, country?.name, club.region, club.address])
      )
        return false;
      if (clubCity && clubCityLabel(club) !== clubCity) return false;
      if (clubFilter === "near") return myCountry != null && country?.code === myCountry;
      return true;
    });
    if (clubFilter === "courts") list.sort((a, b) => b.courts.length - a.courts.length);
    return list;
  }, [clubs, query, clubFilter, clubCity, myCountry]);

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

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), ERROR_TOAST_MS);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const loadRequests = useCallback(async () => {
    const [friendResult, clubResult] = await Promise.allSettled([fetchIncomingRequests(), fetchClubInvites()]);
    if (friendResult.status === "fulfilled") setRequests(friendResult.value);
    else setRequests((prev) => prev ?? []);
    if (clubResult.status === "fulfilled") setClubInvites(clubResult.value);
    else setClubInvites((prev) => prev ?? []);
  }, []);

  const refreshFriends = useCallback(() => {
    void fetchMyFriends().then(setFriends);
  }, []);

  // Results handed back by the detail screen: show the accepted card under "Recent request".
  const acceptedParam = route.params?.acceptedRequestId;
  const removedParam = route.params?.removedRequestId;
  const viewParam = route.params?.friendsView;
  useEffect(() => {
    if (!acceptedParam && !removedParam && !viewParam) return;
    if (viewParam) {
      setSegment("friends");
      setFriendsView(viewParam);
    }
    const current = requestsRef.current ?? [];
    if (acceptedParam) {
      const card = current.find((r) => r.id === acceptedParam);
      if (card) setRecentAccepted((prev) => (prev.some((r) => r.id === card.id) ? prev : [card, ...prev]));
      refreshFriends();
    }
    const gone = new Set([acceptedParam, removedParam].filter(Boolean));
    if (gone.size) setRequests((prev) => (prev ? prev.filter((r) => !gone.has(r.id)) : prev));
    navigation.setParams({ acceptedRequestId: undefined, removedRequestId: undefined, friendsView: undefined });
  }, [acceptedParam, removedParam, viewParam, navigation, refreshFriends]);

  // Requests (and the badge) refresh whenever the screen gains focus.
  useFocusEffect(
    useCallback(() => {
      void loadRequests();
    }, [loadRequests]),
  );

  const sortedRequests = useMemo(() => {
    if (requests == null) return null;
    const byTime = (a: FriendRequest, b: FriendRequest) => Date.parse(b.createdAt) - Date.parse(a.createdAt);
    return [...requests].sort((a, b) => (requestSort === "newest" ? byTime(a, b) : byTime(b, a)));
  }, [requests, requestSort]);

  const pendingCount = requests?.length ?? 0;
  const pendingClubCount = clubInvites?.length ?? 0;

  /** Pending invites plus accepted ones, newest first, so an accepted card stays where it was. */
  const clubCards = useMemo(() => {
    const pending = (clubInvites ?? []).filter((inv) => !acceptedClubInvites.has(inv.id));
    const all = [...pending, ...acceptedClubInvites.values()];
    return all.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id));
  }, [clubInvites, acceptedClubInvites]);

  const setBusy = useCallback((id: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  /** Optimistic: the card moves to "Recent request" at once and goes back if the call fails. */
  const onAcceptRequest = useCallback(
    async (req: FriendRequest) => {
      setBusy(req.id, true);
      setRequests((prev) => (prev ? prev.filter((r) => r.id !== req.id) : prev));
      setRecentAccepted((prev) => [req, ...prev.filter((r) => r.id !== req.id)]);
      try {
        await acceptRequest(req.id);
        refreshFriends();
      } catch {
        setRecentAccepted((prev) => prev.filter((r) => r.id !== req.id));
        setRequests((prev) => (prev && !prev.some((r) => r.id === req.id) ? [...prev, req] : prev));
        showToast(t("friends.actionFailed"));
      } finally {
        setBusy(req.id, false);
      }
    },
    [refreshFriends, setBusy, showToast, t],
  );

  /** Optimistic: the card disappears at once and comes back if the call fails. */
  const onDeclineRequest = useCallback(
    async (req: FriendRequest) => {
      setBusy(req.id, true);
      setRequests((prev) => (prev ? prev.filter((r) => r.id !== req.id) : prev));
      try {
        await declineRequest(req.id);
      } catch {
        setRequests((prev) => (prev && !prev.some((r) => r.id === req.id) ? [...prev, req] : prev));
        showToast(t("friends.actionFailed"));
      } finally {
        setBusy(req.id, false);
      }
    },
    [setBusy, showToast, t],
  );

  const restoreClubInvite = useCallback((inv: ClubInvite) => {
    setClubInvites((prev) => (prev && !prev.some((x) => x.id === inv.id) ? [...prev, inv] : prev));
  }, []);

  /** Optimistic: the card shows Accepted (+1 member) at once and goes back if the call fails. */
  const onAcceptClubInvite = useCallback(
    async (inv: ClubInvite) => {
      setBusy(inv.id, true);
      setClubInvites((prev) => (prev ? prev.filter((x) => x.id !== inv.id) : prev));
      const optimistic = { ...inv, club: { ...inv.club, memberCount: inv.club.memberCount + 1 } };
      setAcceptedClubInvites((prev) => new Map(prev).set(inv.id, optimistic));
      try {
        const result = await acceptClubInvite(inv.id);
        if (typeof result?.memberCount === "number") {
          setAcceptedClubInvites((prev) =>
            prev.has(inv.id)
              ? new Map(prev).set(inv.id, { ...inv, club: { ...inv.club, memberCount: result.memberCount } })
              : prev,
          );
        }
        setClubs((prev) =>
          prev && typeof result?.memberCount === "number"
            ? prev.map((c) => (c.id === inv.club.id ? { ...c, memberCount: result.memberCount } : c))
            : prev,
        );
      } catch {
        setAcceptedClubInvites((prev) => {
          const next = new Map(prev);
          next.delete(inv.id);
          return next;
        });
        restoreClubInvite(inv);
        showToast(t("clubMembership.actionFailed"));
      } finally {
        setBusy(inv.id, false);
      }
    },
    [restoreClubInvite, setBusy, showToast, t],
  );

  /** Optimistic: the card disappears at once and comes back if the call fails. */
  const onDeclineClubInvite = useCallback(
    async (inv: ClubInvite) => {
      setBusy(inv.id, true);
      setClubInvites((prev) => (prev ? prev.filter((x) => x.id !== inv.id) : prev));
      try {
        await declineClubInvite(inv.id);
      } catch {
        restoreClubInvite(inv);
        showToast(t("clubMembership.actionFailed"));
      } finally {
        setBusy(inv.id, false);
      }
    },
    [restoreClubInvite, setBusy, showToast, t],
  );

  // A follow made on the coach detail screen shows here when the user comes back.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void fetchMyFollows().then(({ coaches: followed }) => {
        if (cancelled) return;
        const set = new Set(followed);
        setCoaches((prev) =>
          prev == null
            ? prev
            : prev.map((c) => (c.following === set.has(c.id) ? c : { ...c, following: set.has(c.id) })),
        );
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  /** Club card: page padding 20 each side, 1px border each side. */
  const cardW = winW - 42;
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

  function onFriendsView(view: FriendsView) {
    // Accepted cards only live while the Requests view stays open.
    if (view !== friendsView) clearAcceptedCards();
    setFriendsView(view);
  }

  function onSegment(next: InviteSegment) {
    if (next !== segment) clearAcceptedCards();
    setSegment(next);
  }

  function openRankedPlayer(p: RankedPlayer) {
    navigation.navigate("LeaderboardPlayer", {
      userId: p.userId,
      name: p.name,
      image: p.image,
      areaLocation: [p.city, p.countryName].filter(Boolean).join(", ") || null,
      totalXp: p.totalXp,
      rank: p.rank,
      overallScore: p.rating,
    });
  }

  function openRankedCountry(c: RankedCountry) {
    navigation.navigate("CountryRanking", { code: c.code, name: c.name });
  }

  function clearAcceptedCards() {
    setRecentAccepted([]);
    setAcceptedClubInvites((prev) => (prev.size ? new Map() : prev));
  }

  const screenBg = theme.backgroundColor ?? "#030A17";
  const showCoachMeta = segment === "coaches" && visibleCoaches != null;

  const coachesBody =
    visibleCoaches == null ? (
      <ActivityIndicator style={styles.listLoading} color={UI.accent} />
    ) : visibleCoaches.length === 0 ? (
      <Text style={styles.emptyListText}>
        {coaches != null && coaches.length === 0
          ? t("inviteExtra.noCoaches")
          : coachFilter === "nearby" && !query.trim() && !coachSpecialty
            ? t("inviteExtra.noNearbyCoaches")
            : coachFilter === "pro" || coachSpecialty
            ? t("inviteExtra.noCoachesFilter")
            : t("inviteExtra.noCoachesMatch")}
      </Text>
    ) : (
      <View style={styles.cardList}>
        {visibleCoaches.map((coach) => (
          <PersonCard
            key={coach.id}
            variant="coach"
            testID={TEST_IDS.coachCard(coach.id)}
            name={coach.name}
            imageUri={coach.imageUri}
            subtitle={t("inviteExtra.coachSubtitle")}
            location={coach.areaLocation}
            verified
            tier={coach.tier}
            chips={specialtyLabels(coach.specialties, t)}
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

  const requestSortLabels: Record<RequestSort, string> = {
    newest: t("friends.sortNewest"),
    oldest: t("friends.sortOldest"),
  };

  const recentSection =
    recentAccepted.length > 0 ? (
      <View style={styles.requestSection} testID="recent-requests">
        <Text allowFontScaling={false} style={styles.sectionTitle}>
          {t("friends.recentRequest")}
        </Text>
        <View style={styles.sectionCards}>
          {recentAccepted.map((req) => (
            <FriendRequestCard
              key={req.id}
              request={req}
              state="accepted"
            />
          ))}
        </View>
      </View>
    ) : null;

  /** Friend Requests section. add-club-memberships stacks a Club Requests section under it. */
  const friendRequestsSection =
    sortedRequests == null ? (
      <ActivityIndicator style={styles.listLoading} color={UI.accent} />
    ) : sortedRequests.length === 0 ? (
      recentAccepted.length === 0 ? (
        <Text style={styles.emptyListText} testID="friend-requests-empty">
          {t("friends.noRequests")}
        </Text>
      ) : null
    ) : (
      <View style={styles.requestSection} testID="friend-requests">
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text allowFontScaling={false} style={styles.sectionTitle}>
              {t("friends.friendRequests")}
            </Text>
            <View style={styles.countBadge} testID="friend-requests-count">
              <Text allowFontScaling={false} style={styles.countBadgeText}>
                {pendingCount}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.sortBtn}
            onPress={() => setRequestSortOpen(true)}
            hitSlop={8}
            testID="friend-requests-sort"
            accessibilityRole="button"
          >
            <Text allowFontScaling={false} style={styles.metaText}>
              {t("friends.sortLabel", { sort: requestSortLabels[requestSort] })}
            </Text>
            <Ionicons name="chevron-down" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.sectionCards}>
          {sortedRequests.map((req) => (
            <FriendRequestCard
              key={req.id}
              request={req}
              state={busyIds.has(req.id) ? "busy" : "pending"}
              onOpen={() => navigation.navigate("FriendRequestDetail", { requestId: req.id })}
              onAccept={() => void onAcceptRequest(req)}
              onDecline={() => void onDeclineRequest(req)}
            />
          ))}
        </View>
      </View>
    );

  /** Club Requests: shown only while there are pending (or just-accepted) club invites. */
  const clubRequestsSection =
    clubCards.length > 0 ? (
      <View style={styles.requestSection} testID="club-requests">
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text allowFontScaling={false} style={styles.sectionTitle}>
              {t("clubMembership.clubRequests")}
            </Text>
            {pendingClubCount > 0 ? (
              <View style={styles.countBadge} testID="club-requests-count">
                <Text allowFontScaling={false} style={styles.countBadgeText}>
                  {pendingClubCount}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.sectionCards}>
          {clubCards.map((inv) => (
            <ClubRequestCard
              key={inv.id}
              invite={inv}
              state={acceptedClubInvites.has(inv.id) ? "accepted" : busyIds.has(inv.id) ? "busy" : "pending"}
              onOpen={() => navigation.navigate("ClubDetail", { clubId: inv.club.slug })}
              onAccept={() => void onAcceptClubInvite(inv)}
              onDecline={() => void onDeclineClubInvite(inv)}
            />
          ))}
        </View>
      </View>
    ) : null;

  const requestsBody = (
    <View>
      {recentSection}
      {friendRequestsSection}
      {clubRequestsSection}
    </View>
  );

  const friendsBody =
    friendsView === "requests" ? (
      requestsBody
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
            subtitle={
              f.relation === "coach"
                ? t("inviteExtra.yourCoach")
                : f.relation === "student"
                  ? t("inviteExtra.yourStudent")
                  : t("friends.yourFriend")
            }
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
        {clubs != null && clubs.length === 0
          ? t("inviteExtra.noClubs")
          : clubFilter === "near" && !query.trim() && !clubCity
            ? t("inviteExtra.noNearbyClubs")
            : t("inviteExtra.noClubsMatch")}
      </Text>
    ) : (
      <View style={styles.cardList}>
        {visibleClubs.map((club) => {
          const place = [club.city, club.region, findCountry(club.country ?? "")?.name ?? club.country]
            .filter(Boolean)
            .join(", ");
          return (
            <TouchableOpacity
              key={club.id}
              activeOpacity={0.9}
              style={styles.clubCard}
              onPress={() => navigation.navigate("ClubDetail", { clubId: club.slug })}
              accessibilityRole="button"
              accessibilityLabel={club.name}
            >
              <View style={styles.clubBanner}>
                <ClubBannerImage uri={clubBannerUri(club)} width={cardW} height={bannerH} />
                {club.courts.length > 0 ? (
                  <View style={styles.bannerPill}>
                    <Ionicons name="tennisball-outline" size={13} color="#FFFFFF" />
                    <Text allowFontScaling={false} style={styles.bannerPillText}>
                      {club.courts.length === 1
                        ? t("inviteExtra.oneCourt")
                        : t("inviteExtra.courts", { count: club.courts.length })}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.clubProfileRow}>
                <View style={styles.clubLogoRing}>
                  <ClubPfpImage uri={clubLogoUri(club)} size={CLUB_AVATAR} fallbackLabel={club.name} />
                </View>
                <View style={styles.clubTextCol}>
                  <Text style={styles.clubTitle} numberOfLines={2}>
                    {club.name}
                  </Text>
                  {place ? (
                    <View style={styles.clubPlaceRow}>
                      <Ionicons name="location-outline" size={15} color={CLUB_MUTED} />
                      <Text style={styles.clubSubtitle} numberOfLines={1}>
                        {place}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.clubPlaceRow}>
                    <Ionicons name="people-outline" size={14} color={UI.textMuted} />
                    <Text style={styles.clubSubtitle} numberOfLines={1} testID={`club-card-members-${club.slug}`}>
                      {t("clubMembership.members", { count: club.memberCount ?? 0 })}
                    </Text>
                  </View>
                </View>
                <View style={styles.clubMembersCol}>
                  <MemberStack
                    members={club.memberPreview ?? []}
                    total={club.memberCount ?? 0}
                    font={theme.mediumFont}
                  />
                  <Text
                    style={styles.clubMembersText}
                    numberOfLines={1}
                    testID={`club-card-members-${club.slug}`}
                  >
                    {t("clubMembership.members", { count: club.memberCount ?? 0 })}
                  </Text>
                </View>
              </View>
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
                onPress={() => onSegment(key)}
                style={styles.segmentPill}
                textStyle={styles.segmentLabel}
                role="tab"
                testID={TEST_IDS.inviteSegment(key)}
              />
            ))}
          </View>

          {segment === "friends" ? (
            <View style={styles.subTabs}>
              <SegmentedToggle<FriendsView>
                options={[
                  { value: "mine", label: t("inviteExtra.myFriends"), testID: "friends-mine-tab" },
                  { value: "requests", label: t("inviteExtra.requests"), badge: pendingCount + pendingClubCount, testID: "friends-requests-tab" },
                  { value: "ranking", label: t("inviteExtra.ranking"), testID: "friends-ranking-tab" },
                ]}
                value={friendsView}
                onChange={onFriendsView}
              />
            </View>
          ) : null}

          {segment === "friends" && friendsView !== "mine" ? null : (
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
          )}

          {segment === "coaches" ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.coachChipScroll}
              contentContainerStyle={styles.coachChipRow}
            >
              {(
                [
                  { key: "all", label: t("inviteExtra.allCoaches") },
                  { key: "pro", label: t("inviteExtra.proTrainers") },
                  { key: "nearby", label: t("inviteExtra.nearby") },
                ] as const
              ).map(({ key, label }) => (
                <Pill
                  key={key}
                  label={label}
                  active={coachFilter === key}
                  onPress={() => setCoachFilter(key)}
                  style={styles.coachChip}
                  textStyle={styles.coachChipLabel}
                  testID={`coach-filter-${key}`}
                  filter
                />
              ))}
              <DropdownChip
                label={coachSpecialty ? t(specialtyI18nKey(coachSpecialty)) : t("inviteExtra.speciality")}
                active={coachSpecialty != null}
                onPress={() => setSpecialtyOpen(true)}
                style={styles.coachChip}
                textStyle={styles.coachChipLabel}
                testID="coach-filter-specialty"
                filter
              />
            </ScrollView>
          ) : null}

          {segment === "clubs" ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {(
                [
                  { key: "all", label: t("inviteExtra.allClubs") },
                  { key: "near", label: t("inviteExtra.nearMe") },
                  { key: "courts", label: t("inviteExtra.mostCourts") },
                ] as const
              ).map(({ key, label }) => (
                <Pill
                  key={key}
                  label={label}
                  active={clubFilter === key}
                  onPress={() => setClubFilter(key)}
                  style={styles.chip}
                  textStyle={styles.chipLabel}
                />
              ))}
              {clubCities.length > 0 ? (
                <DropdownChip
                  icon="location-outline"
                  label={clubCity ?? t("inviteExtra.anyCity")}
                  active={clubCity != null}
                  onPress={() => setCityOpen(true)}
                  style={styles.chip}
                  textStyle={styles.chipLabel}
                />
              ) : null}
            </ScrollView>
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

          {segment === "coaches" ? (
            coachesBody
          ) : segment === "clubs" ? (
            clubsBody
          ) : friendsView === "ranking" ? (
            <FriendsRankingView
              scope={rankingScope}
              onScopeChange={setRankingScope}
              friendsOnly={rankingFriendsOnly}
              onFriendsOnlyChange={setRankingFriendsOnly}
              onOpenPlayer={openRankedPlayer}
              onOpenCountry={openRankedCountry}
              onFindClub={() => onSegment("clubs")}
            />
          ) : (
            friendsBody
          )}
        </ScrollView>
        {toast ? (
          <View style={styles.toast} accessibilityRole="alert" testID="friends-toast">
            <Ionicons name="alert-circle" size={18} color={UI.error} />
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
        {segment === "friends" && friendsView === "mine" ? (
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
      <Modal
        visible={requestSortOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRequestSortOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRequestSortOpen(false)} />
          <View style={styles.modalCard}>
            <Text allowFontScaling={false} style={styles.modalTitle}>
              {t("inviteExtra.sortTitle")}
            </Text>
            {(["newest", "oldest"] as const).map((key) => {
              const selected = requestSort === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.modalRow, selected && styles.modalRowActive]}
                  onPress={() => {
                    setRequestSort(key);
                    setRequestSortOpen(false);
                  }}
                  activeOpacity={0.85}
                  testID={`friend-requests-sort-${key}`}
                >
                  <Text style={[styles.modalRowText, selected && styles.modalRowTextActive]}>
                    {requestSortLabels[key]}
                  </Text>
                  {selected ? <Ionicons name="checkmark" size={18} color={UI.accent} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
      <Modal visible={cityOpen} transparent animationType="fade" onRequestClose={() => setCityOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCityOpen(false)} />
          <View style={styles.modalCard}>
            <Text allowFontScaling={false} style={styles.modalTitle}>
              {t("inviteExtra.cityTitle")}
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {[null, ...clubCities].map((city) => {
                const selected = clubCity === city;
                return (
                  <TouchableOpacity
                    key={city ?? "any"}
                    style={[styles.modalRow, selected && styles.modalRowActive]}
                    onPress={() => {
                      setClubCity(city);
                      setCityOpen(false);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.modalRowText, selected && styles.modalRowTextActive]}>
                      {city ?? t("inviteExtra.anyCity")}
                    </Text>
                    {selected ? <Ionicons name="checkmark" size={18} color={UI.accent} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={specialtyOpen} transparent animationType="fade" onRequestClose={() => setSpecialtyOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSpecialtyOpen(false)} />
          <View style={styles.modalCard}>
            <Text allowFontScaling={false} style={styles.modalTitle}>
              {t("inviteExtra.speciality")}
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {[null, ...COACH_SPECIALTY_KEYS].map((key) => {
                const selected = coachSpecialty === key;
                return (
                  <TouchableOpacity
                    key={key ?? "any"}
                    style={[styles.modalRow, selected && styles.modalRowActive]}
                    onPress={() => {
                      setCoachSpecialty(key);
                      setSpecialtyOpen(false);
                    }}
                    activeOpacity={0.85}
                    testID={`coach-specialty-${key ?? "any"}`}
                  >
                    <Text style={[styles.modalRowText, selected && styles.modalRowTextActive]}>
                      {key ? t(specialtyI18nKey(key)) : t("inviteExtra.anySpeciality")}
                    </Text>
                    {selected ? <Ionicons name="checkmark" size={18} color={UI.accent} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <MainTabBarChrome />
    </View>
  );
}

const CLUB_MUTED = "#86A7D2";
const FACE = 30;

/** Club card (design): up to three member faces overlapping, then a "+N" bubble for the rest. */
function MemberStack({
  members,
  total,
  font,
}: {
  members: { userId: string; image: string | null }[];
  total: number;
  font?: string;
}) {
  const rest = Math.max(0, total - members.length);
  if (members.length === 0 && rest === 0) return null;
  return (
    <View style={memberStyles.row}>
      {members.map((m, i) => (
        <Image
          key={m.userId}
          source={profileImageSource(resolveUploadUrl(m.image))}
          style={[memberStyles.face, i > 0 && memberStyles.overlap]}
        />
      ))}
      {rest > 0 ? (
        <View style={[memberStyles.face, memberStyles.more, members.length > 0 && memberStyles.overlap]}>
          <Text allowFontScaling={false} style={[memberStyles.moreText, { fontFamily: font }]}>
            +{rest > 99 ? "99" : rest}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const memberStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  face: { width: FACE, height: FACE, borderRadius: FACE / 2, borderWidth: 2, borderColor: "#8C9BE8" },
  overlap: { marginLeft: -9 },
  more: { backgroundColor: "#141E6B", borderColor: "#141E6B", alignItems: "center", justifyContent: "center" },
  moreText: { color: "#C9D3F5", fontSize: 11 },
});

/** Top tabs and filter chips: the shared PillChip (same look as every other pill tab). */
function Pill(props: {
  label: string;
  active: boolean;
  onPress: () => void;
  style: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
  role?: "tab" | "button";
  testID?: string;
  /** Coach filters (design): Inter 600 throughout, #07256D label when active. */
  filter?: boolean;
}) {
  const { theme } = useContext(ThemeContext);
  const { filter, ...rest } = props;
  return (
    <PillChip
      {...rest}
      fontFamily={filter ? theme.semiBoldFont : theme.mediumFont}
      activeFontFamily={theme.semiBoldFont}
      activeTextColor={filter ? FILTER_ACTIVE_TEXT : undefined}
    />
  );
}

const FILTER_ACTIVE_TEXT = "#07256D";

/** Filter chip that opens a picker: label + chevron, same colours as the other pills. */
function DropdownChip({
  label,
  active,
  onPress,
  style,
  textStyle,
  icon,
  testID,
  filter,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  style: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  testID?: string;
  filter?: boolean;
}) {
  const { theme } = useContext(ThemeContext);
  return (
    <PillChip
      label={label}
      active={active}
      onPress={onPress}
      style={[style, dropdownStyles.row]}
      textStyle={textStyle}
      fontFamily={filter ? theme.semiBoldFont : theme.mediumFont}
      activeFontFamily={theme.semiBoldFont}
      activeTextColor={filter ? FILTER_ACTIVE_TEXT : undefined}
      leading={icon}
      trailing="chevron-down"
      testID={testID}
    />
  );
}

const dropdownStyles = StyleSheet.create({ row: { flexDirection: "row", gap: 6 } });

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
      gap: 15,
      height: 50,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: UI.trackBorder,
      backgroundColor: "rgba(0, 10, 30, 0.6)",
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      fontFamily: theme.regularFont ?? "System",
      fontSize: 13,
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
    /** Coach filters (design): four chips that share one row, never scroll. */
    coachChipScroll: {
      marginTop: 4,
      marginHorizontal: -10,
      flexGrow: 0,
    },
    /** Wide phones: the chips stretch to fill the row. Narrow ones: the row scrolls, labels stay whole. */
    coachChipRow: {
      flexGrow: 1,
      flexDirection: "row",
      gap: 6,
      // Room for the active chip's glow, which the scroll view would otherwise clip.
      paddingVertical: 10,
      paddingHorizontal: 10,
    },
    coachChip: {
      flexGrow: 1,
      flexShrink: 0,
      height: 38,
      paddingHorizontal: 9,
    },
    coachChipLabel: {
      fontFamily: theme.mediumFont ?? "System",
      fontSize: 11,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 8,
    },
    metaText: {
      fontFamily: theme.regularFont ?? "System",
      fontSize: 13,
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
    requestSection: {
      marginTop: 20,
    },
    sectionHeader: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      columnGap: 12,
      rowGap: 6,
    },
    sectionTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexShrink: 1,
    },
    sectionTitle: {
      fontFamily: theme.regularFont ?? "System",
      fontSize: 17,
      color: "#FFFFFF",
    },
    countBadge: {
      minWidth: 24,
      height: 24,
      paddingHorizontal: 6,
      borderRadius: 12,
      backgroundColor: "#3D6BFF",
      alignItems: "center",
      justifyContent: "center",
    },
    countBadgeText: {
      fontFamily: theme.semiBoldFont ?? "System",
      fontSize: 12,
      color: "#FFFFFF",
    },
    sectionCards: {
      marginTop: 12,
      gap: 12,
    },
    toast: {
      position: "absolute",
      left: 20,
      right: 20,
      bottom: 110,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "rgba(255, 107, 122, 0.5)",
      backgroundColor: "#1A0F24",
    },
    toastText: {
      flex: 1,
      color: "#FFFFFF",
      fontFamily: theme.regularFont ?? "System",
      fontSize: 14,
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 96,
    },
    clubCard: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "#07256D",
      backgroundColor: "#030A17",
      overflow: "hidden",
      boxShadow: "0px 0px 20px 0px rgba(0, 72, 255, 0.20), 0px 0px 30px 0px rgba(0, 72, 255, 0.50) inset",
    },
    /** Design: the photo is its own rounded panel at the top of the card. */
    clubBanner: {
      borderRadius: 20,
      overflow: "hidden",
    },
    bannerPill: {
      position: "absolute",
      top: 10,
      left: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      height: 28,
      borderRadius: 10,
      backgroundColor: "rgba(3, 10, 23, 0.75)",
      borderWidth: 1,
      borderColor: UI.surfaceBorder,
    },
    bannerPillText: {
      fontFamily: theme.mediumFont ?? "System",
      fontSize: 12,
      color: "#FFFFFF",
    },
    clubProfileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 15,
      paddingHorizontal: 20,
    },
    clubLogoRing: {
      borderRadius: CLUB_AVATAR / 2 + 3,
      borderWidth: 3,
      borderColor: "#8C9BE8",
    },
    clubMembersCol: {
      alignItems: "flex-start",
      gap: 6,
      flexShrink: 0,
    },
    clubMembersText: {
      fontFamily: theme.regularFont ?? "System",
      fontSize: 11,
      color: CLUB_MUTED,
    },
    clubTextCol: {
      flex: 1,
      minWidth: 0,
      justifyContent: "center",
    },
    clubTitle: {
      fontFamily: theme.regularFont ?? "System",
      fontSize: 18,
      lineHeight: 22,
      color: "#FFFFFF",
    },
    clubPlaceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 4,
    },
    clubSubtitle: {
      fontFamily: theme.regularFont ?? "System",
      fontSize: 13,
      color: CLUB_MUTED,
      flexShrink: 1,
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
