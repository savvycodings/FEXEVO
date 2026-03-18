import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  TextInput,
  Alert,
} from "react-native";
import { ThemeContext } from "../context";
import { authClient } from "../lib/auth-client";
import { LinearGradient } from "expo-linear-gradient";
import { DOMAIN } from "../../constants";
import * as ImagePicker from "expo-image-picker";

type ProfileData = {
  user?: { name?: string; email?: string; image?: string | null };
  profile?: {
    username?: string | null;
    gender?: string | null;
    level?: string | null;
    rankingOrg?: string | null;
    rankingValue?: string | null;
  } | null;
};

const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"];

export function Profile(props?: { onProfileUpdated?: () => void }) {
  const { theme } = useContext(ThemeContext);
  const styles = getStyles(theme);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProfileData>({});
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [genderInput, setGenderInput] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await authClient.$fetch("/profile/me", { method: "GET" }).catch(() => null);
    const body = ((res as any)?.data ?? res) as ProfileData | null;
    if (body) {
      setData(body);
      setNameInput(body.user?.name || "");
      setUsernameInput(body.profile?.username || "");
      setGenderInput(body.profile?.gender || null);
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
    setLoading(false);
  }

  useEffect(() => {
    void load();
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
        // @ts-ignore web file append
        form.append("avatar", file);
      } else {
        // @ts-ignore React Native FormData file
        form.append("avatar", { uri, name: "avatar.jpg", type: "image/jpeg" });
      }
      await authClient.$fetch("/profile/avatar", {
        method: "POST",
        body: form,
      });
      await load();
      props?.onProfileUpdated?.();
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
    await load();
    props?.onProfileUpdated?.();
    setEditMode(false);
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#00BBFF" />
      </View>
    );
  }

  const levelText =
    data.profile?.level ||
    (data.profile?.rankingOrg && data.profile?.rankingValue
      ? `${data.profile.rankingOrg}: ${data.profile.rankingValue}`
      : "Not set");

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.identityBlock}>
          <TouchableOpacity style={styles.avatarWrap} onPress={pickAndUploadAvatar} activeOpacity={0.85}>
          {profileImageUri ? (
            <Image source={{ uri: profileImageUri }} style={styles.avatar} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarFallback}>
                {(data.user?.name || "U").slice(0, 1).toUpperCase()}
              </Text>
            )}
            {avatarSaving ? <Text style={styles.avatarSavingText}>...</Text> : null}
          </TouchableOpacity>
          <View style={styles.identityText}>
          <Text style={styles.name}>{data.user?.name || "Player"}</Text>
          {data.profile?.username ? <Text style={styles.username}>@{data.profile.username}</Text> : null}
          <Text style={styles.email}>{data.user?.email || "-"}</Text>
          </View>
        </View>
        <View style={styles.levelChip}>
          <Text style={styles.levelChipText}>Level: {levelText}</Text>
        </View>
        {data.profile?.gender ? (
          <View style={[styles.levelChip, { marginTop: -2 }]}>
            <Text style={styles.levelChipText}>Gender: {data.profile.gender}</Text>
          </View>
        ) : null}
        <View style={styles.editCard}>
          <View>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={theme.mutedForegroundColor}
            />
          </View>
          <View>
            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              value={usernameInput}
              onChangeText={setUsernameInput}
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={theme.mutedForegroundColor}
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
                  <Text style={[styles.chipText, genderInput === opt && styles.chipTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.secondaryBtn, saving && { opacity: 0.5 }]}
              onPress={resetEditDraft}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryBtnText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveOuter, saving && { opacity: 0.5 }]}
              onPress={saveBasicProfile}
              disabled={saving}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#0022FF", "#00BBFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.saveInner}
              >
                <Text style={styles.saveText}>{saving ? "Saving..." : "Save Changes"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          onPress={async () => {
            await authClient.signOut().catch(() => null);
          }}
          style={[styles.refreshBtn, { marginTop: 4, borderColor: "rgba(255,80,95,0.6)" }]}
          activeOpacity={0.8}
        >
          <Text style={[styles.refreshBtnText, { color: "#FF8A95" }]}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.backgroundColor, paddingHorizontal: 24, paddingTop: 20 },
    loadingWrap: { flex: 1, backgroundColor: theme.backgroundColor, alignItems: "center", justifyContent: "center" },
    card: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(0, 102, 255, 0.4)",
      backgroundColor: "rgba(7, 16, 46, 0.9)",
      padding: 18,
      alignItems: "center",
      gap: 8,
    },
    identityBlock: {
      alignItems: "center",
      gap: 8,
    },
    identityText: {
      alignItems: "center",
    },
    avatarWrap: {
      width: 86,
      height: 86,
      borderRadius: 43,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "rgba(0, 134, 255, 0.5)",
      backgroundColor: "rgba(0, 94, 255, 0.35)",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarSavingText: {
      position: "absolute",
      bottom: 2,
      right: 8,
      color: "#9CC2FF",
      fontFamily: theme.semiBoldFont,
      fontSize: 12,
    },
    avatar: { width: 86, height: 86 },
    avatarFallback: { color: "#fff", fontFamily: theme.semiBoldFont, fontSize: 26 },
    name: { color: "#fff", fontFamily: theme.semiBoldFont, fontSize: 22 },
    username: { color: "#8DBBFF", fontFamily: theme.mediumFont, fontSize: 13, marginTop: -2 },
    email: { color: "rgba(255,255,255,0.7)", fontFamily: theme.regularFont, fontSize: 13 },
    levelChip: {
      marginTop: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "rgba(0, 120, 255, 0.45)",
      backgroundColor: "rgba(2, 26, 92, 0.45)",
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    levelChipText: { color: "#9CC2FF", fontFamily: theme.mediumFont, fontSize: 12 },
    refreshBtn: {
      marginTop: 8,
      borderRadius: 10,
      backgroundColor: "rgba(0, 108, 255, 0.35)",
      borderWidth: 1,
      borderColor: "rgba(0, 120, 255, 0.6)",
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    refreshBtnText: { color: "#fff", fontFamily: theme.mediumFont, fontSize: 12 },
    editCard: {
      width: "100%",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "rgba(0, 120, 255, 0.35)",
      backgroundColor: "rgba(2, 26, 92, 0.35)",
      padding: 12,
      gap: 8,
      marginTop: 6,
    },
    inputLabel: { color: "rgba(255,255,255,0.8)", fontFamily: theme.mediumFont, marginBottom: 4, fontSize: 12 },
    input: {
      minHeight: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(0, 120, 255, 0.4)",
      backgroundColor: "rgba(2, 26, 92, 0.45)",
      color: "#fff",
      paddingHorizontal: 12,
      fontFamily: theme.regularFont,
      fontSize: 13,
    },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between" },
    chip: {
      width: "48.5%",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(0, 120, 255, 0.45)",
      backgroundColor: "rgba(2, 26, 92, 0.45)",
      paddingHorizontal: 12,
      paddingVertical: 8,
      alignItems: "center",
    },
    chipActive: { borderColor: "#00BBFF", backgroundColor: "rgba(0, 94, 255, 0.38)" },
    chipText: { fontFamily: theme.mediumFont, color: "#79AFFF", fontSize: 12 },
    chipTextActive: { color: "#fff" },
    actionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
    secondaryBtn: {
      flex: 1,
      minHeight: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(0, 120, 255, 0.45)",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(2, 26, 92, 0.45)",
    },
    secondaryBtnText: { color: "#9CC2FF", fontFamily: theme.mediumFont, fontSize: 13 },
    saveOuter: { flex: 1, borderRadius: 12, overflow: "hidden" },
    saveInner: { minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 12 },
    saveText: { color: "#fff", fontFamily: theme.semiBoldFont, fontSize: 13 },
  });
}

