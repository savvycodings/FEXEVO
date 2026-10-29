import React, { useCallback, useContext, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ThemeContext } from "../context";
import { MainTabBarBackground } from "./MainTabBarBackground";
import { useTranslation } from "react-i18next";
import { useSessionData } from "../context/SessionDataContext";
import type { MainStackParamList, MainTabParamList } from "../navigation/types";
import { useCoachAssistant } from "../context/CoachAssistantContext";
import { TAB_ICON_SLOT } from "./CoachCharacterAvatar";
import { TAB_INACTIVE, renderTabIcon, tabLabelActive } from "./tabBarStyle";

const TAB_ORDER: (keyof MainTabParamList)[] = [
  "AICoach",
  "MyCoach",
  "Activities",
  "Assistant",
  "Playlist",
  "Progress",
  "You",
];

type Props = {
  activeTab?: keyof MainTabParamList;
};

export function MainTabBarChrome({ activeTab }: Props) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { width: winW } = useWindowDimensions();
  const { viewerIsCoach } = useSessionData();
  const { open, openAssistant, closeAssistant } = useCoachAssistant();

  const tabBarBottomPad = insets.bottom + 10;
  const tabBarHeight = 66 + tabBarBottomPad;

  const tabMetrics = useMemo(() => {
    const iconSize = winW < 340 ? 20 : winW < 400 ? 22 : 24;
    const labelFontSize = winW < 340 ? 10 : winW < 380 ? 11 : 12;
    return { iconSize, labelFontSize };
  }, [winW]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        bar: {
          position: "relative",
          overflow: "hidden",
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: tabBarBottomPad,
          paddingHorizontal: 4,
          flexDirection: "row",
          /** Stretch items to full bar height so icon+label center like `main.tsx` tabBarItemStyle. */
          alignItems: "stretch",
          justifyContent: "space-between",
        },
        item: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 2,
          paddingTop: 0,
          paddingBottom: 0,
          minWidth: 0,
        },
        iconWrap: {
          width: TAB_ICON_SLOT.width,
          height: TAB_ICON_SLOT.height,
          marginTop: 0,
          marginBottom: 4,
          alignItems: "center",
          justifyContent: "center",
        },
        label: {
          marginTop: 0,
          fontFamily: theme.mediumFont ?? "System",
          fontSize: tabMetrics.labelFontSize,
          lineHeight: tabMetrics.labelFontSize + (Platform.OS === "android" ? 6 : 4),
          textAlign: "center",
          ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
        },
        labelActive: tabLabelActive,
        labelInactive: {
          color: TAB_INACTIVE,
        },
      }),
    [tabBarBottomPad, tabBarHeight, tabMetrics.labelFontSize, theme.mediumFont]
  );

  const goToTab = useCallback(
    (screen: keyof MainTabParamList) => {
      if (screen === "Assistant") {
        if (open) closeAssistant();
        else openAssistant();
      } else if (screen === "You") {
        navigation.navigate("Main", {
          screen: "You",
          params: { screen: "YouMain" },
        });
      } else if (screen === "Progress") {
        navigation.navigate("Main", {
          screen: "Progress",
          params: { screen: "ProgressMain" },
        });
      } else if (screen === "MyCoach") {
        navigation.navigate("Main", {
          screen: "MyCoach",
          params: { screen: "MyCoachMain" },
        });
      } else if (screen === "Playlist") {
        navigation.navigate("Main", { screen: "Playlist" });
      } else {
        navigation.navigate("Main", { screen: screen as "AICoach" | "Activities" });
      }
    },
    [navigation, open, openAssistant, closeAssistant]
  );

  const tabLabels: Record<keyof MainTabParamList, string> = {
    AICoach: t("tabs.aiCoach"),
    Playlist: t("tabs.playlist"),
    MyCoach: t("tabs.myStudents"),
    Activities: viewerIsCoach ? t("tabs.calendar") : t("tabs.activities"),
    Assistant: t("tabs.assistant"),
    Progress: t("tabs.progress"),
    You: t("tabs.you"),
  };
  const visibleTabs = TAB_ORDER.filter(
    (tab) =>
      !(viewerIsCoach && tab === "AICoach") &&
      !(!viewerIsCoach && tab === "Playlist") &&
      !(!viewerIsCoach && tab === "MyCoach")
  );

  return (
    <View style={styles.bar}>
      <MainTabBarBackground />
      {visibleTabs.map((tab) => {
        const focused = activeTab === tab;
        const icon = renderTabIcon(tab, focused, tabMetrics.iconSize, viewerIsCoach);

        return (
          <TouchableOpacity
            key={tab}
            style={styles.item}
            activeOpacity={0.85}
            onPress={() => goToTab(tab)}
            accessibilityRole="button"
            accessibilityLabel={tabLabels[tab]}
            accessibilityState={{ selected: focused }}
          >
            <View style={styles.iconWrap}>{icon}</View>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}
            >
              {tabLabels[tab]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
