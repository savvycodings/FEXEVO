import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { ThemeContext } from "../context";
import { Header } from "../components/Header";
import { MainTabBarChrome } from "../components/MainTabBarChrome";
import { LocalSvgAsset } from "../components/LocalSvgAsset";
import { ShieldProportionalFrame, fitShieldInBox } from "../components/ShieldProportionalFrame";
import { CARD_GLOW, SELECTED_GLOW, UI } from "../components/ui";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { fetchMyFriends } from "../lib/friendsApi";
import { getCoachDetail, resolveCoachDetail } from "../lib/coach-detail-data";
import {
  fetchPlayerOverallScore,
  fetchPublicPlayerProfile,
} from "../lib/leaderboardPlayerApi";
import { resolveUploadUrl } from "../lib/mediaUrl";
import {
  coachGalleryDisplayUri,
  fetchCoachGalleryPhotos,
  uploadCoachGalleryPhotos,
  type CoachGalleryPhoto,
} from "../lib/coachGalleryApi";
import {
  fetchCoachProfileSections,
  type CoachProfileSection,
} from "../lib/coachProfileSectionsApi";
import type { MainStackParamList, YouTabStackParamList } from "../navigation/types";

const SHARE_ICON_SVG = require("../../assets/coachs/shareicon.svg");
const ADD_PHOTOS_ICON = require("../../assets/youpage/addicon.svg");

const SHARE_ICON_SIZE = 28;
/** Big photo + 2×2 grid, like the design; "See all" shows the rest. */
const GRID_PREVIEW = 5;
const GRID_GAP = 8;

/** First photo large on the left, up to four small ones in a 2×2 grid; extras wrap in rows of three. */
function PhotoGrid({
  items,
  width,
  onOpen,
}: {
  items: GalleryItem[];
  width: number;
  onOpen: (uri: string) => void;
}) {
  if (items.length === 0) return null;
  const [first, ...rest] = items;
  const small = rest.slice(0, 4);
  const extra = rest.slice(4);
  const smallW = small.length > 0 ? (width - GRID_GAP * 2) / 4 : 0;
  const bigW = small.length > 0 ? width - smallW * 2 - GRID_GAP * 2 : width;
  const bigH = small.length > 2 ? smallW * 2 + GRID_GAP : Math.max(smallW, width * 0.5);
  const thumb = (item: GalleryItem, w: number, h: number) => (
    <TouchableOpacity
      key={item.key}
      activeOpacity={0.85}
      onPress={() => onOpen(item.uri)}
      accessibilityRole="button"
      accessibilityLabel="View photo"
    >
      <Image source={{ uri: item.uri }} style={{ width: w, height: h, borderRadius: 10 }} resizeMode="cover" />
    </TouchableOpacity>
  );
  const extraW = (width - GRID_GAP * 2) / 3;
  return (
    <View style={{ gap: GRID_GAP }}>
      <View style={{ flexDirection: "row", gap: GRID_GAP }}>
        {thumb(first!, bigW, bigH)}
        {small.length > 0 ? (
          <View style={{ width: smallW * 2 + GRID_GAP, flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP }}>
            {small.map((item) => thumb(item, smallW, small.length > 2 ? smallW : bigH))}
          </View>
        ) : null}
      </View>
      {extra.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP }}>
          {extra.map((item) => thumb(item, extraW, extraW))}
        </View>
      ) : null}
    </View>
  );
}

type GalleryItem = {
  key: string;
  uri: string;
};

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
type CoachDetailNav = NativeStackNavigationProp<MainStackParamList>;
type YouTabNav = NativeStackNavigationProp<YouTabStackParamList>;

function photosToGalleryItems(photos: CoachGalleryPhoto[]): GalleryItem[] {
  return photos
    .map((p) => {
      const uri = coachGalleryDisplayUri(p.imageUrl);
      if (!uri) return null;
      return { key: p.id, uri };
    })
    .filter((item): item is GalleryItem => item != null);
}

export type CoachDetailViewProps = {
  coachId: string;
  coachName?: string | null;
  coachImageUri?: string | null;
  /**
   * Coach You tab: same body as stack CoachDetail, but no stack Header / back / tab chrome
   * (main tabs already provide those).
   */
  embeddedInYouTab?: boolean;
};

