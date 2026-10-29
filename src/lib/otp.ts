/**
 * Tek haneli kutulara bölünmüş doğrulama kodu girişi. Kutu `maxLength={1}` iken yapıştırılan 6 haneli kod
 * daha ilk karakterde kesiliyordu; kutular şimdi OTP_LENGTH'e kadar metin kabul eder ve bu fonksiyon
 * gelen metnin yazım mı yapıştırma mı olduğuna karar verip kutulara dağıtır.
 */
export interface OtpInputResult {
  readonly digits: string[];
  /** Odaklanacak kutu: son doldurulandan sonraki (en fazla son kutu). */
  readonly focusIndex: number;
  /** Tüm kutular dolu (kod tamam). */
  readonly complete: boolean;
}

export function applyOtpInput(
  current: readonly string[],
  index: number,
  rawValue: string,
  length: number
): OtpInputResult {
  const cleaned = rawValue.replace(/[^0-9]/g, "");
  const next = [...current];

  // Yazım: kutuda zaten rakam varken bir rakam daha yazılırsa ("12") yeni rakam alınır; boş kutuya tek rakam yazılır
  const isTyping = cleaned.length <= 1 || (cleaned.length === 2 && current[index] !== "");
  if (isTyping) {
    next[index] = cleaned.slice(-1);
    const focusIndex = cleaned && index < length - 1 ? index + 1 : index;
    return { digits: next, focusIndex, complete: next.every(Boolean) };
  }

  // Yapıştırma: tam kod baştan, kısmi metin tıklanan kutudan itibaren dağıtılır
  const start = cleaned.length >= length ? 0 : index;
  const chars = cleaned.slice(0, length - start).split("");
  chars.forEach((char, offset) => {
    next[start + offset] = char;
  });
  const focusIndex = Math.min(start + chars.length, length - 1);
  return { digits: next, focusIndex, complete: next.every(Boolean) };
}
