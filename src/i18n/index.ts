import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { es } from "./locales/es";
import { enExtended } from "./locales/enExtended";
import { esExtended } from "./locales/esExtended";
import { mergeLocale } from "./mergeLocale";
import { detectDeviceLanguage } from "./language";

const enMerged = mergeLocale(en, enExtended);
const esMerged = mergeLocale(es, esExtended);

void i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  fallbackLng: "en",
  lng: detectDeviceLanguage(),
  resources: {
    en: { translation: enMerged },
    es: { translation: esMerged },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
