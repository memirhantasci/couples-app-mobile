import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";
import { syncPushTokenLanguage } from "@/lib/notifications";

/**
 * Giriş yapmış kullanıcının uygulama dilini push token kaydına yazar (açılışta ve dil değişince).
 * Sunucu bildirimleri (hatırlatıcılar, partner olayları) böylece kullanıcının seçtiği dilde gider.
 */
export function usePushLanguageSync() {
  const { session, isDemoMode } = useAuth();
  const { i18n } = useTranslation();
  const userId = session?.user?.id;

  useEffect(() => {
    if (isDemoMode || !userId) return;
    syncPushTokenLanguage(userId).catch(() => {});
  }, [userId, isDemoMode, i18n.language]);
}
