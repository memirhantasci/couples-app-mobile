import type { ParseKeys } from "i18next";
import { isNetworkError, isTimeoutError, isWishlistLimitError, serverErrorCode } from "@/lib/serverErrors";

/**
 * Ortak liste yazımlarında gelen hataların türü. Sunucu sözleşmesi: docs/ORTAK_LISTE_PLANI.md bölüm 4.
 *   P0022 sınır · P0020 eşleşme gerekli · P0021 tek kalana Premium gerekli · 42501 RLS / görünmeyen madde
 *   23514 CHECK (başlık, not, konum uzunluğu; kategori) · ağ ve zaman aşımı.
 * React ve ağ bağımlılığı yoktur.
 */
export type WishlistErrorKind =
  | "limit"
  | "partnerRequired"
  | "soloPremium"
  | "denied"
  | "invalidTitle"
  | "invalidNote"
  | "invalidCategory"
  | "invalidLocation"
  | "invalid"
  | "network"
  | "timeout"
  | "unknown";

/** Güncelleme/silme hiçbir satıra denk gelmediğinde (madde başkasının ya da silinmiş) veri katmanı fırlatır. */
export const WISHLIST_WRITE_DENIED = "WISHLIST_WRITE_DENIED";

function messageOf(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

/** Kısıt adından hangi alanın reddedildiği (migration 20261109000000'daki CHECK adları). */
function invalidField(message: string): WishlistErrorKind {
  if (/couple_wishlist_items_title_check/.test(message)) return "invalidTitle";
  if (/couple_wishlist_items_note_check/.test(message)) return "invalidNote";
  if (/couple_wishlist_items_category_check/.test(message)) return "invalidCategory";
  if (/couple_wishlist_items_(location_name|coordinates)_check/.test(message)) return "invalidLocation";
  return "invalid";
}

export function classifyWishlistError(error: unknown): WishlistErrorKind {
  const code = serverErrorCode(error);
  const message = messageOf(error);
  if (isWishlistLimitError(error)) return "limit";
  if (code === "P0020" || /\bPARTNER_REQUIRED\b/.test(message)) return "partnerRequired";
  if (code === "P0021" || /\bSOLO_PREMIUM_REQUIRED\b/.test(message)) return "soloPremium";
  if (code === "42501" || message === WISHLIST_WRITE_DENIED || /row-level security|permission denied/.test(message)) {
    return "denied";
  }
  if (code === "23514" || /violates check constraint/.test(message)) return invalidField(message);
  // 22001: değer sütuna sığmıyor, 22023: geçersiz parametre (RPC'ye boş değer), 23502: zorunlu alan boş
  if (code === "22001" || code === "22023" || code === "23502") return "invalid";
  if (isTimeoutError(error)) return "timeout";
  if (isNetworkError(error)) return "network";
  return "unknown";
}

/** Kullanıcıya gösterilecek metin. Sınır, eşleşme ve Premium türleri ekranda ayrıca yönlendirir (paywall, eşleşme). */
export const WISHLIST_ERROR_KEYS: Record<WishlistErrorKind, ParseKeys> = {
  limit: "serverErrors.wishlistLimit",
  partnerRequired: "solo.partnerRequired.message",
  soloPremium: "solo.premiumRequired.message",
  denied: "wishlist.errors.denied",
  invalidTitle: "wishlist.errors.invalidTitle",
  invalidNote: "wishlist.errors.invalidNote",
  invalidCategory: "wishlist.errors.invalidCategory",
  invalidLocation: "wishlist.errors.invalidLocation",
  invalid: "wishlist.errors.invalid",
  network: "wishlist.errors.network",
  timeout: "wishlist.errors.timeout",
  unknown: "wishlist.errors.generic",
};
