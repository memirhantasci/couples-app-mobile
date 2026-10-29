import type { QueryClient } from "@tanstack/react-query";

/**
 * Bildirim türüne göre yenilenmesi gereken sorgu anahtarları (kök anahtarlar; alt anahtarları da kapsar).
 * Eskiden her bildirimde ve 30 sn'den uzun arka plandan dönüşte parametresiz invalidateQueries() çağrılıyordu:
 * açık olan 15-25 sorgu aynı anda yeniden çekilip arayüz donuyordu. Diğer ekranlar zaten
 * önbellek süresi dolunca (staleTime) ya da açılırken tazelenir.
 */
const KEYS_BY_TYPE: Record<string, readonly string[]> = {
  letter: ["letters_data", "home_dashboard", "love_score"],
  letter_unlock: ["letters_data", "home_dashboard", "love_score"],
  letter_delete_request: ["letters_data", "home_dashboard"],
  letter_delete_response: ["letters_data", "home_dashboard"],
  medicine: ["medicine_data", "home_dashboard", "love_score"],
  medicine_reminder: ["medicine_data", "home_dashboard"],
  meeting: ["meetings", "map_meetings", "calendar_data", "home_dashboard", "love_score"],
  meeting_reminder: ["meetings", "home_dashboard"],
  mood: ["home_dashboard", "calendar_data", "love_score"],
  period: ["period_logs", "calendar_data", "home_dashboard"],
  period_reminder: ["period_logs", "calendar_data"],
  photo: ["photo_archive", "map_photos", "calendar_data", "home_dashboard", "love_score"],
  daily_note: ["daily_notes", "map_notes", "calendar_data", "love_score"],
  memory: ["memories", "calendar_data", "home_dashboard", "love_score"],
  anniversary_reminder: ["memories", "calendar_data", "home_dashboard"],
  wheel: ["home_dashboard"],
  pairing: ["home_dashboard", "calendar_data", "couple_avatars", "love_score"],
  map: ["map_photos", "map_notes", "map_meetings"],
};

/** Türü bilinmeyen ya da genel bildirimlerde yalnızca ana sayfa yenilenir. */
const DEFAULT_KEYS: readonly string[] = ["home_dashboard", "letters_data"];

/** Uygulama uzun süre arka plandaydı: partnerin değişikliklerinin en sık göründüğü sorgular yenilenir. */
const RESUME_KEYS: readonly string[] = [
  "home_dashboard",
  "letters_data",
  "medicine_data",
  "calendar_data",
  "meetings",
  "memories",
  "photo_archive",
  "period_logs",
  "love_score",
  "couple_avatars",
];

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
