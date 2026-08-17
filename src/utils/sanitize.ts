/**
 * Giriş Temizleme (Input Sanitization) Utility
 * 
 * Kullanıcıdan gelen tüm metin girdilerini potansiyel saldırı
 * karakterlerinden arındırır. XSS, null-byte injection ve
 * control character enjeksiyonlarına karşı koruma sağlar.
 * 
 * Kullanım:
 *   import { sanitize, sanitizeHard } from "@/utils/sanitize";
 *   const clean = sanitize(userInput);
 */

/**
 * Standart temizleyici: Boşlukları düzenler, control karakterleri kaldırır.
 * Mektup içerikleri ve not alanları için uygundur.
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

/**
 * Sert temizleyici: HTML/script karakterlerini de engeller.
 * Kullanıcı adı, başlık gibi kısa alanlarda kullanılır.
 */
export function sanitizeStrict(input: string): string {
  if (!input || typeof input !== "string") return "";
  return sanitize(input)
    // HTML taglarını kaldır
    .replace(/<[^>]*>/g, "")
    // HTML özel karakterlerini kaçış karakterine çevir
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    // Script enjeksiyonunu engelle
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "");
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
