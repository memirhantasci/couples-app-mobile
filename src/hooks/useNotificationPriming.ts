import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { registerForPushNotifications } from "@/lib/notifications";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { logger } from "@/utils/logger";

export const NOTIFICATION_PRIMING_DISMISSED_KEY = "@notification_priming_dismissed_at";
export const NOTIFICATION_PRIMING_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 gün

const DEMO_USER_ID = "demo-guest-user-id";

/**
 * Bildirim izni için "Soft-Ask" akışını yönetir.
 *
 * - OS izin penceresi, kullanıcı ön-onay kartında "Bildirimleri Aç" diyene kadar ASLA açılmaz.
 * - Kullanıcı "Şimdilik Değil" derse zaman damgası saklanır ve 7 gün boyunca tekrar sorulmaz.
 * - İzin zaten verilmişse veya işletim sistemi artık soruya izin vermiyorsa kart hiç açılmaz.
 *
 * Kullanım: Anlamlı bir kullanıcı eyleminden sonra (mektup gönderme, anı kaydetme)
 * `maybePrompt()` çağrılır; kart gösterildiyse `true` döner.
 */
export function useNotificationPriming(userId: string | null | undefined) {
  const [isVisible, setIsVisible] = useState(false);
  const isCheckingRef = useRef(false);

  const markDismissed = useCallback(async () => {
    await AsyncStorage.setItem(NOTIFICATION_PRIMING_DISMISSED_KEY, String(Date.now()));
  }, []);

  const shouldPrompt = useCallback(async (): Promise<boolean> => {
    if (!userId || userId === DEMO_USER_ID) return false;
    if (Platform.OS === "web") return false;

    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_PRIMING_DISMISSED_KEY);
      if (stored) {
        const dismissedAt = Number(stored);
        const elapsed = Date.now() - dismissedAt;
        // Gelecekteki (saat kayması) bir damga cooldown'u sonsuza uzatmasın
        if (Number.isFinite(dismissedAt) && elapsed >= 0 && elapsed < NOTIFICATION_PRIMING_COOLDOWN_MS) {
          return false;
        }
      }

      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      if (status === "granted") return false;
      // OS artık izin penceresi göstermeyecekse ön-onay kartı anlamsız
      if (status === "denied" && !canAskAgain) return false;

      return true;
    } catch (err) {
      logger.log("[Priming] Eligibility check failed:", err);
      return false;
    }
  }, [userId]);

  /** Uygunsa ön-onay kartını açar. Kart açıldıysa `true` döner. */
  const maybePrompt = useCallback(async (): Promise<boolean> => {
    if (isCheckingRef.current) return false;
    isCheckingRef.current = true;
    try {
      const eligible = await shouldPrompt();
      if (eligible) setIsVisible(true);
      return eligible;
    } finally {
      isCheckingRef.current = false;
    }
  }, [shouldPrompt]);

  /** "Bildirimleri Aç": kartı kapatır, ardından OS izin penceresini açar. */
  const accept = useCallback(async (): Promise<boolean> => {
    setIsVisible(false);
    if (!userId) return false;

    const granted = await registerForPushNotifications(userId, true);
    if (!granted) {
      // Kullanıcı OS penceresinde reddetti (veya token alınamadı) — 7 gün bezdirme
      await markDismissed();
    }
    return granted;
  }, [userId, markDismissed]);

  /** "Şimdilik Değil": kartı kapatır ve 7 günlük sessizliği başlatır. */
  const dismiss = useCallback(async (): Promise<void> => {
    setIsVisible(false);
    await markDismissed();
  }, [markDismissed]);

  return { isVisible, maybePrompt, accept, dismiss };
}
