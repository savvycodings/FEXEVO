import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Platform,
  TextInput,
  Alert,
  ScrollView,
  Share,
  useWindowDimensions,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../navigation/types";
import { ThemeContext } from "../context";
import { Header } from "../components";
import { ShieldHeroRow } from "../components/ShieldHeroRow";
import { authClient } from "../lib/auth-client";
import { LinearGradient } from "expo-linear-gradient";
import { DOMAIN } from "../../constants";
import * as ImagePicker from "expo-image-picker";
import { getCachedProfile, setCachedProfile } from "../lib/profile-cache";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LocalSvgAsset } from "../components/LocalSvgAsset";

const MENU_SVG = {
  personal: require("../../assets/youpage/personalicon.svg"),
  account: require("../../assets/youpage/accounticon.svg"),
  location: require("../../assets/youpage/locationicon.svg"),
  game: require("../../assets/youpage/gamesettingsicon.svg"),
} as const;

const PROFILE_FIELD_BG = "#0E1830";
const PROFILE_FIELD_BORDER = "rgba(21, 102, 196, 0.45)";
const SETTINGS_MENU_FILL = "#041641";

type ProfileData = {
  user?: { name?: string; email?: string; image?: string | null };
  profile?: {
    username?: string | null;
    /** Shown to your linked coaches on My Coach; not listed on the admin member directory. */
    areaLocation?: string | null;
    gender?: string | null;
    level?: string | null;
    rankingOrg?: string | null;
    rankingValue?: string | null;
    hasRanking?: boolean | null;
  } | null;
};

const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"];
const LEVEL_OPTIONS = [
  "Beginner",
  "High Beginner",
  "Low Intermediate",
  "Intermediate",
  "High Intermediate",
  "Low Advanced",
  "Advanced",
  "High Advanced",
  "Competition/Open",
  "Other",
];
const RANKING_ORG_OPTIONS = [
  "Playtomic",
  "Playbypoint",
  "RankedIn",
  "MATCHi",
  "Padel Manager",
  "Red Padel",
  "PadelScore",
  "Tie Player",
  "Spain Federation",
];
const RANKING_ORG_LOGOS: Record<string, any> = {
  Playtomic: require("../../assets/logos/playtomic.svg"),
  Playbypoint: require("../../assets/logos/playbypoint.svg"),
  RankedIn: require("../../assets/logos/RankedIn.svg"),
  MATCHi: require("../../assets/logos/MATCHi.svg"),
  "Padel Manager": require("../../assets/logos/Padel Manager.svg"),
  "Red Padel": require("../../assets/logos/Red Padel.svg"),
  PadelScore: require("../../assets/logos/PadelScore.svg"),
  "Tie Player": require("../../assets/logos/Tie Player.svg"),
  "Spain Federation": require("../../assets/logos/Spain Federation.svg"),
};

function rankingLogoModule(org: string | null): number | null {
  if (!org) return null;
  const mod = RANKING_ORG_LOGOS[org];
  return mod != null ? mod : null;
}

