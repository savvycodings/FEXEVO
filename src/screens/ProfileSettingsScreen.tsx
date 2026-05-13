import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
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
  Modal,
  FlatList,
  Pressable,
} from "react-native";
import { getCountriesForPicker, countryMatchesSearchQuery, findCountry, type Country } from "../lib/countries";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../navigation/types";
import { ThemeContext } from "../context";
import { useSessionData } from "../context/SessionDataContext";
import { AdminGradientCard, Header } from "../components";
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

const SHARE_BUTTON_SVG = require("../../assets/actiities/sharebutton.svg");
const CAMERA_ICON_SVG = require("../../assets/actiities/camra1.svg");
const BIRTHDAY_ICON_SVG = require("../../assets/actiities/birthday.svg");
const LOCATION_PIN_ICON_SVG = require("../../assets/actiities/location.svg");
const PASSWORD_HIDE_ICON_SVG = require("../../assets/actiities/hide.svg");
const PASSWORD_SEE_ICON_SVG = require("../../assets/actiities/see.svg");
const XEVO_BLUE_WORDMARK = require("../../assets/actiities/xevoblue.png");
/** Profile badge camera circle (px); keep in sync with `badgeCameraCorner` + share alignment math. */
const PROFILE_SETTINGS_CAMERA_BTN_PX = 40;
/** Password visibility icons (`hide.svg` / `see.svg`) — row height matches this so nothing clips. */
const PASSWORD_VISIBILITY_ICON_PX = 26;

const PROFILE_FIELD_BG = "#0E1830";
const PROFILE_FIELD_BORDER = "rgba(21, 102, 196, 0.45)";
/** Personal Data subsection — matches design spec */
const PERSONAL_FIELD_BG = "#041641";
const PERSONAL_FIELD_BORDER_FOCUS = "#00B8FF40";
const PERSONAL_LABEL_COLOR = "#86A7D2";

function splitDisplayName(full: string): { first: string; last: string } {
  const t = full.trim();
  if (!t) return { first: "", last: "" };
  const i = t.indexOf(" ");
  if (i === -1) return { first: t, last: "" };
  return { first: t.slice(0, i).trim(), last: t.slice(i + 1).trim() };
}

function joinDisplayName(first: string, last: string): string {
  return `${first.trim()} ${last.trim()}`.trim();
}

/** `YYYY-MM-DD` or `null` (clear). `undefined` = omit from save (keep server value). */
function tryBuildIsoBirthDate(day: string, month: string, year: string): string | null | undefined {
  const d = String(day ?? "").trim();
  const m = String(month ?? "").trim();
  const y = String(year ?? "").trim();
  const any = !!(d || m || y);
  if (!any) return null;
  if (d.length < 2 || m.length < 2 || y.length < 4) return undefined;
  const di = Number(d);
  const mi = Number(m);
  const yi = Number(y);
  if (![di, mi, yi].every((n) => Number.isFinite(n))) return undefined;
  if (mi < 1 || mi > 12 || di < 1 || di > 31 || yi < 1900 || yi > 2100) return undefined;
  const dt = new Date(Date.UTC(yi, mi - 1, di));
  if (dt.getUTCFullYear() !== yi || dt.getUTCMonth() !== mi - 1 || dt.getUTCDate() !== di) return undefined;
  return `${yi}-${String(mi).padStart(2, "0")}-${String(di).padStart(2, "0")}`;
}

