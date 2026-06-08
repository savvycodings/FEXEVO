import React, { useCallback, useContext, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "../context";
import { setAppLanguage, type AppLanguage, currentAppLanguage } from "../i18n/language";

type Props = {
  /** Extra top margin when stacked under form content */
  style?: object;
};

export function LanguageToggle({ style }: Props) {
  const { theme } = useContext(ThemeContext);
  const { t, i18n } = useTranslation();
  const [active, setActive] = useState<AppLanguage>(currentAppLanguage());

  useEffect(() => {
    const onChange = (lng: string) => {
      setActive(lng?.split("-")[0] === "es" ? "es" : "en");
    };
    i18n.on("languageChanged", onChange);
    return () => {
      i18n.off("languageChanged", onChange);
    };
  }, [i18n]);

  const select = useCallback(
    async (lang: AppLanguage) => {
      if (lang === active) return;
      setActive(lang);
      await setAppLanguage(lang);
      void i18n.changeLanguage(lang);
    },
    [active, i18n]
  );

  const styles = getStyles(theme);

  return (
    <View
      style={[styles.wrap, style]}
      accessibilityRole="radiogroup"
      accessibilityLabel={t("languageToggle.groupLabel")}
    >
      <TouchableOpacity
        onPress={() => void select("en")}
        activeOpacity={0.7}
        accessibilityRole="radio"
        accessibilityState={{ selected: active === "en" }}
      >
        <Text style={[styles.link, active === "en" && styles.linkActive]}>{t("language.english")}</Text>
      </TouchableOpacity>
      <Text style={styles.sep}>|</Text>
      <TouchableOpacity
        onPress={() => void select("es")}
        activeOpacity={0.7}
        accessibilityRole="radio"
        accessibilityState={{ selected: active === "es" }}
      >
        <Text style={[styles.link, active === "es" && styles.linkActive]}>{t("language.spanish")}</Text>
      </TouchableOpacity>
    </View>
  );
}

function getStyles(theme: { mediumFont?: string; semiBoldFont?: string }) {
  return StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 16,
      marginTop: 8,
    },
    link: {
      fontFamily: theme.mediumFont,
      fontSize: 14,
      color: "rgba(140, 176, 226, 0.85)",
      textDecorationLine: "underline",
      textDecorationColor: "rgba(140, 176, 226, 0.55)",
    },
    linkActive: {
      color: "#00BBFF",
      fontFamily: theme.semiBoldFont,
      textDecorationColor: "#00BBFF",
    },
    sep: {
      fontFamily: (theme as { regularFont?: string }).regularFont ?? theme.mediumFont,
      fontSize: 14,
      color: "rgba(255,255,255,0.25)",
    },
  });
}
