// Premium'a geçişi kutlama ekranı: satın alan kişi kendi akışında "Tebrikler"i zaten görür;
// partnerin telefonunda (uygulama açıkken anında, kapalıysa açılınca) aynı ekran bu kuralla gösterilir.

const SUPPRESS_WINDOW_MS = 3 * 60 * 1000;
let suppressUntil = 0;

/** Bu cihazda premium'u kendimiz alıyoruz / etkinleştiriyoruz: ek kutlama ekranı çıkmasın. */
export function suppressPremiumCelebration(): void {
  suppressUntil = Date.now() + SUPPRESS_WINDOW_MS;
}

export function isPremiumCelebrationSuppressed(): boolean {
  return Date.now() < suppressUntil;
}

export function premiumSeenKey(userId: string, coupleId: number | string): string {
  return `@premium_last_seen_${userId}_${coupleId}`;
}
