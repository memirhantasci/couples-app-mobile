/**
 * Giriş Temizleme (Input Sanitization) Utility
 *
 * Kullanıcıdan gelen metin girdilerinden null bayt ve kontrol karakterlerini temizler.
 *
 * Kullanım:
 *   import { sanitize } from "@/utils/sanitize";
 *   const clean = sanitize(userInput);
 *
 * HTML kaçışı burada YAPILMAZ. Uygulama metni yalnızca React Native <Text> / <TextInput> ile gösterir; bunlar
 * metni HTML olarak işlemez. Metin bir gün HTML'e (e-posta, web sayfası) girecekse kaçış orada, HTML'i üreten
 * yerde yapılmalı (örnek: supabase/functions/report-alert'teki escapeHtml). Veritabanına kaçışlı metin yazmak
 * hem ekranda bozuk görünür hem de uzunluk sınırlarını şişirir.
 */

/**
 * Standart temizleyici: Boşlukları düzenler, control karakterleri kaldırır.
 * Başlık, ad, not ve mektup gibi bütün serbest metin alanları için kullanılır.
 */
export function sanitize(input: string): string {
  if (!input || typeof input !== "string") return "";
  return input
    // Null bytes'ı kaldır (SQL/binary injection riski)
    .replace(/\0/g, "")
    // Unicode control karakterlerini kaldır (C0/C1 aralıkları hariç tab/newline)
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Başlangıç/bitiş boşluklarını temizle
    .trim();
}

// ─── Eski sürümlerin yazdığı HTML varlıkları ────────────────────────────────
// Eski sürümlerdeki sanitizeStrict (kaldırıldı) şu alanları yazarken & < > " ' karakterlerini HTML varlığına
// çeviriyordu: meetings.title / location_name, memories.title, photos.title, letters.title, medicines.name,
// users.display_name. Mağazadaki eski sürümler aynı veritabanına bu biçimde yazmaya devam eder; bu yüzden
// okunan metin çözülür (bkz. src/lib/legacyEntityFetch.ts). Yalnızca o fonksiyonun ürettiği beş varlık
// tanınır; &#39;, &nbsp;, &apos; gibi diğerleri olduğu gibi kalır (genel HTML çözücü değildir).

const LEGACY_ENTITY_VALUES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
};

const LEGACY_ENTITY_PATTERN = /&(?:amp|lt|gt|quot|#x27);/g;

/** Metinde eski sanitizeStrict'in ürettiği bir varlık var mı (hızlı ön kontrol). */
export function hasLegacyEntities(text: string): boolean {
  LEGACY_ENTITY_PATTERN.lastIndex = 0;
  const found = LEGACY_ENTITY_PATTERN.test(text);
  LEGACY_ENTITY_PATTERN.lastIndex = 0;
  return found;
}

/**
 * Bir değer kaç kez üst üste kodlanmış olabilir. Eski sürüm, kodlanmış kaydı düzenleme formuna olduğu gibi
 * yükleyip yeniden kaydettiğinde her kayıtta bir seviye daha eklenir ("&#x27;" → "&amp;#x27;" → …).
 */
const MAX_DECODE_PASSES = 8;

/**
 * Eski sanitizeStrict'in ürettiği HTML varlıklarını geri çözer; çok seviyeli (çift) kodlamayı da sonuna kadar açar.
 * Dize olmayan değerleri (null, undefined) olduğu gibi döndürür.
 *
 * Bilinen ödünleşim: kullanıcı bir alana bilerek "&amp;" yazdıysa eski sürüm bunu "&amp;amp;" diye kaydetmiştir ve
 * burada "&" olarak görünür. Çift kodlamanın asıl kaynağı eski formda düzenleyip yeniden kaydetmek olduğu için
 * (çok daha olası durum) tam çözüm tercih edildi.
 */
export function decodeLegacyEntities<T>(value: T): T {
  if (typeof value !== "string" || !value) return value;
  let text: string = value;
  for (let pass = 0; pass < MAX_DECODE_PASSES && hasLegacyEntities(text); pass += 1) {
    // Tek geçişte her varlık bir kez çözülür: "&amp;lt;" bu geçişte "&lt;" olur, sonraki geçişte "<"
    text = text.replace(LEGACY_ENTITY_PATTERN, (entity) => LEGACY_ENTITY_VALUES[entity]);
  }
  return text as T;
}

/**
 * E-posta normalizasyonu: küçük harfe çevirir ve boşlukları temizler.
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== "string") return "";
  return sanitize(email).toLowerCase();
}

/**
 * Kullanıcı adı temizleyici: Sadece harf, rakam, nokta, alt çizgi ve tire'ye izin verir.
 */
export function sanitizeUsername(username: string): string {
  if (!username || typeof username !== "string") return "";
  return sanitize(username)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
}
