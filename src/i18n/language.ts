import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";

export type AppLanguage = "en" | "es";

export const LANGUAGE_STORAGE_KEY = "xevo_app_language";

export function detectDeviceLanguage(): AppLanguage {
  try {
    const locales = Localization.getLocales();
    const code = locales[0]?.languageCode?.toLowerCase() ?? "en";
    if (code === "es" || code.startsWith("es")) return "es";
  } catch {
    /* ignore */
  }
  return "en";
}

export async function getStoredLanguage(): Promise<AppLanguage | null> {
  try {
    const raw = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (raw === "en" || raw === "es") return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export async function persistLanguage(lang: AppLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

export async function resolveInitialLanguage(): Promise<AppLanguage> {
  const stored = await getStoredLanguage();
  if (stored) return stored;
  const detected = detectDeviceLanguage();
  await persistLanguage(detected);
  return detected;
}

export async function setAppLanguage(lang: AppLanguage): Promise<void> {
  await persistLanguage(lang);
  await i18n.changeLanguage(lang);
}

export function currentAppLanguage(): AppLanguage {
  const lng = i18n.language?.split("-")[0];
  return lng === "es" ? "es" : "en";
}
