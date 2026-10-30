import type { ParseKeys } from "i18next";
import i18n from "@/lib/i18n";

/**
 * Sunucu (Supabase RPC / tetikleyici) hata metinleri Türkçe yazılmıştır. Hata kodları ve
 * mesaj eşleştirmeleri değişmez; yalnızca kullanıcıya gösterilen metin geçerli dile çevrilir.
 * Her kural: mesajda geçen ayırt edici ifade(ler) → çeviri anahtarı. Özelden genele sıralıdır.
 */
const RULES: readonly (readonly [readonly string[], ParseKeys])[] = [
  // Premium / token
  [["Mektup mühürlemek için en az 100 Token"], "serverErrors.tokensOrPremium"],
  [["Yetersiz token bakiyesi"], "serverErrors.tokensInsufficient"],
  [["aktif Premium üyelik gereklidir"], "serverErrors.premiumRequired"],
  // Promosyon kodları
  [["Bu kodu zaten kullandınız"], "serverErrors.promoUsed"],
  [["Bu kodun kullanım limiti dolmuş"], "serverErrors.promoLimit"],
  [["Bu kodun süresi dolmuş"], "serverErrors.promoExpired"],
  [["Geçersiz veya süresi dolmuş kod"], "serverErrors.promoInvalid"],
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
  // Sunucu metni zaten Türkçe: Türkçe arayüzde olduğu gibi (ayrıntısıyla) gösterilir
  if (i18n.language === "tr") return message;
  const mapped = mapServerMessage(message);
  if (mapped) return mapped;
  if (i18n.language !== "tr" && looksTurkish(message)) return fallback;
  return message;
}
