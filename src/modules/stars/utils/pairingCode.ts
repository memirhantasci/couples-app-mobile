/**
 * @file pairingCode.ts
 * @module modules/stars/utils
 * @description Çift (eşleşme) kodu yardımcıları.
 *
 * `couples.pairing_code` kısıtı: tam 6 karakter, yalnızca büyük harf + rakam (^[A-Z0-9]{6}$).
 * Kozmik Bağlar ekranındaki kod girişi bu biçimi istemci tarafında da uygular.
 */

import { PAIRING_CODE_LENGTH, normalizePairingCode } from '@/lib/pairingCode';

// Tek kaynak: src/lib/pairingCode.ts. Türkçe klavyedeki i / ı / İ harflerini I'ya çeviren düzeltme orada;
// buradaki ayrı kopya bunu yapmıyor, "İ" içeren kodu bozuyordu.
export { PAIRING_CODE_LENGTH, normalizePairingCode };

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
    .replace(/[İıi]/g, 'I')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .find((part) => part.length === PAIRING_CODE_LENGTH);
  return standalone ?? normalizePairingCode(text);
}
