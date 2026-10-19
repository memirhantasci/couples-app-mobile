/**
 * @file pairingCode.ts
 * @module modules/stars/utils
 * @description Çift (eşleşme) kodu yardımcıları.
 *
 * `couples.pairing_code` kısıtı: tam 6 karakter, yalnızca büyük harf + rakam (^[A-Z0-9]{6}$).
 * Kozmik Bağlar ekranındaki kod girişi bu biçimi istemci tarafında da uygular.
 */

export const PAIRING_CODE_LENGTH = 6;

/** Girilen metni kod biçimine çevirir: büyük harf, yalnızca A–Z / 0–9, en fazla 6 karakter. */
export function normalizePairingCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, PAIRING_CODE_LENGTH);
}

/** Kodun tam (6 karakterlik) ve geçerli biçimde olup olmadığını söyler. */
export function isCompletePairingCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code);
}

/**
 * Panodaki metinden kodu ayıklar: "Kodum: K7M2XQ 💕" → "K7M2XQ".
 * Tek başına duran 6 karakterlik bir parça yoksa metin olduğu gibi normalize edilir (boş olabilir).
 */
export function extractPairingCode(text: string): string {
  const standalone = text
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .find((part) => part.length === PAIRING_CODE_LENGTH);
  return standalone ?? normalizePairingCode(text);
}
