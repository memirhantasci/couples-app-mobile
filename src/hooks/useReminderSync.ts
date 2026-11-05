import { useEffect } from "react";
import { AppState } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";
import { syncLocalReminders } from "@/lib/reminderSync";

/**
 * Giriş yapmış, eşleşmiş kullanıcı için cihazdaki yerel hatırlatıcıları (ilaç, buluşma,
 * mektup kilidi) sunucudaki güncel kayıtlarla eşitler: ekran açıldığında ve uygulama
 * arka plandan her öne geldiğinde. Partnerin eklediği/sildiği kayıtlar böylece bu cihaza yansır.
 */
export function useReminderSync() {
  const { session, profile, isDemoMode } = useAuth();
  const { i18n } = useTranslation();
  const userId = session?.user?.id;
  const coupleId = profile?.coupleId;
  const relationshipStartDate = profile?.relationshipStartDate;

  useEffect(() => {
    if (isDemoMode || !userId || !coupleId) return;

    syncLocalReminders(userId, coupleId, { force: true, relationshipStartDate });

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") syncLocalReminders(userId, coupleId, { relationshipStartDate });
    });
    return () => subscription.remove();
  // Dil ya da ilişki tarihi değişince zorla eşitlenir: yerel hatırlatıcı metinleri yeni dilde / yeni tarihle yeniden kurulur
  }, [userId, coupleId, relationshipStartDate, isDemoMode, i18n.language]);
}