function formatIsoBirthDateToDMY(iso: string | null | undefined): string | null {
  if (iso == null || typeof iso !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}
type ProfileData = {
  user?: { name?: string; email?: string; image?: string | null };
  profile?: {
    username?: string | null;
    phone?: string | null;
    /** Shown to your linked coaches on My Coach; not listed on the admin member directory. */
    areaLocation?: string | null;
    /** ISO `YYYY-MM-DD` when set. */
    birthDate?: string | null;
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
  const { overallPillarScore } = useSessionData();
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
  /** Horizontal center with `ShieldHeroRow` share control (`minWidth` = SHARE_TOUCH + 12). */
  const BADGE_SHARE_HIT_MIN_W = 36 + 12;
  const badgeCameraRightUnderShare = Math.max(
    0,
    Math.round(BADGE_SHARE_HIT_MIN_W / 2 - PROFILE_SETTINGS_CAMERA_BTN_PX / 2)
  );
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProfileData>({});
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gameSaving, setGameSaving] = useState(false);
  const [firstNameInput, setFirstNameInput] = useState("");
  const [lastNameInput, setLastNameInput] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [genderInput, setGenderInput] = useState<string | null>(null);
  const [hasRankingInput, setHasRankingInput] = useState<boolean | null>(null);
  const [levelInput, setLevelInput] = useState<string | null>(null);
  const [rankingOrgInput, setRankingOrgInput] = useState<string | null>("Playtomic");
  const [rankingValueInput, setRankingValueInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [locationSaving, setLocationSaving] = useState(false);
  /** Country selected in the picker (stored as the country's English `name`). */
  const [locationCountry, setLocationCountry] = useState<Country | null>(null);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  const countryResults = useMemo(() => {
    const list = getCountriesForPicker();
    const q = String(countrySearch ?? "").trim().toLowerCase();
    if (!q) return list;
    return [...list].filter((c) => countryMatchesSearchQuery(c, q));
  }, [countrySearch]);

  const shieldQuickLocationLabel = useMemo(() => {
    const pickedRaw = locationCountry?.name;
    const picked = typeof pickedRaw === "string" ? pickedRaw.trim() : "";
    const rawLoc = data.profile?.areaLocation;
    const stored = typeof rawLoc === "string" ? rawLoc.trim() : "";
    if (picked) return picked;
    if (stored) return findCountry(stored)?.name ?? stored;
    return null;
  }, [locationCountry?.name, data.profile?.areaLocation]);

  const shieldQuickBirthLabel = useMemo(() => {
    const rawIso = data.profile?.birthDate;
    const iso = typeof rawIso === "string" ? rawIso.trim() : "";
    if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) return formatIsoBirthDateToDMY(iso) ?? null;
    const d = String(birthDayInput ?? "").trim();
    const m = String(birthMonthInput ?? "").trim();
    const y = String(birthYearInput ?? "").trim();
    if (d.length >= 2 && m.length >= 2 && y.length >= 4) {
      return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
    }
    return null;
  }, [data.profile?.birthDate, birthDayInput, birthMonthInput, birthYearInput]);
  const [activeSection, setActiveSection] = useState<"personal" | "account" | "location" | "game" | null>(null);
  const [personalFocusedField, setPersonalFocusedField] = useState<
    "name" | "lastname" | "username" | "birthdate" | null
  >(null);
  const blurClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const birthBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameInputRef = useRef<TextInput | null>(null);
  const lastNameInputRef = useRef<TextInput | null>(null);
  const usernameInputRef = useRef<TextInput | null>(null);
  const birthDayInputRef = useRef<TextInput | null>(null);
  const birthMonthInputRef = useRef<TextInput | null>(null);
  const birthYearInputRef = useRef<TextInput | null>(null);

  function cancelScheduledBlurClears() {
    if (blurClearTimerRef.current) {
      clearTimeout(blurClearTimerRef.current);
      blurClearTimerRef.current = null;
    }
    if (birthBlurTimerRef.current) {
      clearTimeout(birthBlurTimerRef.current);
      birthBlurTimerRef.current = null;
    }
  }

  function commitPersonalFieldFocus(field: "name" | "lastname" | "username" | "birthdate") {
    cancelScheduledBlurClears();
    setPersonalFocusedField(field);
  }

  function scheduleBlurClearField() {
    if (blurClearTimerRef.current) clearTimeout(blurClearTimerRef.current);
    blurClearTimerRef.current = setTimeout(() => {
      blurClearTimerRef.current = null;
      setPersonalFocusedField(null);
    }, 50);
  }

  function onBirthSegmentFocus() {
    cancelScheduledBlurClears();
    setPersonalFocusedField("birthdate");
  }

  function onBirthSegmentBlur() {
    if (birthBlurTimerRef.current) clearTimeout(birthBlurTimerRef.current);
    birthBlurTimerRef.current = setTimeout(() => {
      birthBlurTimerRef.current = null;
      setPersonalFocusedField((f) => (f === "birthdate" ? null : f));
    }, 120);
  }

  const [birthDayInput, setBirthDayInput] = useState("");
  const [birthMonthInput, setBirthMonthInput] = useState("");
  const [birthYearInput, setBirthYearInput] = useState("");
  const [genderPickerOpen, setGenderPickerOpen] = useState(false);
  const [accountEmailInput, setAccountEmailInput] = useState("");
  const [accountPhoneInput, setAccountPhoneInput] = useState("");
  const [accountPasswordCurrent, setAccountPasswordCurrent] = useState("");
  const [accountPasswordNew, setAccountPasswordNew] = useState("");
  const [showAccountCurrentPassword, setShowAccountCurrentPassword] = useState(false);
  const [showAccountNewPassword, setShowAccountNewPassword] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountFocusedField, setAccountFocusedField] = useState<
    "email" | "phone" | "passwordCurrent" | "passwordNew" | null
  >(null);
  const accountBlurClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accountEmailRef = useRef<TextInput | null>(null);
  const accountPhoneRef = useRef<TextInput | null>(null);
  const accountPasswordCurrentRef = useRef<TextInput | null>(null);
  const accountPasswordNewRef = useRef<TextInput | null>(null);

  function cancelAccountBlurClear() {
    if (accountBlurClearTimerRef.current) {
      clearTimeout(accountBlurClearTimerRef.current);
      accountBlurClearTimerRef.current = null;
    }
  }

  function commitAccountFieldFocus(
    field: "email" | "phone" | "passwordCurrent" | "passwordNew"
  ) {
    cancelAccountBlurClear();
    setAccountFocusedField(field);
  }

  function scheduleAccountBlurClear() {
    if (accountBlurClearTimerRef.current) clearTimeout(accountBlurClearTimerRef.current);
    accountBlurClearTimerRef.current = setTimeout(() => {
      accountBlurClearTimerRef.current = null;
      setAccountFocusedField(null);
    }, 50);
  }

  function applyProfileBody(body: ProfileData) {
    setData(body);
    const { first, last } = splitDisplayName(body.user?.name || "");
    setFirstNameInput(first);
    setLastNameInput(last);
    setUsernameInput(body.profile?.username || "");
    setGenderInput(body.profile?.gender || null);
    setAccountEmailInput(body.user?.email || "");
    setAccountPhoneInput(body.profile?.phone ?? "");
    if (typeof body.profile?.hasRanking === "boolean") {
      setHasRankingInput(body.profile?.hasRanking);
    } else {
      setHasRankingInput(null);
    }
    setLevelInput(body.profile?.level || null);
    setRankingOrgInput(body.profile?.rankingOrg || "Playtomic");
    setRankingValueInput(body.profile?.rankingValue || "");
    const storedArea = body.profile?.areaLocation || "";
    setLocationInput(storedArea);
    setLocationCountry(findCountry(storedArea));
    const rawBd = body.profile?.birthDate;
    const isoBirth = typeof rawBd === "string" ? rawBd.trim() : "";
    if (isoBirth && /^\d{4}-\d{2}-\d{2}$/.test(isoBirth)) {
      const [yStr, mStr, dStr] = isoBirth.split("-");
      setBirthYearInput(yStr);
      setBirthMonthInput(mStr);
      setBirthDayInput(dStr);
    } else {
      setBirthDayInput("");
      setBirthMonthInput("");
      setBirthYearInput("");
    }
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
          birthDate: body.profile?.birthDate ?? null,
          phone: body.profile?.phone || null,
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
            phone: cached.profile?.phone || null,
            areaLocation: cached.profile?.areaLocation || null,
            birthDate: cached.profile?.birthDate ?? null,
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

  useEffect(() => {
    return () => {
      cancelScheduledBlurClears();
      cancelAccountBlurClear();
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
    const { first, last } = splitDisplayName(data.user?.name || "");
    setFirstNameInput(first);
    setLastNameInput(last);
    setUsernameInput(data.profile?.username || "");
    setGenderInput(data.profile?.gender || null);
  }

  async function saveBasicProfile() {
    const d0 = String(birthDayInput ?? "").trim();
    const m0 = String(birthMonthInput ?? "").trim();
    const y0 = String(birthYearInput ?? "").trim();
    const anyBirth = !!(d0 || m0 || y0);
    if (anyBirth && (d0.length < 2 || m0.length < 2 || y0.length < 4)) {
      Alert.alert("Birthdate", "Enter day, month, and year, or clear all birthdate fields.");
      return;
    }
    const birthResolved = tryBuildIsoBirthDate(birthDayInput, birthMonthInput, birthYearInput);
    if (birthResolved === undefined) {
      Alert.alert("Birthdate", "That date is not valid. Please check day, month, and year.");
      return;
    }

    setSaving(true);
    const res = await authClient
      .$fetch<{ ok?: boolean; error?: string }>("/profile/basic", {
        method: "POST",
        body: {
          name: joinDisplayName(firstNameInput, lastNameInput),
          username: usernameInput.trim(),
          gender: genderInput || "",
          birthDate: birthResolved,
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

  async function saveAccountProfile() {
    const emailTrim = accountEmailInput.trim();
    if (emailTrim.length > 0 && !emailTrim.includes("@")) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }
    const cur = accountPasswordCurrent.trim();
    const neu = accountPasswordNew.trim();
    if (cur || neu) {
      if (!cur || !neu) {
        Alert.alert("Password", "Enter both your current password and your new password.");
        return;
      }
      if (cur === neu) {
        Alert.alert("Password", "New password must be different from your current password.");
        return;
      }
    }

    setAccountSaving(true);
    try {
      if (cur && neu) {
        const pwRes = await authClient
          .$fetch<{ error?: { message?: string }; token?: string | null; user?: unknown }>(
            "/change-password",
            {
              method: "POST",
              body: {
                currentPassword: cur,
                newPassword: neu,
                revokeOtherSessions: false,
              },
            } as any
          )
          .catch((e) => ({ error: { message: e?.message || "Password change failed." } } as any));
        const pwBody = ((pwRes as any)?.data ?? pwRes) as {
          error?: { message?: string };
          token?: string | null;
        };
        if (pwBody?.error?.message) {
          Alert.alert("Password", pwBody.error.message);
          return;
        }
        setAccountPasswordCurrent("");
        setAccountPasswordNew("");
      }

      const res = await authClient
        .$fetch<{ ok?: boolean; error?: string }>("/profile/basic", {
          method: "POST",
          body: {
            name: joinDisplayName(firstNameInput, lastNameInput) || data.user?.name || "",
            username: usernameInput.trim(),
            gender: genderInput || "",
            email: emailTrim,
            phone: accountPhoneInput.trim(),
          } as any,
        })
        .catch((e) => ({ error: e?.message || "Failed to save account." } as any));
      const body = ((res as any)?.data ?? res) as { ok?: boolean; error?: string };
      if (!body?.ok) {
        Alert.alert("Save failed", body?.error || "Could not save account.");
        return;
      }
      await loadRemote();
      onProfileUpdated?.();
      Alert.alert("Saved", "Account updated.");
    } finally {
      setAccountSaving(false);
    }
  }

  async function saveLocationProfile() {
    setLocationSaving(true);
    // Picker stores `locationCountry`; persist the resolved English country
    // name so existing consumers (My Coach, profile cache, etc.) keep reading
    // a plain string from `areaLocation`. Empty string clears the field.
    const areaToSave = locationCountry?.name ?? "";
    const res = await authClient
      .$fetch<{ ok?: boolean; error?: string }>("/profile/basic", {
        method: "POST",
        body: {
          name: joinDisplayName(firstNameInput, lastNameInput) || data.user?.name || "",
          username: usernameInput.trim(),
          gender: genderInput || "",
          areaLocation: areaToSave,
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
        <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
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
    const displayFullName =
      joinDisplayName(firstNameInput, lastNameInput) || data.user?.name || "Player";
    const usernameBare = usernameInput.replace(/^@+/, "");
    const phColor = theme.placeholderTextColor ?? theme.mutedForegroundColor;

    return (
      <View style={styles.screenRoot}>
        <Header flatOverlay onLogoPress={() => navigateMainTab("AICoach")} />
        <KeyboardAwareScrollView
          style={{ flex: 1, width: "100%" }}
          contentContainerStyle={[
            styles.subsectionScrollContent,
            {
              paddingHorizontal: pageHorizontalPad,
              paddingTop: 12,
              paddingBottom: 28 + insets.bottom,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={insets.bottom + 12}
        >
          <Text style={styles.detailPageHeading}>{currentTitle}</Text>

          <View style={styles.personalHeroRow}>
            <TouchableOpacity
              onPress={pickAndUploadAvatar}
              activeOpacity={0.88}
              accessibilityLabel="Change profile photo"
            >
              {profileImageUri ? (
                <Image source={{ uri: profileImageUri }} style={styles.personalHeroAvatar} />
              ) : (
                <View style={[styles.personalHeroAvatar, styles.personalHeroAvatarPlaceholder]}>
                  <Ionicons name="person" size={28} color="rgba(200,220,255,0.75)" />
                </View>
              )}
            </TouchableOpacity>
            <Text allowFontScaling={false} style={styles.personalHeroName} numberOfLines={2}>
              {displayFullName}
            </Text>
          </View>

          <Pressable
            style={[
              styles.personalFieldBox,
              personalFocusedField === "name" && styles.personalFieldBoxSelected,
            ]}
            onPress={() => nameInputRef.current?.focus()}
          >
            <View style={styles.personalFieldBody}>
              <Text allowFontScaling={false} style={styles.personalFieldLabel}>
                Name
              </Text>
              <TextInput
                ref={nameInputRef}
                value={firstNameInput}
                onChangeText={setFirstNameInput}
                onFocus={() => commitPersonalFieldFocus("name")}
                onBlur={() => scheduleBlurClearField()}
                style={styles.personalFieldInput}
                placeholder="First name"
                placeholderTextColor={phColor}
              />
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.personalFieldBox,
              personalFocusedField === "lastname" && styles.personalFieldBoxSelected,
            ]}
            onPress={() => lastNameInputRef.current?.focus()}
          >
            <View style={styles.personalFieldBody}>
              <Text allowFontScaling={false} style={styles.personalFieldLabel}>
                Lastname
              </Text>
              <TextInput
                ref={lastNameInputRef}
                value={lastNameInput}
                onChangeText={setLastNameInput}
                onFocus={() => commitPersonalFieldFocus("lastname")}
                onBlur={() => scheduleBlurClearField()}
                style={styles.personalFieldInput}
                placeholder="Last name"
                placeholderTextColor={phColor}
              />
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.personalFieldBox,
              personalFocusedField === "username" && styles.personalFieldBoxSelected,
            ]}
            onPress={() => usernameInputRef.current?.focus()}
          >
            <View style={styles.personalFieldBody}>
              <Text allowFontScaling={false} style={styles.personalFieldLabel}>
                Username
              </Text>
              <View style={styles.personalUsernameRow}>
                <Text allowFontScaling={false} style={styles.personalUsernameAt}>
                  @
                </Text>
                <TextInput
                  ref={usernameInputRef}
                  value={usernameBare}
                  onChangeText={(t) => setUsernameInput(t.replace(/^@+/, ""))}
                  onFocus={() => commitPersonalFieldFocus("username")}
                  onBlur={() => scheduleBlurClearField()}
                  style={[styles.personalFieldInput, styles.personalUsernameInput]}
                  placeholder="username"
                  placeholderTextColor={phColor}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.personalFieldBox,
              personalFocusedField === "birthdate" && styles.personalFieldBoxSelected,
            ]}
            onPress={() => birthDayInputRef.current?.focus()}
          >
            <View style={styles.personalFieldBody}>
              <Text allowFontScaling={false} style={styles.personalBirthSectionLabel}>
                Birthdate
              </Text>
              <View style={styles.personalBirthDateClusterWrap}>
                <View style={styles.personalBirthValueRow}>
                  <View style={styles.personalBirthCol}>
                    <Text allowFontScaling={false} style={styles.personalBirthMiniLabel}>
                      Day
                    </Text>
                    <TextInput
                      ref={birthDayInputRef}
                      value={birthDayInput}
                      onChangeText={(t) => setBirthDayInput(t.replace(/\D/g, "").slice(0, 2))}
                      onFocus={onBirthSegmentFocus}
                      onBlur={onBirthSegmentBlur}
                      style={styles.personalBirthInput}
                      placeholder="—"
                      placeholderTextColor={phColor}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                  <Text allowFontScaling={false} style={styles.personalBirthSlash}>
                    /
                  </Text>
                  <View style={styles.personalBirthCol}>
                    <Text allowFontScaling={false} style={styles.personalBirthMiniLabel}>
                      Month
                    </Text>
                    <TextInput
                      ref={birthMonthInputRef}
                      value={birthMonthInput}
                      onChangeText={(t) => setBirthMonthInput(t.replace(/\D/g, "").slice(0, 2))}
                      onFocus={onBirthSegmentFocus}
                      onBlur={onBirthSegmentBlur}
                      style={styles.personalBirthInput}
                      placeholder="—"
                      placeholderTextColor={phColor}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                  <Text allowFontScaling={false} style={styles.personalBirthSlash}>
                    /
                  </Text>
                  <View style={styles.personalBirthCol}>
                    <Text allowFontScaling={false} style={styles.personalBirthMiniLabel}>
                      Year
                    </Text>
                    <TextInput
                      ref={birthYearInputRef}
                      value={birthYearInput}
                      onChangeText={(t) => setBirthYearInput(t.replace(/\D/g, "").slice(0, 4))}
                      onFocus={onBirthSegmentFocus}
                      onBlur={onBirthSegmentBlur}
                      style={[styles.personalBirthInput, styles.personalBirthYearInput]}
                      placeholder="—"
                      placeholderTextColor={phColor}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                  </View>
                </View>
              </View>
            </View>
          </Pressable>

          <TouchableOpacity
            activeOpacity={0.88}
            style={[
              styles.personalFieldBox,
              genderPickerOpen && styles.personalFieldBoxSelected,
            ]}
            onPress={() => {
              setGenderPickerOpen(true);
            }}
          >
            <View style={styles.personalFieldBody}>
              <Text allowFontScaling={false} style={styles.personalFieldLabel}>
                Gender
              </Text>
              <View style={styles.personalGenderValueRow}>
                <Text
                  allowFontScaling={false}
                  style={[styles.personalGenderValueText, !genderInput && { color: phColor }]}
                  numberOfLines={1}
                >
                  {genderInput || "Select"}
                </Text>
                <Ionicons name="chevron-down" size={20} color="rgba(200, 220, 255, 0.85)" />
              </View>
            </View>
          </TouchableOpacity>

          <SubsectionFooter
            onBack={() => setActiveSection(null)}
            primaryLabel="Save"
            onPrimary={saveBasicProfile}
            primaryDisabled={saving}
            primaryLoading={saving}
          />
        </KeyboardAwareScrollView>

        <Modal
          visible={genderPickerOpen}
          animationType="fade"
          transparent
          onRequestClose={() => setGenderPickerOpen(false)}
        >
          <View style={styles.countryModalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setGenderPickerOpen(false)} />
            <View style={[styles.countryModalCard, { maxHeight: winH * 0.5 }]}>
              <View style={styles.countryModalHeader}>
                <Text style={styles.countryModalTitle}>Gender</Text>
                <TouchableOpacity
                  onPress={() => setGenderPickerOpen(false)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={22} color={PERSONAL_LABEL_COLOR} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={GENDER_OPTIONS}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const selected = genderInput === item;
                  return (
                    <TouchableOpacity
                      style={[styles.countryRow, selected && styles.countryRowActive]}
                      onPress={() => {
                        setGenderInput(item);
                        setGenderPickerOpen(false);
                      }}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[styles.countryRowText, selected && styles.countryRowTextActive]}
                        numberOfLines={1}
                      >
                        {item}
                      </Text>
                      {selected ? (
                        <Ionicons name="checkmark" size={18} color="#18C0FF" />
                      ) : null}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  if (activeSection === "account") {
    const displayFullName =
      joinDisplayName(firstNameInput, lastNameInput) || data.user?.name || "Player";
    const phColor = theme.placeholderTextColor ?? theme.mutedForegroundColor;

    return (
      <View style={styles.screenRoot}>
        <Header flatOverlay onLogoPress={() => navigateMainTab("AICoach")} />
        <KeyboardAwareScrollView
          style={{ flex: 1, width: "100%" }}
          contentContainerStyle={[
            styles.subsectionScrollContent,
            {
              paddingHorizontal: pageHorizontalPad,
              paddingTop: 12,
              paddingBottom: 28 + insets.bottom,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={insets.bottom + 12}
        >
          <Text style={styles.detailPageHeading}>{currentTitle}</Text>

          <View style={styles.personalHeroRow}>
            <TouchableOpacity
              onPress={pickAndUploadAvatar}
              activeOpacity={0.88}
              accessibilityLabel="Change profile photo"
            >
              {profileImageUri ? (
                <Image source={{ uri: profileImageUri }} style={styles.personalHeroAvatar} />
              ) : (
                <View style={[styles.personalHeroAvatar, styles.personalHeroAvatarPlaceholder]}>
                  <Ionicons name="person" size={28} color="rgba(200,220,255,0.75)" />
                </View>
              )}
            </TouchableOpacity>
            <Text allowFontScaling={false} style={styles.personalHeroName} numberOfLines={2}>
              {displayFullName}
            </Text>
          </View>

          <Pressable
            style={[
              styles.personalFieldBox,
              accountFocusedField === "email" && styles.personalFieldBoxSelected,
            ]}
            onPress={() => accountEmailRef.current?.focus()}
          >
            <View style={styles.personalFieldBody}>
              <Text allowFontScaling={false} style={styles.personalFieldLabel}>
                Email
              </Text>
              <TextInput
                ref={accountEmailRef}
                value={accountEmailInput}
                onChangeText={setAccountEmailInput}
                onFocus={() => commitAccountFieldFocus("email")}
                onBlur={() => scheduleAccountBlurClear()}
                style={styles.personalFieldInput}
                placeholder="you@email.com"
                placeholderTextColor={phColor}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.personalFieldBox,
              accountFocusedField === "phone" && styles.personalFieldBoxSelected,
            ]}
            onPress={() => accountPhoneRef.current?.focus()}
          >
            <View style={styles.personalFieldBody}>
              <Text allowFontScaling={false} style={styles.personalFieldLabel}>
                Phone
              </Text>
              <TextInput
                ref={accountPhoneRef}
                value={accountPhoneInput}
                onChangeText={setAccountPhoneInput}
                onFocus={() => commitAccountFieldFocus("phone")}
                onBlur={() => scheduleAccountBlurClear()}
                style={styles.personalFieldInput}
                placeholder="Phone number"
                placeholderTextColor={phColor}
                keyboardType="phone-pad"
              />
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.personalFieldBox,
              accountFocusedField === "passwordCurrent" && styles.personalFieldBoxSelected,
            ]}
            onPress={() => accountPasswordCurrentRef.current?.focus()}
          >
            <View style={styles.personalFieldBody}>
              <Text allowFontScaling={false} style={styles.personalFieldLabel}>
                Password
              </Text>
              <View style={styles.personalPasswordValueRow}>
                <TextInput
                  ref={accountPasswordCurrentRef}
                  value={accountPasswordCurrent}
                  onChangeText={setAccountPasswordCurrent}
                  onFocus={() => commitAccountFieldFocus("passwordCurrent")}
                  onBlur={() => scheduleAccountBlurClear()}
                  style={[styles.personalFieldInput, styles.personalUsernameInput]}
                  placeholder="Current password"
                  placeholderTextColor={phColor}
                  secureTextEntry={!showAccountCurrentPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.personalPasswordIconSlot}
                  hitSlop={10}
                  onPress={() => setShowAccountCurrentPassword((v) => !v)}
                  activeOpacity={0.75}
                  accessibilityLabel={
                    showAccountCurrentPassword ? "Hide password" : "Show password"
                  }
                >
                  <LocalSvgAsset
                    assetModule={
                      showAccountCurrentPassword ? PASSWORD_SEE_ICON_SVG : PASSWORD_HIDE_ICON_SVG
                    }
                    width={PASSWORD_VISIBILITY_ICON_PX}
                    height={PASSWORD_VISIBILITY_ICON_PX}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.personalFieldBox,
              accountFocusedField === "passwordNew" && styles.personalFieldBoxSelected,
            ]}
            onPress={() => accountPasswordNewRef.current?.focus()}
          >
            <View style={styles.personalFieldBody}>
              <Text allowFontScaling={false} style={styles.personalFieldLabel}>
                Repeat password
              </Text>
              <View style={styles.personalPasswordValueRow}>
                <TextInput
                  ref={accountPasswordNewRef}
                  value={accountPasswordNew}
                  onChangeText={setAccountPasswordNew}
                  onFocus={() => commitAccountFieldFocus("passwordNew")}
                  onBlur={() => scheduleAccountBlurClear()}
                  style={[styles.personalFieldInput, styles.personalUsernameInput]}
                  placeholder="New password"
                  placeholderTextColor={phColor}
                  secureTextEntry={!showAccountNewPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.personalPasswordIconSlot}
                  hitSlop={10}
                  onPress={() => setShowAccountNewPassword((v) => !v)}
                  activeOpacity={0.75}
                  accessibilityLabel={showAccountNewPassword ? "Hide password" : "Show password"}
                >
                  <LocalSvgAsset
                    assetModule={
                      showAccountNewPassword ? PASSWORD_SEE_ICON_SVG : PASSWORD_HIDE_ICON_SVG
                    }
                    width={PASSWORD_VISIBILITY_ICON_PX}
                    height={PASSWORD_VISIBILITY_ICON_PX}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>

          <SubsectionFooter
            onBack={() => setActiveSection(null)}
            primaryLabel="Save"
            onPrimary={() => void saveAccountProfile()}
            primaryDisabled={accountSaving}
            primaryLoading={accountSaving}
          />
        </KeyboardAwareScrollView>
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
          <TouchableOpacity
            style={styles.countryTrigger}
            onPress={() => {
              setCountrySearch("");
              setCountryPickerOpen(true);
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Select country"
          >
              {locationCountry ? (
                <>
                  <Image source={locationCountry.flag} style={styles.countryTriggerFlag} />
                  <Text style={styles.countryTriggerText} numberOfLines={1}>
                    {locationCountry.name}
                  </Text>
                </>
              ) : (
                <Text style={styles.countryTriggerPlaceholder} numberOfLines={1}>
                  {locationInput ? locationInput : "Select your country"}
                </Text>
              )}
              <Ionicons name="chevron-down" size={18} color="rgba(200, 220, 255, 0.85)" />
          </TouchableOpacity>
          <SubsectionFooter
            onBack={() => setActiveSection(null)}
            primaryLabel="Save location"
            onPrimary={() => void saveLocationProfile()}
            primaryDisabled={locationSaving}
            primaryLoading={locationSaving}
          />

          <Modal
            visible={countryPickerOpen}
            animationType="fade"
            transparent
            onRequestClose={() => setCountryPickerOpen(false)}
          >
            <View style={styles.countryModalOverlay}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setCountryPickerOpen(false)}
              />
              <View style={[styles.countryModalCard, { maxHeight: winH * 0.78 }]}>
                <View style={styles.countryModalHeader}>
                  <Text style={styles.countryModalTitle}>Select country</Text>
                  <TouchableOpacity
                    onPress={() => setCountryPickerOpen(false)}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <Ionicons name="close" size={22} color={PERSONAL_LABEL_COLOR} />
                  </TouchableOpacity>
                </View>
                <View style={styles.countrySearchWrap}>
                  <Ionicons
                    name="search"
                    size={16}
                    color="rgba(200, 220, 255, 0.65)"
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    value={countrySearch}
                    onChangeText={setCountrySearch}
                    placeholder="Search country"
                    placeholderTextColor={PERSONAL_LABEL_COLOR}
                    style={styles.countrySearchInput}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                  />
                </View>
                <FlatList
                  data={countryResults}
                  keyExtractor={(item) => item.code}
                  keyboardShouldPersistTaps="handled"
                  initialNumToRender={20}
                  maxToRenderPerBatch={30}
                  windowSize={11}
                  ListEmptyComponent={
                    <Text style={styles.countryEmptyText}>No countries match &quot;{countrySearch}&quot;.</Text>
                  }
                  renderItem={({ item }) => {
                    const selected = locationCountry?.code === item.code;
                    return (
                      <TouchableOpacity
                        style={[styles.countryRow, selected && styles.countryRowActive]}
                        onPress={() => {
                          setLocationCountry(item);
                          setCountryPickerOpen(false);
                        }}
                        activeOpacity={0.85}
                      >
                        <Image source={item.flag} style={styles.countryRowFlag} />
                        <Text
                          style={[styles.countryRowText, selected && styles.countryRowTextActive]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        {selected ? (
                          <Ionicons name="checkmark" size={18} color="#18C0FF" />
                        ) : null}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </View>
          </Modal>
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
        </View>

        <View style={styles.badgeRow}>
          <View style={[styles.badgeFrame, { width: badgeShieldRowW, height: badgeShieldDisplayH + 12 }]}>
            <ShieldHeroRow
              rowWidth={badgeShieldRowW}
              coachName={data.user?.name || "Player"}
              coachImageUri={!loading ? profileImageUri : null}
              onSharePress={() => void shareProfile()}
              shareAccessibilityLabel="Share profile"
              shareIconModule={SHARE_BUTTON_SVG}
              shareIconSize={36}
              shieldCardProps={{
                variant: "profileSettings",
                showName: false,
                showScore: true,
                scoreLabel: "Score",
                scoreValue: String(overallPillarScore ?? 54),
                showFlag: false,
                showPillarScores: false,
                topNameScale: 2.15,
                brandLogoSource: XEVO_BLUE_WORDMARK,
                // Reflect the live picker selection (before save) and the saved value (after save).
                flagCode:
                  locationCountry?.code ??
                  findCountry(data.profile?.areaLocation ?? "")?.code ??
                  null,
              }}
            />
            <TouchableOpacity
              style={[
                styles.badgeCameraCorner,
                {
                  right: badgeCameraRightUnderShare,
                },
              ]}
              onPress={pickAndUploadAvatar}
              activeOpacity={0.88}
              accessibilityLabel="Change profile photo"
            >
              <LocalSvgAsset assetModule={CAMERA_ICON_SVG} width={18} height={18} />
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
            <LocalSvgAsset assetModule={BIRTHDAY_ICON_SVG} width={16} height={16} />
            <Text allowFontScaling={false} style={styles.quickInfoText} numberOfLines={1} ellipsizeMode="tail">
              {shieldQuickBirthLabel ?? "Date not set"}
            </Text>
          </View>
          <View style={styles.quickInfoItem}>
            <LocalSvgAsset assetModule={LOCATION_PIN_ICON_SVG} width={16} height={16} />
            <Text allowFontScaling={false} style={styles.quickInfoText} numberOfLines={1} ellipsizeMode="tail">
              {shieldQuickLocationLabel ?? "Location not set"}
            </Text>
          </View>
        </View>

        <AdminGradientCard innerStyle={{ overflow: "hidden" }}>
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
        </AdminGradientCard>

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
      width: PROFILE_SETTINGS_CAMERA_BTN_PX,
      height: PROFILE_SETTINGS_CAMERA_BTN_PX,
      borderRadius: PROFILE_SETTINGS_CAMERA_BTN_PX / 2,
      backgroundColor: "#0048FF",
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
      color: "#86A7D2",
      fontFamily: theme.regularFont,
      fontSize: 13,
      flexShrink: 1,
      maxWidth: 168,
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
    /** Location — matches `personalFieldBox` (Personal / Account). */
    countryTrigger: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      width: "100%",
      height: 60,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "transparent",
      backgroundColor: PERSONAL_FIELD_BG,
      paddingHorizontal: 12,
      paddingVertical: 5,
      marginBottom: 6,
    },
    countryTriggerFlag: {
      width: 26,
      height: 18,
      borderRadius: 3,
      backgroundColor: "rgba(255,255,255,0.06)",
    },
    countryTriggerText: {
      flex: 1,
      color: "#FFFFFF",
      fontFamily: theme.regularFont,
      fontSize: 17,
    },
    countryTriggerPlaceholder: {
      flex: 1,
      color: PERSONAL_LABEL_COLOR,
      fontFamily: theme.regularFont,
      fontSize: 17,
    },
    countryModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(1, 7, 25, 0.78)",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    countryModalCard: {
      backgroundColor: PERSONAL_FIELD_BG,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: PERSONAL_FIELD_BORDER_FOCUS,
      paddingTop: 12,
      paddingBottom: 8,
      overflow: "hidden",
    },
    countryModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingBottom: 10,
    },
    countryModalTitle: {
      color: "#FFFFFF",
      fontFamily: theme.semiBoldFont,
      fontSize: 17,
    },
    countrySearchWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: PROFILE_FIELD_BG,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "transparent",
      paddingHorizontal: 12,
      marginHorizontal: 12,
      marginBottom: 8,
      minHeight: 48,
    },
    countrySearchInput: {
      flex: 1,
      color: "#FFFFFF",
      fontFamily: theme.regularFont,
      fontSize: 17,
      paddingVertical: Platform.OS === "ios" ? 12 : 10,
    },
    countryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    countryRowActive: {
      backgroundColor: "rgba(0, 184, 255, 0.08)",
    },
    countryRowFlag: {
      width: 28,
      height: 20,
      borderRadius: 3,
      backgroundColor: "rgba(255,255,255,0.06)",
    },
    countryRowText: {
      flex: 1,
      color: "#FFFFFF",
      fontFamily: theme.regularFont,
      fontSize: 17,
    },
    countryRowTextActive: {
      color: "#FFFFFF",
      fontFamily: theme.semiBoldFont,
    },
    countryEmptyText: {
      color: PERSONAL_LABEL_COLOR,
      fontFamily: theme.regularFont,
      fontSize: 15,
      textAlign: "center",
      paddingVertical: 24,
      paddingHorizontal: 16,
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
    personalHeroRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      marginBottom: 22,
      marginTop: 4,
    },
    personalHeroAvatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: "rgba(255,255,255,0.06)",
    },
    personalHeroAvatarPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    personalHeroName: {
      flex: 1,
      color: "#FFFFFF",
      fontFamily: theme.semiBoldFont,
      fontSize: 20,
      letterSpacing: 0.2,
    },
    personalFieldBox: {
      width: "100%",
      borderRadius: 16,
      backgroundColor: PERSONAL_FIELD_BG,
      borderWidth: 1,
      borderColor: "transparent",
      paddingHorizontal: 12,
      paddingVertical: 5,
      marginBottom: 6,
      height: 60,
      flexDirection: "column",
      justifyContent: "flex-start",
    },
    personalFieldBoxSelected: {
      borderColor: PERSONAL_FIELD_BORDER_FOCUS,
    },
    personalFieldBody: {
      flex: 1,
      width: "100%",
      minHeight: 0,
      justifyContent: "center",
    },
    personalFieldLabel: {
      color: PERSONAL_LABEL_COLOR,
      fontFamily: theme.mediumFont,
      fontSize: 12,
      lineHeight: 14,
      marginBottom: 2,
    },
    personalFieldInput: {
      color: "#FFFFFF",
      fontFamily: theme.regularFont,
      fontSize: 17,
      padding: 0,
      margin: 0,
      height: 22,
    },
    personalUsernameRow: {
      flexDirection: "row",
      alignItems: "center",
      height: 22,
    },
    /** Password rows only: 26px icon + 22px input, vertically centered together (no clipping). */
    personalPasswordValueRow: {
      flexDirection: "row",
      alignItems: "center",
      height: PASSWORD_VISIBILITY_ICON_PX,
    },
    personalUsernameAt: {
      color: "#FFFFFF",
      fontFamily: theme.regularFont,
      fontSize: 17,
      marginRight: 2,
    },
    personalUsernameInput: {
      flex: 1,
    },
    /** Visual nudge only — `transform` does not shift sibling layout (DMY stays put). */
    personalBirthSectionLabel: {
      color: PERSONAL_LABEL_COLOR,
      fontFamily: theme.mediumFont,
      fontSize: 11,
      lineHeight: 12,
      marginBottom: 2,
      transform: [{ translateY: 8 }],
    },
    personalBirthDateClusterWrap: {
      width: "100%",
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      transform: [{ translateY: -5 }],
    },
    personalBirthValueRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "flex-start",
      flexWrap: "nowrap",
      gap: 4,
    },
    personalBirthCol: {
      alignItems: "center",
      minWidth: 38,
    },
    personalBirthMiniLabel: {
      color: "#86A7D2",
      fontFamily: theme.mediumFont,
      fontSize: 10,
      lineHeight: 12,
      marginBottom: 2,
    },
    personalBirthInput: {
      color: "#FFFFFF",
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
      textAlign: "center",
      minWidth: 36,
      height: 22,
      paddingVertical: 0,
      paddingHorizontal: 2,
    },
    personalBirthYearInput: {
      minWidth: 52,
    },
    personalBirthSlash: {
      color: "rgba(200, 220, 255, 0.55)",
      fontSize: 16,
      paddingBottom: 0,
      fontFamily: theme.regularFont,
    },
    personalGenderValueRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginTop: 0,
      height: 22,
    },
    personalGenderValueText: {
      flex: 1,
      color: "#FFFFFF",
      fontFamily: theme.regularFont,
      fontSize: 17,
      minWidth: 0,
    },
    personalPasswordIconSlot: {
      width: 36,
      height: PASSWORD_VISIBILITY_ICON_PX,
      alignItems: "center",
      justifyContent: "center",
      /** Optical nudge only — does not shift the TextInput or row layout. */
      transform: [{ translateY: -7 }],
    },
  });
}
