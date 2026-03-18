import React, { useContext, useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity, Platform } from "react-native";
import { ThemeContext } from "../context";
import { authClient } from "../lib/auth-client";
import { LinearGradient } from "expo-linear-gradient";
import { DOMAIN } from "../../constants";
import * as ImagePicker from "expo-image-picker";

type ProfileData = {
  user?: { name?: string; email?: string; image?: string | null };
  profile?: { level?: string | null; rankingOrg?: string | null; rankingValue?: string | null } | null;
};

export function Profile(props?: { onEditProfile?: () => void }) {
  const { theme } = useContext(ThemeContext);
  const styles = getStyles(theme);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProfileData>({});
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await authClient.$fetch("/profile/me", { method: "GET" }).catch(() => null);
    const body = ((res as any)?.data ?? res) as ProfileData | null;
    if (body) {
      setData(body);
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
    } finally {
      setAvatarSaving(false);
    }
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
        <View style={styles.identityPress}>
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
          <TouchableOpacity onPress={props?.onEditProfile} activeOpacity={0.85}>
          <Text style={styles.name}>{data.user?.name || "Player"}</Text>
          <Text style={styles.email}>{data.user?.email || "-"}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.levelChip}>
          <Text style={styles.levelChipText}>Level: {levelText}</Text>
        </View>
        <TouchableOpacity onPress={props?.onEditProfile} style={styles.editButtonOuter} activeOpacity={0.85}>
          <LinearGradient
            colors={["#00BBFF", "#0022FF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.editButtonInner}
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void load()} style={styles.refreshBtn} activeOpacity={0.8}>
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>
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
    identityPress: {
      alignItems: "center",
      gap: 8,
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
    editButtonOuter: {
      width: "100%",
      marginTop: 6,
      borderRadius: 14,
      overflow: "hidden",
    },
    editButtonInner: {
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
    },
    editButtonText: {
      color: "#FFFFFF",
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
    },
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
  });
}

