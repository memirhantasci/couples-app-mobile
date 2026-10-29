import type { QueryClient } from "@tanstack/react-query";

/**
 * Bildirim türüne göre yenilenmesi gereken sorgu anahtarları (kök anahtarlar; alt anahtarları da kapsar).
 * Eskiden her bildirimde ve 30 sn'den uzun arka plandan dönüşte parametresiz invalidateQueries() çağrılıyordu:
 * açık olan 15-25 sorgu aynı anda yeniden çekilip arayüz donuyordu. Diğer ekranlar zaten
 * önbellek süresi dolunca (staleTime) ya da açılırken tazelenir.
 */
const KEYS_BY_TYPE: Record<string, readonly string[]> = {
  letter: ["letters_data", "home_dashboard"],
  letter_unlock: ["letters_data", "home_dashboard"],
  medicine: ["medicine_data", "home_dashboard", "love_score"],
  medicine_reminder: ["medicine_data", "home_dashboard"],
  meeting: ["meetings", "map_meetings", "calendar_data", "home_dashboard"],
  meeting_reminder: ["meetings", "home_dashboard"],
  mood: ["home_dashboard", "calendar_data"],
  period: ["period_logs", "calendar_data"],
  period_reminder: ["period_logs", "calendar_data"],
  photo: ["photo_archive", "map_photos", "calendar_data", "home_dashboard"],
  memory: ["memories", "calendar_data", "home_dashboard"],
  anniversary_reminder: ["memories", "calendar_data", "home_dashboard"],
  map: ["map_photos", "map_notes", "map_meetings"],
};

/** Türü bilinmeyen ya da genel bildirimlerde yalnızca ana sayfa yenilenir. */
const DEFAULT_KEYS: readonly string[] = ["home_dashboard"];

/** Uygulama uzun süre arka plandaydı: partnerin değişikliklerinin en sık göründüğü sorgular yenilenir. */
const RESUME_KEYS: readonly string[] = ["home_dashboard", "letters_data", "medicine_data"];

function invalidateKeys(queryClient: QueryClient, keys: readonly string[]) {
  for (const key of keys) {
    queryClient.invalidateQueries({ queryKey: [key] }).catch(() => {});
  }
}

export function invalidateForNotification(queryClient: QueryClient, type: string | null | undefined) {
  invalidateKeys(queryClient, (type && KEYS_BY_TYPE[type]) || DEFAULT_KEYS);
}

export function invalidateOnResume(queryClient: QueryClient) {
  invalidateKeys(queryClient, RESUME_KEYS);
}
