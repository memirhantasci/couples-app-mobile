import dayjs from "dayjs";
import "dayjs/locale/en";
import "dayjs/locale/tr";
import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import tr from "@/locales/tr.json";
import { safeStorage } from "@/lib/safeStorage";

export const SUPPORTED_LANGUAGES = ["tr", "en"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Cihaz dili desteklenmiyorsa (ve kayıtlı bir tercih yoksa) kullanılan dil */
export const DEFAULT_LANGUAGE: AppLanguage = "tr";

/** Kullanıcının seçtiği dil burada saklanır */
export const LANGUAGE_STORAGE_KEY = "@app_language";

/** Dil seçicide gösterilen seçenekler; adlar kendi dillerinde yazılır, çevrilmez */
export const LANGUAGE_OPTIONS: ReadonlyArray<{ code: AppLanguage; label: string; flag: string }> = [
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
];

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

// İki dilin anahtar kümesi birebir aynı olmalı; eksik çeviri derleme hatası verir
en satisfies typeof tr;
tr satisfies typeof en;

/** Cihazın tercih sırasındaki ilk desteklenen dil; hiçbiri desteklenmiyorsa Türkçe */
function detectDeviceLanguage(): AppLanguage {
  try {
    for (const locale of getLocales()) {
      const code = locale.languageCode?.toLowerCase();
      if (isAppLanguage(code)) return code;
    }
  } catch {
    // expo-localization native modülü yoksa (ör. eski geliştirme istemcisi) varsayılan dile düşülür
  }
  return DEFAULT_LANGUAGE;
}

/** Dayjs'in genel locale'i uygulama diliyle aynı tutulur; böylece ay/gün adları dili izler */
function applyDayjsLocale(language: string | undefined) {
  dayjs.locale(isAppLanguage(language) ? language : DEFAULT_LANGUAGE);
}

i18n.use(initReactI18next).init({
  resources: {
    tr: { translation: tr },
    en: { translation: en },
  },
  lng: detectDeviceLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: { escapeValue: false },
  // Kaynaklar pakete gömülü olduğundan başlatma eşzamanlı biter; Suspense gerekmez
  initAsync: false,
  react: { useSuspense: false },
});

applyDayjsLocale(i18n.language);
i18n.on("languageChanged", applyDayjsLocale);

export function getCurrentLanguage(): AppLanguage {
  return isAppLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;
}

/**
 * Dili anında değiştirir ve tercihi saklar.
 * i18n.changeLanguage → react-i18next ile ekranlar yeniden çizilir; dayjs locale'i "languageChanged" olayıyla güncellenir.
 */
export async function setAppLanguage(language: AppLanguage): Promise<void> {
  await i18n.changeLanguage(language);
  await safeStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

let restorePromise: Promise<void> | null = null;

/**
 * Kayıtlı dil tercihini okur ve varsa uygular (yoksa cihaz dili / Türkçe ile devam edilir).
 * Birden çok kez çağrılabilir; okuma yalnızca bir kez yapılır.
 */
export function restoreSavedLanguage(): Promise<void> {
  restorePromise ??= (async () => {
    try {
      const saved = await safeStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (isAppLanguage(saved) && saved !== i18n.language) {
        await i18n.changeLanguage(saved);
      }
    } catch {
      // Okunamazsa cihaz dili ile devam edilir
    }
  })();
  return restorePromise;
}

// Uygulama açılırken kayıtlı tercih hemen okunur; kök layout bitene kadar splash'ı bekletir
restoreSavedLanguage();

export default i18n;
