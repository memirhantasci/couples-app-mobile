/**
 * Eşleşme kodu yardımcıları. Kodlar sunucuda (get_or_create_my_couple) üretilir;
 * sunucu girilen kodu ayrıca normalize eder ve eski kodlardaki 0/O, 1/I karışıklığını tolere eder.
 */

export const PAIRING_CODE_LENGTH = 6;

/**
 * Kullanıcının yazdığı / yapıştırdığı kodu sunucunun beklediği biçime getirir.
 * Türkçe klavye büyük harf modunda "i" tuşuyla "İ" yazar; eskiden bu yüzden doğru yazılmış
 * kodlar "geçersiz" sayılıyordu. Boşluk, tire ve küçük harf de temizlenir.
 */
export function normalizePairingCode(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/[İıi]/g, "I")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, PAIRING_CODE_LENGTH);
}

/** Sunucu kodu kesin olarak reddetti mi? (Ağ hatası değil; aynı kodu tekrar denemek işe yaramaz) */
export function isDefinitivePairingError(msg: string | undefined): boolean {
  return !!msg && /INVALID_CODE|CODE_ALREADY_USED|COUPLE_FULL|SELF_CODE|ALREADY_PAIRED/.test(msg);
}

export function translatePairingError(msg: string | undefined): string {
  if (!msg) return "Bir hata oluştu, lütfen tekrar deneyin.";
  if (msg.includes("INVALID_CODE")) return "Bu kodla bekleyen bir partner bulunamadı. Kodu partnerinin ekranından harf harf kontrol et.";
  if (msg.includes("CODE_ALREADY_USED") || msg.includes("COUPLE_FULL")) return "Bu kod artık kullanılamıyor; sahibi başka biriyle eşleşmiş.";
  if (msg.includes("SELF_CODE")) return "Bu senin kendi kodun. Partnerinin ekranındaki kodu girmelisin.";
  if (msg.includes("ALREADY_PAIRED")) return "Zaten partnerinle eşleşmiş durumdasın.";
  if (msg.includes("doğrudan değiştirilemez")) return "Eşleşme işlemi tamamlanamadı, lütfen tekrar deneyin.";
  return msg;
}