export function CoachDetailView({
  coachId,
  coachName,
  coachImageUri = null,
  embeddedInYouTab = false,
}: CoachDetailViewProps) {
  const navigation = useNavigation<CoachDetailNav>();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const { theme } = useContext(ThemeContext);
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const coach = useMemo(
    () => resolveCoachDetail(coachId, coachName),
    [coachId, coachName]
  );
  /** Known sample coaches (invite flow) keep their static location; live coaches don't. */
  const isSampleCoach = useMemo(() => getCoachDetail(coachId) != null, [coachId]);
  const horizontalPad = Math.max(16, insets.left, insets.right);
  const shieldBox = useMemo(
    () => fitShieldInBox(Math.min(170, (winW - horizontalPad * 2) * 0.42), 230),
    [winW, horizontalPad],
  );
  /** Card inner width: page padding plus the card's own 16px padding on each side. */
  const gridW = winW - horizontalPad * 2 - 32;

  // Live coach profile (name, headline, birth date, location) + overall score.
  const [live, setLive] = useState<LiveCoachProfile | null>(null);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [profileSections, setProfileSections] = useState<CoachProfileSection[]>([]);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [isMyCoach, setIsMyCoach] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchMyFriends().then((friends) => {
      if (!cancelled) setIsMyCoach(friends.some((f) => f.id === coachId && f.relation === "coach"));
    });
    return () => {
      cancelled = true;
    };
  }, [coachId]);

  const reloadGallery = useCallback(async () => {
    const photos = await fetchCoachGalleryPhotos(coachId);
    setGalleryItems(photosToGalleryItems(photos));
  }, [coachId]);

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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const photos = await fetchCoachGalleryPhotos(coachId);
      if (cancelled) return;
      setGalleryItems(photosToGalleryItems(photos));
    })();
    return () => {
      cancelled = true;
    };
  }, [coachId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const sections = await fetchCoachProfileSections(coachId);
        if (!cancelled) setProfileSections(sections);
      })();
      return () => {
        cancelled = true;
      };
    }, [coachId])
  );

  const displayName = live?.name?.trim() || coach?.displayName || coachName?.trim() || "";
  const displayLegalName = live?.name?.trim() || coach?.fullLegalName || displayName;
  // The public headline is a player's level; a coach's page uses the coach headline instead.
  const displayHeadline = isSampleCoach ? coach?.headline ?? "" : "";
  const displayLocation =
    live?.areaLocation?.trim() || (isSampleCoach ? coach?.locationDisplay ?? "" : "");
  const displayImage = coachImageUri ?? live?.imageUri ?? null;
  const displayScore = live?.score ?? null;

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

  /** No in-app coaching request exists yet; send the coach a note through the share sheet. */
  const onAskToCoach = useCallback(async () => {
    try {
      await Share.share({ message: t("coachProfile.askMessage", { name: displayName }) });
    } catch {
      /* dismissed */
    }
  }, [t, displayName]);

  const onAddPhotos = useCallback(async () => {
    if (galleryUploading) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert(
        "Photo access needed",
        "Allow photo library access to add images to your gallery."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.9,
      selectionLimit: 8,
    });

    if (result.canceled || !result.assets?.length) return;

    const uris = result.assets
      .map((a) => a.uri)
      .filter((u): u is string => typeof u === "string" && u.length > 0);

    if (uris.length === 0) return;

    setGalleryUploading(true);
    try {
      const uploaded = await uploadCoachGalleryPhotos(uris);
      if (uploaded.length > 0) {
        setGalleryItems((prev) => {
          const next = [...prev];
          for (const photo of photosToGalleryItems(uploaded)) {
            if (!next.some((item) => item.key === photo.key)) next.push(photo);
          }
          return next;
        });
      } else {
        await reloadGallery();
      }
    } catch {
      Alert.alert("Upload failed", "Could not upload photos. Please try again.");
    } finally {
      setGalleryUploading(false);
    }
  }, [galleryUploading, reloadGallery]);

  const onAddParagraph = useCallback(() => {
    (navigation as unknown as YouTabNav).navigate("CoachProfileSectionEdit");
  }, [navigation]);

  if (!coach) {
    if (embeddedInYouTab) {
      return (
        <View style={[styles.fallback, { paddingHorizontal: horizontalPad, flex: 1 }]}>
          <Text style={styles.fallbackText}>Coach profile unavailable</Text>
        </View>
      );
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
        message: displayLocation ? `${displayLegalName}\n${displayLocation}` : displayLegalName,
      });
    } catch {
      /* dismissed */
    }
  }

  const body = (
    <ScrollView
      key={detail.id}
      style={styles.scroll}
      contentContainerStyle={[
        styles.scrollInner,
        { paddingHorizontal: horizontalPad },
        embeddedInYouTab ? { paddingBottom: 28 } : null,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      <View style={[styles.topActionRow, embeddedInYouTab && styles.topActionRowEmbedded]}>
        {embeddedInYouTab ? (
          <View style={styles.topActionSpacer} />
        ) : (
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
        )}
        <TouchableOpacity
          onPress={() => void onShare()}
          style={styles.shareBtn}
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

      <View style={styles.heroRow}>
        <ShieldProportionalFrame
          maxWidth={shieldBox.width}
          maxHeight={shieldBox.height}
          variant="small"
          coachName={displayName}
          coachImageUri={displayImage}
          flagCode={(displayLocation || null) as never}
          showName={false}
          showScore
          scoreLabel={t("common.score")}
          scoreValue={displayScore != null ? String(displayScore) : "—"}
          showFlag
          showCrest={false}
          showPillarScores={false}
        />
        <View style={styles.heroText}>
          <View style={styles.heroNameRow}>
            <Text style={styles.heroName} numberOfLines={2}>
              {displayName}
            </Text>
            <Ionicons name="checkmark-circle" size={20} color={UI.accentStrong} />
          </View>
          <Text style={styles.heroHeadline} numberOfLines={2}>
            {displayHeadline || t("coachProfile.defaultHeadline")}
          </Text>
          {displayLocation ? (
            <View style={styles.heroLocation}>
              <Ionicons name="location-outline" size={16} color={UI.textMuted} />
              <Text style={styles.heroLocationText} numberOfLines={1}>
                {displayLocation}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {!embeddedInYouTab ? (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnFilled]}
            activeOpacity={0.85}
            onPress={isMyCoach ? onOpenMessage : () => void onAskToCoach()}
            accessibilityRole="button"
          >
            <LinearGradient
              colors={UI.gradient}
              locations={UI.gradientLocations}
              start={UI.gradientStart}
              end={UI.gradientEnd}
              style={[StyleSheet.absoluteFill, styles.actionBtnFill]}
            />
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.actionBtnFill, SELECTED_GLOW]} />
            <Ionicons name={isMyCoach ? "checkmark-circle-outline" : "calendar-outline"} size={18} color="#FFFFFF" />
            <Text style={styles.actionBtnTextFilled} numberOfLines={1}>
              {isMyCoach ? t("coachProfile.yourCoach") : t("coachProfile.beMyCoach")}
            </Text>
          </TouchableOpacity>
          {isMyCoach ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnOutline]}
              activeOpacity={0.85}
              onPress={onOpenMessage}
              accessibilityRole="button"
            >
              <Ionicons name="chatbox-outline" size={18} color={UI.textMuted} />
              <Text style={styles.actionBtnTextOutline} numberOfLines={1}>
                {t("coachProfile.message")}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {profileSections.map((section) => (
        <View key={section.id} style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="document-text-outline" size={20} color={UI.textMuted} />
            <Text style={styles.cardTitle}>{section.heading}</Text>
          </View>
          <Text style={styles.cardBody}>{section.body}</Text>
        </View>
      ))}

      {displayLocation ? (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="calendar-outline" size={20} color={UI.textMuted} />
            <Text style={styles.cardTitle}>{t("coachProfile.location")}</Text>
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={22} color={UI.textMuted} />
            <Text style={styles.locationText}>{displayLocation}</Text>
          </View>
        </View>
      ) : null}

      {galleryItems.length > 0 || embeddedInYouTab ? (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="images-outline" size={20} color={UI.textMuted} />
            <Text style={[styles.cardTitle, { flex: 1 }]}>{t("coachProfile.photos")}</Text>
            {galleryItems.length > GRID_PREVIEW ? (
              <TouchableOpacity style={styles.seeAll} onPress={() => setShowAllPhotos((v) => !v)} hitSlop={8}>
                <Text style={styles.seeAllText}>
                  {showAllPhotos ? t("coachProfile.showLess") : t("coachProfile.seeAll")}
                </Text>
                <Ionicons name={showAllPhotos ? "chevron-up" : "chevron-forward"} size={14} color={UI.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
          <PhotoGrid
            items={showAllPhotos ? galleryItems : galleryItems.slice(0, GRID_PREVIEW)}
            width={gridW}
            onOpen={setViewerUri}
          />
          {embeddedInYouTab ? (
            <TouchableOpacity
              style={styles.addPhotosRow}
              activeOpacity={0.85}
              onPress={() => void onAddPhotos()}
              disabled={galleryUploading}
              accessibilityRole="button"
              accessibilityLabel="Add Photos"
            >
              {galleryUploading ? (
                <ActivityIndicator size="small" color={ACCENT} />
              ) : (
                <LocalSvgAsset assetModule={ADD_PHOTOS_ICON} width={24} height={24} />
              )}
              <Text style={styles.addPhotosText}>
                {galleryUploading ? "Uploading…" : "Add Photos"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {embeddedInYouTab ? (
        <TouchableOpacity
          style={styles.addParagraphRow}
          activeOpacity={0.85}
          onPress={onAddParagraph}
          accessibilityRole="button"
          accessibilityLabel="Add Paragraph"
        >
          <LocalSvgAsset assetModule={ADD_PHOTOS_ICON} width={24} height={24} />
          <Text style={styles.addParagraphText}>Add Paragraph</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );

  const photoViewer = (
    <Modal
      visible={viewerUri != null}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={() => setViewerUri(null)}
    >
      <View style={[styles.viewerRoot, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.viewerBack}
          onPress={() => setViewerUri(null)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          <Text style={styles.viewerBackLabel}>Back</Text>
        </TouchableOpacity>
        {viewerUri ? (
          <Image
            source={{ uri: viewerUri }}
            style={{ width: winW, height: Math.max(240, winH - insets.top - 72) }}
            resizeMode="contain"
          />
        ) : null}
      </View>
    </Modal>
  );

  if (embeddedInYouTab) {
    return (
      <View style={styles.root}>
        {body}
        {photoViewer}
      </View>
    );
  }

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
      {body}
      <MainTabBarChrome />
      {photoViewer}
    </View>
  );
}

export function CoachDetailScreen() {
  const route = useRoute<CoachDetailRoute>();
  return (
    <CoachDetailView
      coachId={route.params.coachId}
      coachName={route.params.coachName}
      coachImageUri={route.params.coachImageUri ?? null}
    />
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
      marginTop: 8,
      marginBottom: 4,
    },
    topActionRowEmbedded: {
      marginTop: 0,
    },
    topActionSpacer: {
      flex: 1,
    },
    shareBtn: {
      // Bridge topActionRow height + margins so share top lines up with badge top.
      // Visual-only; layout box stays put so badge/score don't shift.
      transform: [{ translateY: 32 }],
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
    heroRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginTop: 8,
    },
    heroText: { flex: 1, minWidth: 0, gap: 6 },
    heroNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    heroName: {
      color: "#FFFFFF",
      fontFamily: theme.semiBoldFont ?? "System",
      fontSize: 21,
      flexShrink: 1,
    },
    heroHeadline: {
      color: UI.textMuted,
      fontFamily: theme.regularFont ?? "System",
      fontSize: 14,
    },
    heroLocation: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
    heroLocationText: {
      color: UI.textMuted,
      fontFamily: theme.regularFont ?? "System",
      fontSize: 14,
      flexShrink: 1,
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 22,
      marginBottom: 6,
    },
    actionBtn: {
      flex: 1,
      minWidth: 0,
      height: 50,
      borderRadius: UI.radius,
      paddingHorizontal: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    actionBtnFilled: {},
    actionBtnFill: { borderRadius: UI.radius },
    actionBtnOutline: {
      backgroundColor: UI.cardBg,
      borderWidth: 1,
      borderColor: UI.trackBorder,
    },
    actionBtnTextFilled: {
      color: "#FFFFFF",
      fontFamily: theme.mediumFont ?? "System",
      fontSize: 16,
    },
    card: {
      marginTop: 14,
      padding: 16,
      gap: 12,
      borderRadius: UI.radiusCard,
      borderWidth: 1,
      borderColor: UI.cardBorder,
      backgroundColor: UI.cardBg,
      ...CARD_GLOW,
    },
    cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    cardTitle: {
      color: "#FFFFFF",
      fontFamily: theme.mediumFont ?? "System",
      fontSize: 16,
    },
    cardBody: {
      color: UI.textMuted,
      fontFamily: theme.regularFont ?? "System",
      fontSize: 14,
      lineHeight: 20,
    },
    locationRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    locationText: {
      color: "#FFFFFF",
      fontFamily: theme.mediumFont ?? "System",
      fontSize: 15,
    },
    seeAll: { flexDirection: "row", alignItems: "center", gap: 2 },
    seeAllText: {
      color: UI.textMuted,
      fontFamily: theme.regularFont ?? "System",
      fontSize: 13,
    },
    actionBtnTextOutline: {
      color: "#FFFFFF",
      fontFamily: theme.mediumFont ?? "System",
      fontSize: 16,
    },
    addPhotosRow: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 8,
      marginTop: 14,
      paddingVertical: 2,
    },
    addPhotosText: {
      color: "#00B8FF",
      fontFamily: theme.mediumFont ?? "System",
      fontSize: 15,
      lineHeight: 20,
    },
    addParagraphRow: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 8,
      marginTop: 20,
      paddingVertical: 2,
    },
    addParagraphText: {
      color: "#00B8FF",
      fontFamily: theme.mediumFont ?? "System",
      fontSize: 15,
      lineHeight: 20,
    },
    viewerRoot: {
      flex: 1,
      backgroundColor: "#000000",
      alignItems: "center",
    },
    viewerBack: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 8,
    },
    viewerBackLabel: {
      color: "#FFFFFF",
      fontFamily: theme.regularFont ?? "System",
      fontSize: 16,
    },
  });
}
