import "i18next";
import type tr from "@/locales/tr.json";

// Çeviri anahtarları tr.json'dan türetilir: t("yanlis.anahtar") artık derleme hatası verir.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof tr };
  }
}
