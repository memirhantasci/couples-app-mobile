import type { ParseKeys } from "i18next";
import i18n from "@/lib/i18n";

/**
 * Sunucu (Supabase RPC / tetikleyici) hata metinleri Türkçe yazılmıştır. Hata kodları ve
 * mesaj eşleştirmeleri değişmez; yalnızca kullanıcıya gösterilen metin geçerli dile çevrilir.
 * Her kural: mesajda geçen ayırt edici ifade(ler) → çeviri anahtarı. Özelden genele sıralıdır.
 */
const RULES: readonly (readonly [readonly string[], ParseKeys])[] = [
  // Tek kalan / eşleşmemiş kullanıcı (trg_solo_write_guard)
  [["PARTNER_REQUIRED"], "solo.partnerRequired.message"],
  [["SOLO_PREMIUM_REQUIRED"], "solo.premiumRequired.message"],
  // Ortak liste madde sınırı (trg_wishlist_limit, set_wishlist_done)
  [["WISHLIST_LIMIT"], "serverErrors.wishlistLimit"],
  // Premium / token
  [["Mektup mühürlemek için en az 100 Token"], "serverErrors.tokensOrPremium"],
  [["Yetersiz token bakiyesi"], "serverErrors.tokensInsufficient"],
  [["aktif Premium üyelik gereklidir"], "serverErrors.premiumRequired"],
  // Promosyon kodları
  [["Bu kodu zaten kullandınız"], "serverErrors.promoUsed"],
  [["Bu kodun kullanım limiti dolmuş"], "serverErrors.promoLimit"],
  [["Bu kodun süresi dolmuş"], "serverErrors.promoExpired"],
  [["Geçersiz veya süresi dolmuş kod"], "serverErrors.promoInvalid"],
  [["Çok fazla deneme yaptınız"], "serverErrors.promoRateLimited"],
  [["Premium kodunu kullanmak için bir partnerle eşleşmiş"], "serverErrors.promoNeedPartner"],
  // Döngü takibi
  [["Bir ay içerisinde en fazla 2 regl"], "serverErrors.periodMonthlyLimit"],
  [["İki regl başlangıcı arasında en az 16 gün"], "serverErrors.periodMinGap"],
  [["Gelecekteki bir günü regl"], "serverErrors.periodFuture"],
  [["Regl takvimini yalnızca kadın partner"], "serverErrors.periodFemaleOnly"],
  // Profil bekleme süreleri
  [["Cinsiyet tercihi 90 günde bir"], "serverErrors.genderCooldown"],
  [["İsim değişikliği 30 günde bir"], "serverErrors.nameCooldown"],
  [["İlişki tarihleri 30 günde bir"], "serverErrors.datesCooldown"],
  // Mektuplar
  [["Mektup açılış gününe kadar silinemez"], "serverErrors.letterDeleteLocked"],
  [["Silme isteği, mektup açıldıktan 72 saat"], "serverErrors.letterDeleteTooEarly"],
  [["Silme isteğin zaten partnerinin onayını"], "serverErrors.letterDeletePending"],
  [["Partnerin bu mektubu saklamak istedi"], "serverErrors.letterKeepCooldown"],
  [["Partnerin silmeyi zaten onayladı"], "serverErrors.letterPartnerApproved"],
  [["Silmeyi zaten onayladın"], "serverErrors.letterAlreadyApproved"],
  [["Yalnızca kendi yazdığın mektubun"], "serverErrors.letterOnlyOwn"],
  [["Bu mektup için bekleyen bir silme isteği yok"], "serverErrors.letterNoPending"],
  [["Mektup yalnızca eşleştiğiniz partnere"], "serverErrors.letterOnlyPartner"],
  [["Mektup bulunamadı"], "serverErrors.letterNotFound"],
  // Yıldız modülü (bu metinlerin çevirisi stars.* altında zaten vardır)
  [["Yıldız ismi topluluk kurallarına aykırı"], "stars.errors.nameModeration"],
  [["Bu yıldız az önce başka bir çift tarafından"], "stars.errors.starTaken"],
  [["Bu çiftin zaten bir yıldızı var"], "stars.errors.alreadyHasStar"],
  [["Bağlantı kurabilmek için önce bir yıldız"], "stars.errors.needStar"],
  [["Maksimum 3 yıldız bağlantısı"], "stars.errors.maxConnections"],
  [["Bu yıldızla zaten aktif bir bağlantınız", "Bu yıldız için bekleyen bir bağlantı isteği"], "stars.errors.connectionExists"],
  [["Bu istek zaten yanıtlanmış"], "stars.errors.requestAnswered"],
  [["Yeni isim mevcut isimle aynı"], "stars.claim.errors.nameSame"],
  [["İsim değiştirme hakkı henüz yenilenmedi"], "stars.errors.renameCooldown"],
  [["Taraflardan birinin maksimum 3 bağlantı"], "serverErrors.partnerLimitFull"],
  [["Çiftin henüz bir yıldızı yok"], "serverErrors.coupleNoStar"],
  [["uygun boşta yıldız kalmadı"], "serverErrors.starNoFree"],
  [["Kendi yıldızınıza bağlantı kuramazsınız"], "serverErrors.starSelfConnect"],
  [["Çiftinizin zaten tescilli bir yıldızı"], "serverErrors.starAlreadyOwned"],
  [["Yıldız ismi 2 ile 40 karakter"], "serverErrors.starNameLength"],
  [["Maksimum 10 manuel gezegen"], "serverErrors.planetLimit"],
  [["Yıldız bulunamadı", "Hedef yıldız bulunamadı", "kataloğda bulunamadı"], "serverErrors.starNotFound"],
  // Reklam
  [["Günlük reklam izleme sınırına"], "serverErrors.adLimit"],
  // Genel gruplar
  [["bulunamadı veya yetkiniz yok", "bulunamadı ya da yetkiniz yok"], "serverErrors.notFoundOrDenied"],
  [["doğrudan değiştirilemez", "doğrudan güncellenemez", "değiştirilemez."], "serverErrors.directUpdateBlocked"],
  [["Yetkisiz", "Not authenticated", "Oturum bulunamadı", "User does not belong to a couple", "Kullanıcı bir çifte bağlı değil"], "serverErrors.unauthorized"],
  [["olmalıdır", "zorunludur", "Geçersiz ", "geçerli bir metin", "bos olamaz", "boş olamaz"], "serverErrors.invalidInput"],
];

