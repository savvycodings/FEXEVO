import React, { useContext, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../navigation/types";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemeContext } from "../context";
import { ADMIN_HUB_GATE_PASSWORD } from "../config/adminHubGate";
import { AdminGradientCard } from "../components/AdminGradientCard";

type Props = {
  onClose: () => void;
  onOpenProLibraryVideo: () => void;
  onOpenLora: () => void;
  /** After one successful unlock, stays true until user leaves admin (parent resets). */
  hubUnlocked: boolean;
  onHubUnlocked: () => void;
};

export function AdminHub({
  onClose,
  onOpenProLibraryVideo,
  onOpenLora,
  hubUnlocked,
  onHubUnlocked,
}: Props) {
  const { theme } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const styles = getStyles(theme);
  const [gatePassword, setGatePassword] = useState("");

  function tryUnlock() {
    if (gatePassword.trim() === ADMIN_HUB_GATE_PASSWORD) {
      setGatePassword("");
      onHubUnlocked();
      return;
    }
    Alert.alert("Incorrect", "Password is wrong.");
  }

  if (!hubUnlocked) {
    return (
      <View style={styles.screen}>
        <View style={[styles.topBar, { paddingTop: insets.top + 6, paddingBottom: 10 }]}>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.backBtn} accessibilityRole="button">
            <Ionicons name="chevron-back" size={22} color="#00BBFF" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Admin</Text>
          <View style={{ width: 28 }} />
        </View>
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.gateScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={insets.bottom + 12}
        >
        <View style={styles.centerBlock}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={gatePassword}
            onChangeText={setGatePassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={tryUnlock} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>
        </KeyboardAwareScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + 6, paddingBottom: 10 }]}>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.backBtn} accessibilityRole="button">
          <Ionicons name="chevron-back" size={22} color="#00BBFF" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Admin</Text>
        <View style={{ width: 28 }} />
      </View>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={insets.bottom + 12}
      >
        <AdminGradientCard
          onPress={() => navigation.navigate("AdminMembers", { filter: "all" })}
          style={styles.cardTouch}
          accessibilityRole="button"
          accessibilityLabel="View all members"
        >
          <View style={styles.cardInner}>
            <View style={styles.cardIconWrap}>
              <Ionicons name="people-outline" size={28} color="#00BBFF" />
            </View>
            <View style={styles.cardTextCol}>
              <Text style={styles.cardTitle}>See all members</Text>
              <Text style={styles.cardBody}>Directory with name, username, and coach/student role.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.35)" />
          </View>
        </AdminGradientCard>
        <AdminGradientCard
          onPress={() => navigation.navigate("AdminMembers", { filter: "coach" })}
          style={styles.cardTouch}
          accessibilityRole="button"
          accessibilityLabel="View coaches"
        >
          <View style={styles.cardInner}>
            <View style={styles.cardIconWrap}>
              <Ionicons name="ribbon-outline" size={28} color="#00BBFF" />
            </View>
            <View style={styles.cardTextCol}>
              <Text style={styles.cardTitle}>See coaches</Text>
              <Text style={styles.cardBody}>Accounts with the coach role in their profile.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.35)" />
          </View>
        </AdminGradientCard>
        <AdminGradientCard
          onPress={() => navigation.navigate("AdminMembers", { filter: "student" })}
          style={styles.cardTouch}
          accessibilityRole="button"
          accessibilityLabel="View students"
        >
          <View style={styles.cardInner}>
            <View style={styles.cardIconWrap}>
              <Ionicons name="school-outline" size={28} color="#00BBFF" />
            </View>
            <View style={styles.cardTextCol}>
              <Text style={styles.cardTitle}>See students</Text>
              <Text style={styles.cardBody}>Accounts marked as students for coach flows.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.35)" />
          </View>
        </AdminGradientCard>

        <AdminGradientCard
          onPress={onOpenProLibraryVideo}
          style={styles.cardTouch}
          accessibilityRole="button"
          accessibilityLabel="Pro library video upload"
        >
          <View style={styles.cardInner}>
            <View style={styles.cardIconWrap}>
              <Ionicons name="videocam-outline" size={28} color="#00BBFF" />
            </View>
            <View style={styles.cardTextCol}>
              <Text style={styles.cardTitle}>Pro library video</Text>
              <Text style={styles.cardBody}>
                Upload MP4/MOV clips with stroke labels. Used for embeddings, nearest-neighbor match on view
                results, and Summary.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.35)" />
          </View>
        </AdminGradientCard>

        <AdminGradientCard
          onPress={onOpenLora}
          style={styles.cardTouch}
          accessibilityRole="button"
          accessibilityLabel="LoRA dataset and FAL training"
        >
          <View style={styles.cardInner}>
            <View style={styles.cardIconWrap}>
              <Ionicons name="images-outline" size={28} color="#00BBFF" />
            </View>
            <View style={styles.cardTextCol}>
              <Text style={styles.cardTitle}>LoRA images (FAL)</Text>
              <Text style={styles.cardBody}>
                Curate stills into a dataset and train on fal.ai. For better generated imagery: not for
                vector similarity search.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.35)" />
          </View>
        </AdminGradientCard>
      </KeyboardAwareScrollView>
    </View>
  );
}

function getStyles(theme: any) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.backgroundColor },
    gateScroll: { flexGrow: 1, justifyContent: "center", paddingVertical: 24 },
    centerBlock: { justifyContent: "center", paddingHorizontal: 24, gap: 12 },
    label: { color: "rgba(255,255,255,0.85)", fontFamily: theme.mediumFont, fontSize: 13 },
    input: {
      borderWidth: 1,
      borderColor: "rgba(0, 120, 255, 0.45)",
      backgroundColor: "rgba(2, 26, 92, 0.45)",
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.textColor,
      fontFamily: theme.regularFont,
      fontSize: 15,
    },
    primaryBtn: {
      backgroundColor: "#0022FF",
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    primaryBtnText: { color: "#fff", fontFamily: theme.semiBoldFont, fontSize: 15 },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "rgba(255,255,255,0.1)",
    },
    backBtn: { padding: 4 },
    topTitle: { color: theme.textColor, fontFamily: theme.semiBoldFont, fontSize: 17 },
    scroll: { padding: 20, paddingBottom: 48, gap: 16 },
    cardTouch: { alignSelf: "stretch" },
    cardInner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: 16,
      paddingHorizontal: 16,
    },
    cardIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: "rgba(0, 187, 255, 0.12)",
      alignItems: "center",
      justifyContent: "center",
    },
    cardTextCol: { flex: 1, minWidth: 0 },
    cardTitle: {
      color: theme.textColor,
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
      marginBottom: 6,
    },
    cardBody: {
      color: "rgba(255,255,255,0.72)",
      fontFamily: theme.regularFont,
      fontSize: 13,
      lineHeight: 18,
    },
  });
}
