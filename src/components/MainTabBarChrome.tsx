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
import {
  NavIconAICoach,
  NavIconActivities,
  NavIconMyCoach,
  NavIconMyStudents,
  NavIconProgress,
  NavIconPlaylist,
  NavIconYou,
} from "./NavTabIcons";
import { useTranslation } from "react-i18next";
import { useSessionData } from "../context/SessionDataContext";
import type { MainStackParamList, MainTabParamList } from "../navigation/types";

const TAB_BAR_ACTIVE = "#FFFFFF";
const TAB_BAR_INACTIVE = "#5B9DFF";

const TAB_ORDER: (keyof MainTabParamList)[] = [
  "AICoach",
  "MyCoach",
  "Activities",
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
          paddingTop: 4,
          paddingBottom: tabBarBottomPad,
          paddingHorizontal: 4,
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
        },
        item: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 2,
          minWidth: 0,
        },
        label: {
          marginTop: 2,
          fontFamily: theme.mediumFont ?? "System",
          fontSize: tabMetrics.labelFontSize,
          lineHeight: tabMetrics.labelFontSize + (Platform.OS === "android" ? 6 : 4),
          textAlign: "center",
          ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
        },
        labelActive: {
          color: TAB_BAR_ACTIVE,
        },
        labelInactive: {
          color: TAB_BAR_INACTIVE,
        },
      }),
    [tabBarBottomPad, tabBarHeight, tabMetrics.labelFontSize, theme.mediumFont]
  );

  const goToTab = useCallback(
    (screen: keyof MainTabParamList) => {
      if (screen === "You") {
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
    [navigation]
  );

  const tabLabels: Record<keyof MainTabParamList, string> = {
    AICoach: t("tabs.aiCoach"),
    Playlist: t("tabs.playlist"),
    MyCoach: t("tabs.myStudents"),
    Activities: viewerIsCoach ? t("tabs.calendar") : t("tabs.activities"),
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
        const color = focused ? TAB_BAR_ACTIVE : TAB_BAR_INACTIVE;
        const iconSize = tabMetrics.iconSize;
        const icon =
          tab === "AICoach" ? (
            <NavIconAICoach color={color} size={iconSize} />
          ) : tab === "Playlist" ? (
            <NavIconPlaylist color={color} size={iconSize} />
          ) : tab === "MyCoach" ? (
            viewerIsCoach ? (
              <NavIconMyStudents color={color} size={iconSize} />
            ) : (
              <NavIconMyCoach color={color} size={iconSize} />
            )
          ) : tab === "Activities" ? (
            <NavIconActivities color={color} size={iconSize} />
          ) : tab === "Progress" ? (
            <NavIconProgress color={color} size={iconSize} />
          ) : (
            <NavIconYou color={color} size={iconSize} />
          );

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
            {icon}
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
