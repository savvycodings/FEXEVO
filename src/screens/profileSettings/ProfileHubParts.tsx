import React, { useContext, useState } from "react";
import {
  Image,
  Linking,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  type ImageSourcePropType,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "../../context";
import { LocalSvgAsset } from "../../components/LocalSvgAsset";
import { PG, glow } from "../progress/progressTheme";
import { PillChip, SegmentedPills } from "../progress/SegmentedPills";
import { DOMAIN } from "../../../constants";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export type ProfileHubTab = "profile" | "stats" | "achievements" | "settings";

/* ------------------------------------------------------------------------------------------------
 * Identity header: round avatar (camera corner), name + PRO pill, email.
 * ---------------------------------------------------------------------------------------------- */

export function ProfileIdentityHeader({
  avatarSource,
  name,
  email,
  isPro,
  onAvatarPress,
  onProPress,
  uploading,
}: {
  avatarSource: ImageSourcePropType;
  name: string;
  email?: string | null;
  isPro: boolean;
  onAvatarPress: () => void;
  onProPress: () => void;
  uploading?: boolean;
}) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  return (
    <View style={s.identityRow} testID="profile-hub-identity">
      <TouchableOpacity
        onPress={onAvatarPress}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel={t("profileSettingsUi.changeProfilePhoto")}
        style={[s.avatarRing, glow(18, 0.75)]}
      >
        <Image source={avatarSource} style={s.avatar} resizeMode="cover" />
        <View style={s.avatarCamera}>
          <Ionicons name={uploading ? "cloud-upload-outline" : "camera-outline"} size={14} color="#CFE0FF" />
        </View>
      </TouchableOpacity>
      <View style={s.identityText}>
        <View style={s.nameRow}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[s.name, { fontFamily: theme.semiBoldFont }]}
          >
            {name}
          </Text>
          <PillChip
            label={isPro ? "PRO" : t("profileHub.getPro")}
            active={isPro}
            onPress={onProPress}
            style={s.proPill}
            textStyle={s.proPillText}
            fontFamily={theme.semiBoldFont}
            activeFontFamily={theme.boldFont ?? theme.semiBoldFont}
            testID="profile-hub-pro-pill"
          />
        </View>
        {email ? (
          <Text allowFontScaling={false} numberOfLines={1} style={[s.email, { fontFamily: theme.regularFont }]}>
            {email}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Tabs: the shared SegmentedPills so they match Progress / Activities.
 * ---------------------------------------------------------------------------------------------- */

export function ProfileHubTabs({ value, onChange }: { value: ProfileHubTab; onChange: (k: ProfileHubTab) => void }) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  return (
    <SegmentedPills<ProfileHubTab>
      options={[
        { key: "profile", label: t("profileHub.tabProfile"), testID: "profile-hub-tab-profile" },
        { key: "stats", label: t("profileHub.tabStats"), testID: "profile-hub-tab-stats" },
        { key: "achievements", label: t("profileHub.tabAchievements"), testID: "profile-hub-tab-achievements" },
        { key: "settings", label: t("profileHub.tabSettings"), testID: "profile-hub-tab-settings" },
      ]}
      value={value}
      onChange={onChange}
      fontFamily={theme.mediumFont}
      activeFontFamily={theme.semiBoldFont}
      style={s.tabs}
      accessibilityLabel={t("profileSettingsUi.profileEdit")}
    />
  );
}

/* ------------------------------------------------------------------------------------------------
 * One glowing card per row, same fill / border / glow as the Progress cards.
 * ---------------------------------------------------------------------------------------------- */

export function ProfileHubRow({
  title,
  subtitle,
  icon,
  iconModule,
  onPress,
  testID,
  tone = "default",
  trailing,
  value,
  compact,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconModule?: number;
  onPress?: () => void;
  testID?: string;
  tone?: "default" | "danger";
  /** Replaces the chevron (e.g. a Switch). */
  trailing?: React.ReactNode;
  /** Right-aligned value before the chevron (e.g. "181 cm"). */
  value?: string;
  /** Shorter single-line row for value lists. */
  compact?: boolean;
}) {
  const { theme } = useContext(ThemeContext);
  const danger = tone === "danger";
  const iconColor = danger ? "#FF6B5E" : "#2F7BFF";
  const body = (
    <LinearGradient
      colors={[PG.cardTop, PG.cardBottom]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[s.rowCard, compact && s.rowCardCompact, danger && s.rowCardDanger]}
    >
      <View style={[s.rowIcon, compact && s.rowIconCompact]}>
        {iconModule != null ? (
          <LocalSvgAsset assetModule={iconModule} width={compact ? 24 : 30} height={compact ? 24 : 30} strokeColor={iconColor} />
        ) : icon ? (
          <Ionicons name={icon} size={compact ? 24 : 30} color={iconColor} />
        ) : null}
      </View>
      <View style={s.rowText}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[s.rowTitle, danger && { color: "#FF6B5E" }, { fontFamily: theme.mediumFont }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text allowFontScaling={false} numberOfLines={1} style={[s.rowSubtitle, { fontFamily: theme.regularFont }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value != null ? (
        <Text allowFontScaling={false} numberOfLines={1} style={[s.rowValue, { fontFamily: theme.mediumFont }]}>
          {value}
        </Text>
      ) : null}
      {trailing ?? (onPress ? <Ionicons name="chevron-forward" size={20} color={danger ? "#FF6B5E" : "#86A7D2"} /> : null)}
    </LinearGradient>
  );
  const outer = [s.rowOuter, compact && s.rowOuterCompact, glow(10, 0.35)];
  if (!onPress) return <View style={outer}>{body}</View>;
  return (
    <TouchableOpacity
      style={outer}
      activeOpacity={0.85}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
    >
      {body}
    </TouchableOpacity>
  );
}

/** Small "mock" banner shown on sections that do not save to the backend yet. */
export function MockNotice({ text }: { text?: string } = {}) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  return (
    <View style={s.mockNotice}>
      <Ionicons name="construct-outline" size={16} color={PG.labelBlue} />
      <Text allowFontScaling={false} style={[s.mockNoticeText, { fontFamily: theme.regularFont }]}>
        {text ?? t("profileHub.mockNotice")}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Athlete Calibration: choose manual measurements or a 3D body scan.
 * ---------------------------------------------------------------------------------------------- */

const CALIBRATION_ART = {
  manual: require("../../../assets/calibration/manual.jpg"),
  scan: require("../../../assets/calibration/scan.jpg"),
} as const;

export function CalibrationChooser({ onManual, onScan }: { onManual: () => void; onScan: () => void }) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const options = [
    { key: "manual" as const, title: t("profileHub.calManualTitle"), body: t("profileHub.calManualBody"), onPress: onManual },
    { key: "scan" as const, title: t("profileHub.calScanTitle"), body: t("profileHub.calScanBody"), onPress: onScan },
  ];
  return (
    <View style={{ gap: 16 }}>
      <Text allowFontScaling={false} style={[s.calIntro, { fontFamily: theme.regularFont }]}>
        {t("profileHub.calIntro")}
      </Text>
      {options.map((o) => (
        <TouchableOpacity
          key={o.key}
          onPress={o.onPress}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={`${o.title}, ${o.body}`}
          testID={`calibration-${o.key}`}
          style={[s.calOuter, glow(16, 0.5)]}
        >
          <LinearGradient
            colors={[PG.cardTop, PG.cardBottom]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={s.calCard}
          >
            <Image source={CALIBRATION_ART[o.key]} style={s.calArt} resizeMode="cover" />
            <View style={s.calText}>
              <Text allowFontScaling={false} style={[s.calTitle, { fontFamily: theme.semiBoldFont }]}>
                {o.title}
              </Text>
              <Text allowFontScaling={false} style={[s.calBody, { fontFamily: theme.regularFont }]}>
                {o.body}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#86A7D2" />
          </LinearGradient>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Privacy & Data (links are live; toggles / export are mock).
 * ---------------------------------------------------------------------------------------------- */

export function PrivacyDataSection() {
  const { t } = useTranslation();
  const [shareForTraining, setShareForTraining] = useState(true);
  const [publicProfile, setPublicProfile] = useState(true);
  const [exportRequested, setExportRequested] = useState(false);
  const toggle = (value: boolean, onChange: (v: boolean) => void, testID: string) => (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: PG.barTrack, true: "#2F7BFF" }}
      thumbColor="#FFFFFF"
      {...({ activeThumbColor: "#FFFFFF" } as object)}
      ios_backgroundColor={PG.barTrack}
      testID={testID}
    />
  );
  return (
    <View style={{ gap: 12 }}>
      <MockNotice />
      <ProfileHubRow
        icon="globe-outline"
        title={t("profileHub.publicProfile")}
        subtitle={t("profileHub.publicProfileSub")}
        trailing={toggle(publicProfile, setPublicProfile, "privacy-public-profile")}
      />
      <ProfileHubRow
        icon="sparkles-outline"
        title={t("profileHub.improveXevo")}
        subtitle={t("profileHub.improveXevoSub")}
        trailing={toggle(shareForTraining, setShareForTraining, "privacy-share-training")}
      />
      <ProfileHubRow
        icon="download-outline"
        title={t("profileHub.downloadData")}
        subtitle={exportRequested ? t("profileHub.downloadDataRequested") : t("profileHub.downloadDataSub")}
        onPress={() => setExportRequested(true)}
      />
      <ProfileHubRow
        icon="document-text-outline"
        title={t("profileHub.privacyPolicy")}
        subtitle={t("profileHub.privacyPolicySub")}
        onPress={() => void Linking.openURL(`${DOMAIN}/privacy`)}
      />
      <ProfileHubRow
        icon="trash-outline"
        tone="danger"
        title={t("profileHub.deleteData")}
        subtitle={t("profileHub.deleteDataSub")}
        onPress={() => void Linking.openURL(`${DOMAIN}/data-deletion`)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  identityRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 4, marginBottom: 22 },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: "rgba(0, 102, 255, 0.85)",
    padding: 3,
    backgroundColor: PG.cardBottom,
  },
  avatar: { width: "100%", height: "100%", borderRadius: 999 },
  avatarCamera: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PG.cardTop,
    borderWidth: 1,
    borderColor: PG.border,
  },
  identityText: { flex: 1, minWidth: 0, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { flexShrink: 1, fontSize: 22, color: "#FFFFFF" },
  proPill: { paddingHorizontal: 12, height: 26 },
  proPillText: { fontSize: 12, letterSpacing: 1.2 },
  email: { fontSize: 14, color: "#86A7D2" },
  tabs: { marginBottom: 16 },
  rowOuter: { borderRadius: 24, marginBottom: 12 },
  rowOuterCompact: { borderRadius: 20, marginBottom: 10 },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 76,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: PG.border,
  },
  rowCardCompact: { minHeight: 58, paddingVertical: 10, borderRadius: 20 },
  rowIconCompact: { width: 30 },
  rowValue: { fontSize: 15, color: "#FFFFFF", marginLeft: 8 },
  rowCardDanger: { borderColor: "rgba(255, 107, 94, 0.45)" },
  rowIcon: { width: 40, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { fontSize: 16, color: "#FFFFFF" },
  rowSubtitle: { fontSize: 13, color: "#86A7D2" },
  mockNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PG.borderSoft,
    backgroundColor: "rgba(0, 102, 255, 0.08)",
  },
  mockNoticeText: { flex: 1, fontSize: 12, color: "#86A7D2" },
  calIntro: { fontSize: 14, lineHeight: 20, color: "#86A7D2", marginBottom: 4 },
  calOuter: { borderRadius: 26 },
  calCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    paddingRight: 16,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: "rgba(77, 166, 255, 0.75)",
  },
  calArt: { width: 116, height: 176, borderRadius: 18 },
  calText: { flex: 1, minWidth: 0, gap: 8 },
  calTitle: { fontSize: 17, color: "#FFFFFF" },
  calBody: { fontSize: 14, lineHeight: 20, color: "#86A7D2" },
  soonPill: { paddingHorizontal: 10, height: 24 },
  soonPillText: { fontSize: 11 },
});
