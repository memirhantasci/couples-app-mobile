/**
 * Premium durumunun saf (ekrandan bağımsız) çözümlemesi. Sunucudaki kural ile birebir aynıdır:
 * Premium bitince çifte yenilemesi için PREMIUM_GRACE_DAYS gün verilir; bu sürede yenilenmezse yıldızın
 * sahipliği, ışıltı skoru, kıvılcımlar ve anı gezegenleri silinir (bkz. release_lapsed_stars,
 * supabase/migrations/20261104000002_premium_lapse_star_release.sql).
 */
export const PREMIUM_GRACE_DAYS = 14;

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

export function derivePremiumPhase({ isPremium, premiumExpiresAt, now = Date.now() }: PremiumPhaseInput): PremiumPhaseResult {
  const expiresAt = premiumExpiresAt ? Date.parse(premiumExpiresAt) : null;
  const validExpiry = expiresAt !== null && Number.isFinite(expiresAt) ? expiresAt : null;
  const graceEndsAt = validExpiry === null ? null : validExpiry + PREMIUM_GRACE_DAYS * DAY_MS;

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
