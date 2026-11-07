import { useCallback, useMemo } from "react";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { appAlert } from "@/lib/dialog";
import i18n from "@/lib/i18n";

/**
 * Tek kalan kullanıcının (partneri hesabını silmiş) kısıtları: docs/HESAP_SILME_VE_PREMIUM_TASARIMI.md madde 3.
 * Kurallar sunucuda zorlanır (trg_solo_write_guard); burada yalnızca kullanıcıya önceden ve anlaşılır biçimde
 * söylenir, istek hiç gönderilmez.
 *   • Fotoğraf, mektup, özel gün, buluşma, yıldız: eşleşme şart (Premium olsa bile).
 *   • Ruh hali, günlük, takvim notu, harita notu, ilaç, regl: Premium ile kullanılabilir.
 */

/** Eşleşme ekranına / Ayarlar'daki "Yeni eşleşme" kartına götüren açıklama */
export function showPartnerRequired(): void {
  appAlert(
    i18n.t("solo.partnerRequired.title"),
    i18n.t("solo.partnerRequired.message"),
    [
      { text: i18n.t("common.cancel"), style: "cancel" },
      { text: i18n.t("solo.partnerRequired.cta"), onPress: () => router.push("/(tabs)/profile") },
    ],
    { forceDialog: true, tone: "info", emoji: "💞" }
  );
}

/** Tek kalan, Premium olmadan kayıt ekleyemez */
export function showSoloPremiumRequired(): void {
  appAlert(
    i18n.t("solo.premiumRequired.title"),
    i18n.t("solo.premiumRequired.message"),
    [
      { text: i18n.t("common.cancel"), style: "cancel" },
      { text: i18n.t("solo.premiumRequired.cta"), onPress: () => router.push("/paywall") },
    ],
    { forceDialog: true, tone: "info", emoji: "✨" }
  );
}

export interface SoloGate {
  /** Partneri olmayan gerçek kullanıcı (demo hariç) */
  isSolo: boolean;
  /** Eşleşme isteyen özellik: engellendiyse açıklamayı gösterir ve true döner */
  blockPartnerFeature: () => boolean;
  /** Tek kalanın Premium ile yazabildiği kayıt: engellendiyse açıklamayı gösterir ve true döner */
  blockSoloWrite: () => boolean;
}

export function useSoloGate(): SoloGate {
  const { profile, isDemoMode } = useAuth();
  const isSolo = !isDemoMode && !!profile && !profile.isPaired;
  const isPremium = !!profile?.isPremium;

  const blockPartnerFeature = useCallback(() => {
    if (!isSolo) return false;
    showPartnerRequired();
    return true;
  }, [isSolo]);

  const blockSoloWrite = useCallback(() => {
    if (!isSolo || isPremium) return false;
    showSoloPremiumRequired();
    return true;
  }, [isSolo, isPremium]);

  return useMemo(() => ({ isSolo, blockPartnerFeature, blockSoloWrite }), [isSolo, blockPartnerFeature, blockSoloWrite]);
}