export function ProfileSettingsScreen(props: { onProfileUpdated?: () => void; onClose: () => void }) {
  const { onProfileUpdated, onClose } = props;
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { theme } = useContext(ThemeContext);
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme);
  const pageHorizontalPad = 20;
  const topInset = Math.max(20, insets.top + 8);
  /** Match Progress shield sizing rules 1:1. */
  const badgeShieldRowW = Math.max(1, winW - pageHorizontalPad * 2);
  const badgeShieldMaxH = Math.min(300, winH * 0.27);
  const badgeShieldDisplayW = Math.min(
    badgeShieldRowW,
    Math.max(1, Math.floor(badgeShieldMaxH * (444 / 589)))
  );
  const badgeShieldDisplayH = Math.round((badgeShieldDisplayW * 589) / 444);
  const badgeCameraRight = Math.max(
    -20,
    Math.round((badgeShieldRowW - badgeShieldDisplayW) / 2) - 20
  );
  const badgeCameraRightFar = badgeCameraRight - 42;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProfileData>({});
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gameSaving, setGameSaving] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [genderInput, setGenderInput] = useState<string | null>(null);
  const [hasRankingInput, setHasRankingInput] = useState<boolean | null>(null);
  const [levelInput, setLevelInput] = useState<string | null>(null);
  const [rankingOrgInput, setRankingOrgInput] = useState<string | null>("Playtomic");
  const [rankingValueInput, setRankingValueInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [locationSaving, setLocationSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<"personal" | "account" | "location" | "game" | null>(null);

  function applyProfileBody(body: ProfileData) {
    setData(body);
    setNameInput(body.user?.name || "");
    setUsernameInput(body.profile?.username || "");
    setGenderInput(body.profile?.gender || null);
    if (typeof body.profile?.hasRanking === "boolean") {
      setHasRankingInput(body.profile?.hasRanking);
    } else {
      setHasRankingInput(null);
    }
    setLevelInput(body.profile?.level || null);
    setRankingOrgInput(body.profile?.rankingOrg || "Playtomic");
    setRankingValueInput(body.profile?.rankingValue || "");
    setLocationInput(body.profile?.areaLocation || "");
    const rawImage = body.user?.image;
    if (typeof rawImage === "string" && rawImage.length > 0) {
      const normalized = rawImage.startsWith("http")
        ? rawImage
        : `${DOMAIN.replace(/\/+$/, "")}${rawImage}`;
      setProfileImageUri(`${normalized}${normalized.includes("?") ? "&" : "?"}t=${Date.now()}`);
    } else {
      setProfileImageUri(null);
    }
  }

  async function loadRemote(opts?: { showLoading?: boolean }) {
    if (opts?.showLoading) setLoading(true);
    const res = await authClient.$fetch("/profile/me", { method: "GET" }).catch(() => null);
    const body = ((res as any)?.data ?? res) as ProfileData | null;
    if (body) {
      applyProfileBody(body);
      void setCachedProfile({
        user: {
          name: body.user?.name || null,
          email: body.user?.email || null,
          image: body.user?.image || null,
        },
        profile: {
          username: body.profile?.username || null,
          areaLocation: body.profile?.areaLocation || null,
          gender: body.profile?.gender || null,
          level: body.profile?.level || null,
          rankingOrg: body.profile?.rankingOrg || null,
          rankingValue: body.profile?.rankingValue || null,
        },
      });
    }
    if (opts?.showLoading) setLoading(false);
  }

  useEffect(() => {
    let mounted = true;
    async function loadWithCacheFirst() {
      const cached = await getCachedProfile();
      if (mounted && cached?.user) {
        applyProfileBody({
          user: {
            name: cached.user?.name || undefined,
            email: cached.user?.email || undefined,
            image: cached.user?.image || null,
          },
          profile: {
            username: cached.profile?.username || null,
            gender: cached.profile?.gender || null,
            level: cached.profile?.level || null,
            rankingOrg: cached.profile?.rankingOrg || null,
            rankingValue: cached.profile?.rankingValue || null,
          },
        });
        setLoading(false);
      }
      await loadRemote({ showLoading: !cached });
      if (mounted) setLoading(false);
    }
    void loadWithCacheFirst();
    return () => {
      mounted = false;
    };
  }, []);

  async function pickAndUploadAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri;
    setAvatarSaving(true);
    try {
      const form = new FormData();
      if (Platform.OS === "web") {
        const r = await fetch(uri);
        const blob = await r.blob();
        const file = new File([blob], "avatar.jpg", { type: blob.type || "image/jpeg" });
        form.append("avatar", file);
      } else {
        form.append("avatar", { uri, name: "avatar.jpg", type: "image/jpeg" });
      }
      await authClient.$fetch("/profile/avatar", {
        method: "POST",
        body: form,
      });
      await loadRemote();
      onProfileUpdated?.();
    } finally {
      setAvatarSaving(false);
    }
  }

  function resetEditDraft() {
    setNameInput(data.user?.name || "");
    setUsernameInput(data.profile?.username || "");
    setGenderInput(data.profile?.gender || null);
  }

  async function saveBasicProfile() {
    setSaving(true);
    const res = await authClient
      .$fetch<{ ok?: boolean; error?: string }>("/profile/basic", {
        method: "POST",
        body: {
          name: nameInput.trim(),
          username: usernameInput.trim(),
          gender: genderInput || "",
        } as any,
      })
      .catch((e) => ({ error: e?.message || "Failed to save profile." } as any));
    const body = ((res as any)?.data ?? res) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!body?.ok) {
      Alert.alert("Save failed", body?.error || "Could not save profile.");
      return;
    }
    await loadRemote();
    onProfileUpdated?.();
  }

  async function saveLocationProfile() {
    setLocationSaving(true);
    const res = await authClient
      .$fetch<{ ok?: boolean; error?: string }>("/profile/basic", {
        method: "POST",
        body: {
          name: nameInput.trim() || data.user?.name || "",
          username: usernameInput.trim(),
          gender: genderInput || "",
          areaLocation: locationInput.trim(),
        } as any,
      })
      .catch((e) => ({ error: e?.message || "Failed to save location." } as any));
    const body = ((res as any)?.data ?? res) as { ok?: boolean; error?: string };
    setLocationSaving(false);
    if (!body?.ok) {
      Alert.alert("Save failed", body?.error || "Could not save location.");
      return;
    }
    await loadRemote();
    onProfileUpdated?.();
    Alert.alert("Saved", "Your coaches can see this under your name on My Coach.");
  }

  async function saveGameSettings() {
    if (hasRankingInput === null) {
      Alert.alert("Missing info", "Select if you have a ranking.");
      return;
    }
    if (hasRankingInput === false && !levelInput) {
      Alert.alert("Missing level", "Select your level.");
      return;
    }
    if (hasRankingInput === true && (!rankingOrgInput || !rankingValueInput.trim())) {
      Alert.alert("Missing ranking", "Select organization and enter rating.");
      return;
    }

    setGameSaving(true);
    const res = await authClient
      .$fetch<{ ok?: boolean; error?: string }>("/profile/game", {
        method: "POST",
        body: {
          hasRanking: hasRankingInput,
          level: hasRankingInput ? "" : levelInput || "",
          rankingOrg: hasRankingInput ? rankingOrgInput || "" : "",
          rankingValue: hasRankingInput ? rankingValueInput.trim() : "",
        } as any,
      })
      .catch((e) => ({ error: e?.message || "Failed to save game settings." } as any));
    const body = ((res as any)?.data ?? res) as { ok?: boolean; error?: string };
    setGameSaving(false);
    if (!body?.ok) {
      Alert.alert("Save failed", body?.error || "Could not save game settings.");
      return;
    }
    await loadRemote();
    onProfileUpdated?.();
    Alert.alert("Saved", "Game settings updated.");
  }

  const sectionTitleMap: Record<NonNullable<typeof activeSection>, string> = {
    personal: "Personal Data",
    account: "Account",
    location: "Location",
    game: "Game Settings",
  };
  const currentTitle = activeSection ? sectionTitleMap[activeSection] : "Profile Edit";

  const MenuRow = ({
    title,
    iconModule,
    onPress,
  }: {
    title: string;
    iconModule: number;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={styles.menuRow}
      activeOpacity={0.82}
      onPress={onPress}
    >
      <View style={styles.menuRowLeft}>
        <View style={styles.menuIconSlot}>
          <LocalSvgAsset assetModule={iconModule} width={22} height={22} />
        </View>
        <Text allowFontScaling={false} style={styles.menuRowTitle}>
          {title}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
    </TouchableOpacity>
  );

  const SubsectionFooter = ({
    onBack,
    primaryLabel,
    onPrimary,
    primaryDisabled,
    primaryLoading,
  }: {
    onBack: () => void;
    primaryLabel?: string;
    onPrimary?: () => void;
    primaryDisabled?: boolean;
    primaryLoading?: boolean;
  }) => (
    <View style={styles.subsectionFooterRow}>
      <TouchableOpacity
        style={styles.subsectionBackBtn}
        onPress={onBack}
        activeOpacity={0.85}
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={22} color="#00BBFF" />
      </TouchableOpacity>
      {onPrimary ? (
        <TouchableOpacity
          style={[
            styles.subsectionPrimaryOuter,
            (primaryDisabled || primaryLoading) && styles.subsectionFooterDisabled,
          ]}
          onPress={onPrimary}
          disabled={primaryDisabled || primaryLoading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={["#0022FF", "#00BBFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.subsectionPrimaryInner}
          >
            <Text style={styles.subsectionPrimaryText}>
              {primaryLoading ? "Saving..." : primaryLabel}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <View style={styles.subsectionFooterSpacer} />
      )}
    </View>
  );

  if (activeSection === "personal") {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <KeyboardAwareScrollView
          style={{ width: "100%" }}
          contentContainerStyle={styles.subsectionScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={insets.bottom + 12}
        >
          <Text style={styles.detailPageHeading}>{currentTitle}</Text>
          <View style={styles.editCard}>
            <View>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                value={nameInput}
                onChangeText={setNameInput}
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={theme.placeholderTextColor ?? theme.mutedForegroundColor}
              />
            </View>
            <View>
              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                value={usernameInput}
                onChangeText={setUsernameInput}
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={theme.placeholderTextColor ?? theme.mutedForegroundColor}
                autoCapitalize="none"
              />
            </View>
            <View>
              <Text style={styles.inputLabel}>Gender</Text>
              <View style={styles.chipWrap}>
                {GENDER_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.chip, genderInput === opt && styles.chipActive]}
                    onPress={() => setGenderInput(opt)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.chipText, genderInput === opt && styles.chipTextActive]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity onPress={resetEditDraft} disabled={saving} activeOpacity={0.85}>
              <Text style={styles.resetLink}>Reset changes</Text>
            </TouchableOpacity>
          </View>
          <SubsectionFooter
            onBack={() => setActiveSection(null)}
            primaryLabel="Save Changes"
            onPrimary={saveBasicProfile}
            primaryDisabled={saving}
            primaryLoading={saving}
          />
        </KeyboardAwareScrollView>
      </View>
    );
  }

  if (activeSection === "account") {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <ScrollView
          style={{ width: "100%" }}
          contentContainerStyle={styles.subsectionScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.detailPageHeading}>{currentTitle}</Text>
          <View style={styles.editCard}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{data.user?.email || "-"}</Text>
            </View>
          </View>
          <SubsectionFooter onBack={() => setActiveSection(null)} />
        </ScrollView>
      </View>
    );
  }

  if (activeSection === "location") {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <KeyboardAwareScrollView
          style={{ width: "100%" }}
          contentContainerStyle={styles.subsectionScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bottomOffset={insets.bottom + 12}
        >
          <Text style={styles.detailPageHeading}>{currentTitle}</Text>
          <View style={styles.editCard}>
            <Text style={styles.inputLabel}>Area (visible to your coaches)</Text>
            <Text style={styles.hintText}>
              Example: Buenos Aires, Argentina. This line appears under your name on your coach&apos;s My Coach list. It is not shown on the public member directory.
            </Text>
            <TextInput
              value={locationInput}
              onChangeText={setLocationInput}
              style={[styles.input, { marginTop: 12 }]}
              placeholder="City, country"
              placeholderTextColor={theme.placeholderTextColor ?? theme.mutedForegroundColor}
              maxLength={200}
            />
          </View>
          <SubsectionFooter
            onBack={() => setActiveSection(null)}
            primaryLabel="Save location"
            onPrimary={() => void saveLocationProfile()}
            primaryDisabled={locationSaving}
            primaryLoading={locationSaving}
          />
        </KeyboardAwareScrollView>
      </View>
    );
  }

  if (activeSection === "game") {
    const rankingLogoMod = rankingLogoModule(rankingOrgInput);
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <KeyboardAwareScrollView
          style={{ width: "100%" }}
          contentContainerStyle={styles.subsectionScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={insets.bottom + 12}
        >
          <Text style={styles.detailPageHeading}>{currentTitle}</Text>
          <View style={styles.editCard}>
              <Text style={styles.inputLabel}>Set your Ranking</Text>
              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.choicePill, hasRankingInput === false && styles.choicePillActive]}
                  onPress={() => {
                    setHasRankingInput(false);
                    setRankingOrgInput(null);
                    setRankingValueInput("");
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.choiceText, hasRankingInput === false && styles.choiceTextActive]}>
                    No
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.choicePill, hasRankingInput === true && styles.choicePillActive]}
                  onPress={() => {
                    setHasRankingInput(true);
                    setRankingOrgInput((prev) => prev || "Playtomic");
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.choiceText, hasRankingInput === true && styles.choiceTextActive]}>
                    Yes
                  </Text>
                </TouchableOpacity>
              </View>

              {hasRankingInput === false && (
                <View style={{ gap: 8, marginTop: 8 }}>
                  <Text style={styles.inputLabel}>Set your Level</Text>
                  {LEVEL_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.levelOption, levelInput === opt && styles.levelOptionActive]}
                      onPress={() => setLevelInput(opt)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.levelText, levelInput === opt && styles.levelTextActive]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {hasRankingInput === true && (
                <View style={{ gap: 10, marginTop: 8 }}>
                  <View style={styles.rankLogoWrap}>
                    {rankingLogoMod != null ? (
                      <LocalSvgAsset assetModule={rankingLogoMod} width={300} height={64} />
                    ) : (
                      <Text style={styles.rankLogoFallback}>{rankingOrgInput || "Playtomic"}</Text>
                    )}
                  </View>
                  <View style={styles.chipWrap}>
                    {RANKING_ORG_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.chip, rankingOrgInput === opt && styles.chipActive]}
                        onPress={() => setRankingOrgInput(opt)}
                        activeOpacity={0.85}
                      >
                        <Text
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={[styles.chipText, rankingOrgInput === opt && styles.chipTextActive]}
                        >
                          {opt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    value={rankingValueInput}
                    onChangeText={setRankingValueInput}
                    style={styles.input}
                    placeholder="Please put your rating"
                    placeholderTextColor={theme.placeholderTextColor ?? theme.mutedForegroundColor}
                  />
                </View>
              )}
            </View>
          <SubsectionFooter
            onBack={() => setActiveSection(null)}
            primaryLabel="Save Game Settings"
            onPrimary={saveGameSettings}
            primaryDisabled={gameSaving}
            primaryLoading={gameSaving}
          />
        </KeyboardAwareScrollView>
      </View>
    );
  }

  async function shareProfile() {
    try {
      await Share.share({
        message: `${data.user?.name || "Player"} - Xevo`,
      });
    } catch {
      /* dismissed */
    }
  }

  function navigateMainTab(screen: "AICoach" | "You") {
    if (screen === "You") {
      navigation.navigate("Main", { screen: "You", params: { screen: "YouMain" } });
    } else {
      navigation.navigate("Main", { screen: "AICoach" });
    }
  }

  return (
    <View style={styles.screenRoot}>
      <Header
        flatOverlay
        onBackPress={onClose}
        onLogoPress={() => navigateMainTab("AICoach")}
      />
      <KeyboardAwareScrollView
        style={{ flex: 1, width: "100%" }}
        contentContainerStyle={{
          paddingHorizontal: pageHorizontalPad,
          paddingTop: 12,
          paddingBottom: 28 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={insets.bottom + 12}
      >
        <View style={styles.profileEditHeaderRow}>
          <View style={styles.profileEditTitleRow}>
            <Text allowFontScaling={false} style={styles.profileEditTitleInline}>
              Profile Edit
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => void shareProfile()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.profileEditShareBtn}
            accessibilityLabel="Share profile"
          >
            <Ionicons name="share-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.badgeRow}>
          <View style={[styles.badgeFrame, { width: badgeShieldRowW, height: badgeShieldDisplayH + 12 }]}>
            <ShieldHeroRow
              rowWidth={badgeShieldRowW}
              coachName={data.user?.name || "Player"}
              coachImageUri={!loading ? profileImageUri : null}
              shieldCardProps={{
                showName: false,
                showScore: false,
                showFlag: false,
                showPillarScores: true,
                topNameScale: 1.45,
              }}
            />
            <TouchableOpacity
              style={[
                styles.badgeCameraCorner,
                {
                  right: badgeCameraRightFar,
                },
              ]}
              onPress={pickAndUploadAvatar}
              activeOpacity={0.88}
              accessibilityLabel="Change profile photo"
            >
              <Ionicons name="camera" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
        {avatarSaving ? (
          <Text allowFontScaling={false} style={styles.avatarSavingBelowBadge}>
            Uploading…
          </Text>
        ) : null}

        <View style={styles.quickInfoRow}>
          <View style={styles.quickInfoItem}>
            <Ionicons name="gift-outline" size={16} color="rgba(200, 220, 255, 0.85)" />
            <Text allowFontScaling={false} style={styles.quickInfoText}>
              Date not set
            </Text>
          </View>
          <View style={styles.quickInfoItem}>
            <Ionicons name="location-outline" size={16} color="rgba(200, 220, 255, 0.85)" />
            <Text allowFontScaling={false} style={styles.quickInfoText}>
              Location not set
            </Text>
          </View>
        </View>

        <LinearGradient
          colors={["#0022FF", "#00BBFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.menuCardGradientOuter}
        >
          <View style={styles.menuCard}>
            <MenuRow
              title="Personal Data"
              iconModule={MENU_SVG.personal}
              onPress={() => setActiveSection("personal")}
            />
            <MenuRow
              title="Account"
              iconModule={MENU_SVG.account}
              onPress={() => setActiveSection("account")}
            />
            <MenuRow
              title="Location"
              iconModule={MENU_SVG.location}
              onPress={() => setActiveSection("location")}
            />
            <MenuRow
              title="Game Settings"
              iconModule={MENU_SVG.game}
              onPress={() => setActiveSection("game")}
            />
          </View>
        </LinearGradient>

        <View style={styles.settingsFooterStack}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate("AdminHub")}
            style={styles.settingsFooterGradientOuter}
          >
            <LinearGradient
              colors={["#0022FF", "#00BBFF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.settingsFooterGradientInner}
            >
              <Text allowFontScaling={false} style={styles.settingsFooterGradientText}>
                Admin
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => void authClient.signOut().catch(() => null)}
            style={styles.settingsFooterGradientOuter}
          >
            <LinearGradient
              colors={["#0022FF", "#00BBFF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.settingsFooterGradientInner}
            >
              <Text allowFontScaling={false} style={styles.settingsFooterGradientText}>
                Sign out
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

function getStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundColor,
      paddingHorizontal: 24,
      paddingTop: 20,
    },
    screenRoot: {
      flex: 1,
      backgroundColor: theme.backgroundColor,
    },
    profileEditHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 18,
      minHeight: 44,
    },
    profileEditTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    profileEditTitleInline: {
      color: "#FFFFFF",
      fontFamily: theme.semiBoldFont,
      fontSize: 18,
      letterSpacing: 0.2,
      flexShrink: 1,
    },
    profileEditShareBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeRow: {
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    badgeFrame: {
      width: 232,
      height: 302,
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
    },
    badgeCameraCorner: {
      position: "absolute",
      bottom: 18,
      right: -20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(0, 102, 255, 0.95)",
      borderWidth: 1,
      borderColor: "rgba(0, 221, 255, 0.65)",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 20,
    },
    avatarSavingBelowBadge: {
      textAlign: "center",
      color: "#9CC2FF",
      fontFamily: theme.semiBoldFont,
      fontSize: 12,
      marginBottom: 8,
    },
    quickInfoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      marginTop: 10,
      marginBottom: 22,
      alignSelf: "center",
    },
    quickInfoItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    quickInfoText: {
      color: "rgba(200, 220, 255, 0.78)",
      fontFamily: theme.regularFont,
      fontSize: 13,
      flexShrink: 1,
    },
    menuCardGradientOuter: {
      borderRadius: 20,
      padding: 2.5,
      overflow: "hidden",
    },
    menuCard: {
      borderRadius: 18,
      backgroundColor: SETTINGS_MENU_FILL,
      overflow: "hidden",
    },
    menuRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 17,
      paddingHorizontal: 18,
    },
    menuRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      flex: 1,
      minWidth: 0,
    },
    menuIconSlot: {
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    menuRowTitle: {
      color: "#86A7D2",
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
    },
    subsectionScrollContent: { paddingBottom: 24 },
    subsectionFooterRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 14,
    },
    subsectionBackBtn: {
      width: 54,
      height: 54,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(6, 26, 86, 0.9)",
      borderWidth: 1,
      borderColor: "rgba(0, 120, 255, 0.45)",
    },
    subsectionPrimaryOuter: {
      flex: 1,
      borderRadius: 16,
      overflow: "hidden",
    },
    subsectionPrimaryInner: {
      minHeight: 54,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    subsectionPrimaryText: {
      fontSize: 17,
      fontFamily: theme.semiBoldFont,
      color: theme.tintTextColor,
    },
    subsectionFooterSpacer: { flex: 1, minHeight: 54 },
    subsectionFooterDisabled: { opacity: 0.65 },
    resetLink: {
      marginTop: 4,
      fontSize: 13,
      fontFamily: theme.mediumFont,
      color: "#18C0FF",
    },
    settingsFooterStack: {
      marginTop: 28,
      width: "100%",
      gap: 12,
    },
    settingsFooterGradientOuter: {
      width: "100%",
      borderRadius: 16,
      overflow: "hidden",
    },
    settingsFooterGradientInner: {
      minHeight: 54,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    settingsFooterGradientText: {
      fontSize: 17,
      fontFamily: theme.semiBoldFont,
      color: theme.tintTextColor,
    },
    editCard: {
      width: "100%",
      gap: 12,
      marginTop: 4,
    },
    inputLabel: { color: "rgba(255,255,255,0.8)", fontFamily: theme.mediumFont, marginBottom: 4, fontSize: 12 },
    input: {
      minHeight: 48,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: PROFILE_FIELD_BORDER,
      backgroundColor: PROFILE_FIELD_BG,
      color: "#fff",
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontFamily: theme.regularFont,
      fontSize: 15,
      marginBottom: 2,
    },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between" },
    chip: {
      width: "48.5%",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: PROFILE_FIELD_BORDER,
      backgroundColor: PROFILE_FIELD_BG,
      paddingHorizontal: 12,
      paddingVertical: 10,
      alignItems: "center",
    },
    chipActive: { backgroundColor: "#fff", borderColor: "#fff" },
    chipText: { fontFamily: theme.mediumFont, color: "#79AFFF", fontSize: 12 },
    chipTextActive: { color: "#062063" },
    row: { flexDirection: "row", gap: 10 },
    choicePill: {
      flex: 1,
      minHeight: 44,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: PROFILE_FIELD_BORDER,
      backgroundColor: PROFILE_FIELD_BG,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
    },
    choicePillActive: { backgroundColor: "#fff", borderColor: "#fff" },
    choiceText: { fontFamily: theme.mediumFont, fontSize: 13, color: "#73A8FF" },
    choiceTextActive: { color: "#062063" },
    levelOption: {
      minHeight: 44,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: PROFILE_FIELD_BORDER,
      backgroundColor: PROFILE_FIELD_BG,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    levelOptionActive: { backgroundColor: "#fff", borderColor: "#fff" },
    levelText: { fontFamily: theme.mediumFont, color: "#79AFFF", fontSize: 13 },
    levelTextActive: { color: "#062063" },
    rankLogoWrap: {
      marginTop: 2,
      marginBottom: 2,
      minHeight: 78,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: PROFILE_FIELD_BORDER,
      backgroundColor: PROFILE_FIELD_BG,
      paddingVertical: 8,
    },
    rankLogoFallback: {
      color: "#FFFFFF",
      fontFamily: theme.semiBoldFont,
      letterSpacing: 1.6,
      fontSize: 18,
    },
    detailPageHeading: {
      alignSelf: "flex-start",
      width: "100%",
      color: "#fff",
      fontFamily: theme.semiBoldFont,
      fontSize: 22,
      marginTop: 2,
      marginBottom: 12,
    },
    readOnlyField: {
      minHeight: 48,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: PROFILE_FIELD_BORDER,
      backgroundColor: PROFILE_FIELD_BG,
      justifyContent: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    readOnlyText: { color: "#D7E7FF", fontFamily: theme.regularFont, fontSize: 15 },
    hintText: { color: "rgba(255,255,255,0.72)", fontFamily: theme.regularFont, fontSize: 12 },
  });
}
