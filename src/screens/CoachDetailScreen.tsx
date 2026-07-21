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
import { ProfileHeroScoreBlock } from "../components/ProfileHeroScoreBlock";
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

const UNFOLLOW_ICON = require("../../assets/youpage/unfollowicon.svg");
const BOOK_VIDEO_ICON = require("../../assets/youpage/bookvideocall.svg");
const MESSAGE_ICON = require("../../assets/mystudents/message.svg");
const PERSONAL_ICON = require("../../assets/coachs/personalicon.png");
const BD_ICON_SVG = require("../../assets/coachs/bdicon.svg");
const SHARE_ICON_SVG = require("../../assets/coachs/shareicon.svg");
const ADD_PHOTOS_ICON = require("../../assets/youpage/addicon.svg");

const SHARE_ICON_SIZE = 28;
const GALLERY_SIZE = 80;

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
  const styles = useMemo(() => getStyles(theme), [theme]);

  const coach = useMemo(
    () => resolveCoachDetail(coachId, coachName),
    [coachId, coachName]
  );
  /** Known sample coaches (invite flow) keep their static location; live coaches don't. */
  const isSampleCoach = useMemo(() => getCoachDetail(coachId) != null, [coachId]);
  const horizontalPad = Math.max(16, insets.left, insets.right);

  // Live coach profile (name, headline, birth date, location) + overall score.
  const [live, setLive] = useState<LiveCoachProfile | null>(null);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [profileSections, setProfileSections] = useState<CoachProfileSection[]>([]);

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
  const displayHeadline =
    live?.headline?.trim() || (isSampleCoach ? coach?.headline ?? "" : "");
  const displayBirth =
    live?.birthDisplay?.trim() || (isSampleCoach ? coach?.birthDisplay ?? "" : "");
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

      <ProfileHeroScoreBlock
        horizontalPadding={horizontalPad}
        premiumLabelNudgeUp={4}
        marginTop={0}
        marginBottom={0}
        youPageLayout
        scoreNudgeRight={0}
        ratingUserId={coachId}
        playerOverride={{
          name: displayName,
          imageUri: displayImage,
          areaLocation: displayLocation || null,
          score: displayScore,
        }}
      />

      {!embeddedInYouTab ? (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnFilled]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("ProfileSettings")}
          >
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
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.galleryScroll}
        nestedScrollEnabled
      >
        {galleryItems.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.galleryThumb}
            activeOpacity={0.85}
            onPress={() => setViewerUri(item.uri)}
            accessibilityRole="button"
            accessibilityLabel="View photo"
          >
            <Image
              source={{ uri: item.uri }}
              style={{ width: GALLERY_SIZE, height: GALLERY_SIZE }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

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

      <View style={styles.personalBlock}>
        <Text style={styles.legalName}>{displayLegalName}</Text>
        {displayHeadline ? <Text style={styles.headline}>{displayHeadline}</Text> : null}
        {displayBirth || displayLocation ? (
          <View style={styles.personalMeta}>
            <View style={styles.metaLine}>
              {displayBirth ? (
                <>
                  <LocalSvgAsset assetModule={BD_ICON_SVG} width={20} height={20} />
                  <Text style={styles.metaText}>{displayBirth}</Text>
                </>
              ) : null}
              {displayBirth && displayLocation ? <View style={styles.metaBetween} /> : null}
              {displayLocation ? (
                <>
                  <Ionicons name="location-outline" size={20} color="#FFFFFF" />
                  <Text style={[styles.metaText, styles.metaTextLocation]} numberOfLines={1}>
                    {displayLocation}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      {/* Live paragraphs — coach You + student coach detail (banner → CoachDetail). */}
      {profileSections.length > 0 ? (
        <View style={styles.sectionsBlock}>
          {profileSections.map((section) => (
            <View key={section.id} style={styles.sectionCard}>
              <Text style={styles.sectionHeading}>{section.heading}</Text>
              <View style={styles.sectionSeparator} />
              <Text style={styles.sectionBody}>{section.body}</Text>
            </View>
          ))}
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
    sectionsBlock: {
      marginTop: 24,
      alignSelf: "stretch",
      gap: 24,
    },
    sectionCard: {
      alignSelf: "stretch",
      alignItems: "stretch",
    },
    sectionHeading: {
      color: "#1F6CD0",
      fontFamily: theme.semiBoldFont ?? theme.mediumFont ?? "System",
      fontSize: 22,
      lineHeight: 28,
      textAlign: "left",
    },
    sectionSeparator: {
      marginTop: 8,
      marginBottom: 12,
      height: StyleSheet.hairlineWidth * 2,
      backgroundColor: "#001C60",
      alignSelf: "stretch",
    },
    sectionBody: {
      color: "#86A7D2",
      fontFamily: theme.regularFont ?? "System",
      fontSize: 15,
      lineHeight: 22,
      textAlign: "left",
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
    metaLine: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
      gap: 4,
      paddingHorizontal: 4,
    },
    metaBetween: {
      width: 16,
    },
    metaText: {
      color: "#86A7D2",
      fontFamily: theme.regularFont ?? "System",
      fontSize: 15,
    },
    metaTextLocation: {
      flexShrink: 1,
      maxWidth: "52%",
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
