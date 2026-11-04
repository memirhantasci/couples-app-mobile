import { AppState } from "react-native";
import { safeStorage } from "@/lib/safeStorage";
import { logger } from "@/utils/logger";

/**
 * Mağaza değerlendirme isteği: çiftin en sevinçli anlarında, kullanıcıyı boğmadan.
 *
 * Kurallar:
 *  - 90 günde en fazla 1 istek (son istek zamanı bu cihazda saklanır).
 *  - İstek, kutlama sahnesi otursun diye kısa bir gecikmeyle yapılır; uygulama o sırada arka plana
 *    geçtiyse hiç yapılmaz ve hak harcanmaz.
 *  - Cihaz desteklemiyorsa (ör. iOS TestFlight, web) sessizce atlanır ve hak harcanmaz.
 *  - Sistem penceresini işletim sistemi yönetir; pencerenin gerçekten görünüp görünmediği bilinemez,
 *    bu yüzden hak, istek gönderildiği anda harcanmış sayılır.
 */

/** Değerlendirme istenebilecek anlar (yalnızca kayıt/ayıklama içindir). */
export type ReviewMoment = "star_claimed" | "anniversary" | "letter_first_open";

export const REVIEW_MIN_INTERVAL_DAYS = 90;
const REVIEW_MIN_INTERVAL_MS = REVIEW_MIN_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
const STORAGE_KEY = "@store_review_last_requested_at";
/** Kutlama animasyonu otursun diye istekten önce beklenen süre */
const SETTLE_DELAY_MS = 1800;

/**
 * Son istekten bu yana yeterli süre geçti mi? Kayıt yoksa, bozuksa ya da gelecekte görünüyorsa
 * (cihaz saati geri alındı) istek serbesttir; yeni istek kaydı bozuk değeri düzeltir.
 */
export function canRequestReview(lastRequestedAt: number | null, now: number = Date.now()): boolean {
  if (lastRequestedAt === null || !Number.isFinite(lastRequestedAt) || lastRequestedAt > now) return true;
  return now - lastRequestedAt >= REVIEW_MIN_INTERVAL_MS;
}

function parseTimestamp(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

// Native modül yalnızca varsa yüklenir: modül yokken (eski sürüm uygulamaya gelen güncelleme, Expo Go)
// import hatasıyla uygulama çökmesin.
type StoreReviewModule = typeof import("expo-store-review");
let storeReviewModule: StoreReviewModule | null | undefined;

function loadStoreReview(): StoreReviewModule | null {
  if (storeReviewModule !== undefined) return storeReviewModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    storeReviewModule = require("expo-store-review") as StoreReviewModule;
  } catch {
    storeReviewModule = null;
  }
  return storeReviewModule;
}

let inFlight = false;

/**
 * Uygun bir andaysa sistemin değerlendirme penceresini ister. Hiçbir koşulda hata fırlatmaz;
 * isteğin gönderilip gönderilmediğini döndürür. Çağıranlar sonucu beklemeden kullanabilir.
 */
export async function requestReviewAtMoment(moment: ReviewMoment): Promise<boolean> {
  if (inFlight) return false;
  inFlight = true;
  try {
    const last = parseTimestamp(await safeStorage.getItem(STORAGE_KEY));
    if (!canRequestReview(last)) return false;

    const StoreReview = loadStoreReview();
    if (!StoreReview || !(await StoreReview.isAvailableAsync())) return false;

    await new Promise<void>((resolve) => setTimeout(resolve, SETTLE_DELAY_MS));
    if (AppState.currentState !== "active") return false;

    // Önce kaydedilir: istek sırasında bir hata olsa bile aynı kullanıcı kısa sürede yeniden sorulmaz
    await safeStorage.setItem(STORAGE_KEY, String(Date.now()));
    await StoreReview.requestReview();
    logger.info(`[StoreReview] Değerlendirme istendi (${moment})`);
    return true;
  } catch (err) {
    logger.warn("[StoreReview] Değerlendirme istenemedi:", err);
    return false;
  } finally {
    inFlight = false;
  }
}
