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
import { SegmentedPills } from "../progress/SegmentedPills";
import { DOMAIN } from "../../../constants";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export type ProfileHubTab = "profile" | "stats" | "achievements" | "settings";

/** Figma PRO pill — same chrome for Get PRO and PRO. */
const PRO_PILL_COLORS = ["#00BBFF", "#003CFF", "#0022FF"] as const;
const PRO_PILL_LOCS = [0.0907, 0.7715, 0.9093] as const;

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
  /**
   * No subscription entitlement is wired yet (`isPro` is hardcoded false at the hub).
   * Until real Pro status exists, always show the PRO mark (not "Get PRO").
   * When entitlement lands: show only when `isPro`; hide for free users.
   */
  const showProPill = true;
  void isPro;
  return (
    <View style={s.identityRow} testID="profile-hub-identity">
      <TouchableOpacity
        onPress={onAvatarPress}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel={t("profileSettingsUi.changeProfilePhoto")}
        style={s.avatarHit}
      >
        <View style={s.avatarRing}>
          <Image source={avatarSource} style={s.avatar} resizeMode="cover" />
        </View>
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
          {showProPill ? (
            <TouchableOpacity
              onPress={onProPress}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="PRO"
              testID="profile-hub-pro-pill"
              style={[s.proPill, s.proPillPro]}
            >
              <LinearGradient
                colors={[...PRO_PILL_COLORS]}
                locations={[...PRO_PILL_LOCS]}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[s.proPillText, { fontFamily: theme.oswaldMedium }]}
              >
                PRO
              </Text>
            </TouchableOpacity>
          ) : null}
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
      variant="flat"
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
  iconImage,
  onPress,
  testID,
  tone = "default",
  trailing,
  value,
  compact,
  /** Explicit row height (e.g. body measurements: 46 / 70). Overrides compact minHeight. */
  rowHeight,
  /** Outer vertical gap below the row (default 12 / compact 10). */
  rowGap,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconModule?: number;
  /** Raster/PNG hub icons (preferred over Ionicons for profile menu). */
  iconImage?: ImageSourcePropType;
  onPress?: () => void;
  testID?: string;
  tone?: "default" | "danger";
  /** Replaces the chevron (e.g. a Switch). */
  trailing?: React.ReactNode;
  /** Right-aligned value before the chevron (e.g. "181 cm"). */
  value?: string;
  /** Shorter single-line row for value lists. */
  compact?: boolean;
  rowHeight?: number;
  rowGap?: number;
}) {
  const { theme } = useContext(ThemeContext);
  const danger = tone === "danger";
  const iconColor = danger ? "#FF6B5E" : "#2F7BFF";
  /** Tall body-measurement tiles: icon is ~60 (assets already include their own frame). */
  const tall = rowHeight != null && rowHeight >= 70;
  const iconPx = tall ? 60 : compact || rowHeight != null ? 24 : 30;
  const sized =
    rowHeight != null
      ? tall
        ? {
            height: rowHeight,
            minHeight: rowHeight,
            paddingVertical: 0,
            paddingHorizontal: 5,
            borderRadius: 10,
            gap: 10,
          }
        : {
            height: rowHeight,
            minHeight: rowHeight,
            paddingVertical: 0,
            borderRadius: 16,
          }
      : null;
  const body = (
    <View style={[s.rowCard, compact && s.rowCardCompact, sized, danger && s.rowCardDanger]}>
      <View style={[s.rowIcon, (compact || rowHeight != null) && s.rowIconCompact, tall && s.rowIconTall]}>
        {iconImage != null ? (
          <Image source={iconImage} style={{ width: iconPx, height: iconPx }} resizeMode="contain" />
        ) : iconModule != null ? (
          <LocalSvgAsset assetModule={iconModule} width={iconPx} height={iconPx} strokeColor={iconColor} />
        ) : icon ? (
          <Ionicons name={icon} size={iconPx} color={iconColor} />
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
    </View>
  );
  const outer = [
    s.rowOuter,
    compact && s.rowOuterCompact,
    tall && s.rowOuterTall,
    rowHeight != null && rowHeight <= 50 && s.rowOuterCompact,
    rowGap != null && { marginBottom: rowGap },
  ];
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
  avatarHit: { width: 96, height: 96 },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: "#07256D",
    overflow: "hidden",
    backgroundColor: PG.cardBottom,
    // Figma: 0 0 10px #0048FF80
    boxShadow: "0px 0px 10px 0px #0048FF80",
  },
  /** Slightly oversized so the photo fills to the ring with no inner gap. */
  avatar: {
    position: "absolute",
    width: 98.67,
    height: 98.67,
    top: -1.335,
    left: -1.335,
    borderRadius: 100,
  },
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
  proPill: {
    height: 26,
    borderRadius: 999,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    // Figma: inset #35C7FF + outer #0015D4
    boxShadow: "0px 0px 16px 0px #35C7FF inset, 0px 0px 15px 0px #0015D4",
  },
  proPillPro: { paddingHorizontal: 10, minWidth: 48 },
  proPillGet: { paddingHorizontal: 10, minWidth: 72 },
  proPillText: {
    zIndex: 1,
    color: "#FFFFFF",
    fontSize: 11,
    letterSpacing: 1.1, // 10% of 11px
  },
  email: { fontSize: 14, color: "#86A7D2" },
  tabs: { marginBottom: 16 },
  rowOuter: { borderRadius: 24, marginBottom: 12, overflow: "hidden" },
  rowOuterCompact: { borderRadius: 20, marginBottom: 10 },
  rowOuterTall: { borderRadius: 10, marginBottom: 10 },
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
    borderColor: "#07256D",
    backgroundColor: "#030A17",
    boxShadow: "0px 0px 30px 0px #0048FF80 inset",
  },
  rowCardCompact: { minHeight: 58, paddingVertical: 10, borderRadius: 20 },
  rowIconCompact: { width: 30 },
  /** Tall-tile icon slot — assets already include their frame; no extra border. */
  rowIconTall: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
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