/** Mesaj Türkçe mi? (Türkçe harfler ya da yaygın ASCII Türkçe sözcükler) */
function looksTurkish(message: string): boolean {
  return /[çğıöşüÇĞİÖŞÜ]/.test(message) || /\b(yetkisiz|erisim|gecersiz|degil|cifte|olamaz|gereklidir)\b/i.test(message);
}

function messageOf(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

/** Postgres / PostgREST hata kodu (SQLSTATE, ör. "42501"); yoksa "". */
export function serverErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : "";
  }
  return "";
}

/** Ortak liste madde sınırı mı (P0022)? Ücretsiz çiftte paywall açmak için. */
export function isWishlistLimitError(error: unknown): boolean {
  if (serverErrorCode(error) === "P0022") return true;
  return /\bWISHLIST_LIMIT\b/.test(messageOf(error));
}

/** İstek sunucuya hiç ulaşmadı ya da yanıt gelmedi (çevrimdışı, DNS, bağlantı koptu). */
export function isNetworkError(error: unknown): boolean {
  return /Network request failed|Failed to fetch|NetworkError|network error|fetch failed|Load failed|ERR_NETWORK|ENOTFOUND|ECONNREFUSED|ECONNRESET|ERR_INTERNET_DISCONNECTED/i.test(
    messageOf(error)
  );
}

/**
 * İptal edilen istek mesajları. Tek başına "aborted" sözcüğü aranmaz: Postgres'in "current transaction is aborted"
 * (25P02) hatası bir zaman aşımı değildir, sunucu tarafında başarısız bir işlemdir.
 */
const ABORT_MESSAGE = /^aborted\.?$|\boperation was aborted\b|\brequest (?:was )?aborted\b|\bAbortError\b/i;

/** Sunucu zamanında yanıt vermedi (istemci zaman aşımı / iptal ya da Postgres statement_timeout, 57014). */
export function isTimeoutError(error: unknown): boolean {
  const code = serverErrorCode(error);
  if (code === "57014") return true;
  // SQLSTATE taşıyan diğer sunucu hataları (ör. 25P02) mesajında ne yazarsa yazsın zaman aşımı sayılmaz
  if (/^[0-9A-Z]{5}$/.test(code)) return false;
  const name = error && typeof error === "object" && "name" in error ? (error as { name?: unknown }).name : null;
  if (name === "AbortError" || name === "TimeoutError") return true;
  const message = messageOf(error).trim();
  return /\btimed? ?out\b|statement timeout/i.test(message) || ABORT_MESSAGE.test(message);
}

/** Bilinen bir sunucu mesajının çevrilmiş metnini döndürür; tanınmıyorsa null. */
export function mapServerMessage(message: string): string | null {
  for (const [phrases, key] of RULES) {
    if (phrases.some((phrase) => message.includes(phrase))) return i18n.t(key);
  }
  return null;
}

/**
 * Kullanıcıya gösterilecek hata metni: Türkçe arayüzde sunucu metni aynen gösterilir. Diğer dillerde
 * bilinen sunucu mesajları geçerli dilde döner; tanınmayan
 * Türkçe sunucu metni Türkçe dışındaki dillerde ham gösterilmez ve `fallback` kullanılır;
 * diğer mesajlar (ör. zaten yerelleştirilmiş ya da İngilizce hata metinleri) olduğu gibi kalır.
 * Olay anında (catch bloklarında) çağrılır; çeviri o anki dile göre çözülür.
 */
export function localizeServerError(error: unknown, fallback: string): string {
  const message = messageOf(error).trim();
  if (!message) return fallback;
  // Kodlu mesajlar ("PARTNER_REQUIRED: ...", "WISHLIST_LIMIT") her dilde kodsuz, çevrilmiş metinle gösterilir
  if (/\b(PARTNER_REQUIRED|SOLO_PREMIUM_REQUIRED|WISHLIST_LIMIT)\b/.test(message)) return mapServerMessage(message) ?? fallback;
  // Ağ / zaman aşımı ve Postgres'in İngilizce yetki metinleri hiçbir dilde ham gösterilmez
  if (isTimeoutError(error)) return i18n.t("serverErrors.timeout");
  if (isNetworkError(error)) return i18n.t("serverErrors.network");
  if (/violates row-level security policy|permission denied for/.test(message)) return i18n.t("serverErrors.unauthorized");
  // Sunucu metni zaten Türkçe: Türkçe arayüzde olduğu gibi (ayrıntısıyla) gösterilir
  if (i18n.language === "tr") return message;
  const mapped = mapServerMessage(message);
  if (mapped) return mapped;
  if (i18n.language !== "tr" && looksTurkish(message)) return fallback;
  return message;
}
