/**
 * Premium durumunun saf (ekrandan bağımsız) çözümlemesi. Sunucudaki kural ile birebir aynıdır
 * (supabase/migrations/20261104000003_subscription_lifecycle.sql):
 * Premium bitince yıldız PREMIUM_GRACE_DAYS günlük kış uykusuna geçer (hiçbir şey silinmez). Yenilenmezse
 * yıldızın koordinatı serbest kalır ve anı gezegenleri PREMIUM_VAULT_DAYS gün kasada bekler; kasa süresi de
 * dolarsa tam boy fotoğraflar silinir. Sunucunun grace_until değeri varsa doğruluk kaynağı odur.
 */
export const PREMIUM_GRACE_DAYS = 14;
export const PREMIUM_VAULT_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

export type PremiumPhase =
  /** Hiç Premium olmamış */
  | "free"
  /** Süresiz Premium (ör. promosyon) */
  | "lifetime"
  /** Premium etkin */
  | "active"
  /** Premium bitti, yenileme süresi (14 gün) işliyor */
  | "grace"
  /** Yenileme süresi de doldu */
  | "expired";

export interface PremiumPhaseInput {
  /** Premium şu an etkin mi (profile.isPremium) */
  isPremium: boolean;
  /** Mağaza / promosyon bitişi; null = hiç yok ya da süresiz */
  premiumExpiresAt: string | null | undefined;
  /** Sunucunun kış uykusu bitişi (couples.grace_until); varsa bitiş + 14 gün hesabının yerine geçer */
  graceUntil?: string | null;
  now?: number;
}

export interface PremiumPhaseResult {
  phase: PremiumPhase;
  /** Etkin Premium'un bitişine kalan tam gün (yalnızca phase = active ve bitişi varsa) */
  daysUntilEnd: number | null;
  /** Yenileme süresinin bitişine kalan gün (yalnızca phase = grace; en az 1) */
  graceDaysLeft: number | null;
  /** Yenileme süresinin bittiği an (ms); yalnızca bitişi olan çiftlerde */
  graceEndsAt: number | null;
}

export function derivePremiumPhase({ isPremium, premiumExpiresAt, graceUntil, now = Date.now() }: PremiumPhaseInput): PremiumPhaseResult {
  const expiresAt = premiumExpiresAt ? Date.parse(premiumExpiresAt) : null;
  const validExpiry = expiresAt !== null && Number.isFinite(expiresAt) ? expiresAt : null;
  const serverGraceEnd = graceUntil ? Date.parse(graceUntil) : NaN;
  const graceEndsAt = Number.isFinite(serverGraceEnd)
    ? serverGraceEnd
    : validExpiry === null ? null : validExpiry + PREMIUM_GRACE_DAYS * DAY_MS;

  if (isPremium) {
    if (validExpiry === null) return { phase: "lifetime", daysUntilEnd: null, graceDaysLeft: null, graceEndsAt: null };
    return {
      phase: "active",
      daysUntilEnd: Math.max(0, Math.ceil((validExpiry - now) / DAY_MS)),
      graceDaysLeft: null,
      graceEndsAt,
    };
  }

  if (graceEndsAt === null) return { phase: "free", daysUntilEnd: null, graceDaysLeft: null, graceEndsAt: null };
  if (now < graceEndsAt) {
    return {
      phase: "grace",
      daysUntilEnd: null,
      graceDaysLeft: Math.max(1, Math.ceil((graceEndsAt - now) / DAY_MS)),
      graceEndsAt,
    };
  }
  return { phase: "expired", daysUntilEnd: null, graceDaysLeft: null, graceEndsAt };
}
