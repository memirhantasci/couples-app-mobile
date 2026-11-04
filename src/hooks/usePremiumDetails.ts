import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useCoupleStarSummary } from "@/hooks/useCoupleStarSummary";
import { RevenueCatService, type PremiumEntitlement } from "@/lib/revenuecat";
import { derivePremiumPhase, type PremiumPhaseResult } from "@/lib/premiumStatus";

export interface PremiumDetails extends PremiumPhaseResult {
  /** Bu hesabın kendi mağaza aboneliği (yoksa Premium partnerden / promosyondan gelir ya da yoktur) */
  entitlement: PremiumEntitlement | null;
  /** Çiftin sahiplendiği bir yıldız var mı (bilinmiyorsa false) */
  hasStar: boolean;
  /** Mağaza bilgisi ilk kez yükleniyor */
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * Premium ekranının verisi: profildeki Premium durumu (sunucu), bu hesabın mağaza aboneliği (RevenueCat)
 * ve çiftin yıldızı. Ekran her odaklandığında mağaza bilgisi yenilenir.
 */
export function usePremiumDetails(): PremiumDetails {
  const { profile, isDemoMode } = useAuth();

  const [entitlement, setEntitlement] = useState<PremiumEntitlement | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    if (isDemoMode) {
      setLoaded(true);
      return;
    }
    try {
      setEntitlement(await RevenueCatService.getPremiumEntitlement());
    } catch {
      setEntitlement(null);
    } finally {
      setLoaded(true);
    }
  }, [isDemoMode]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const hasStar = useCoupleStarSummary() !== null;

  const phase = useMemo(
    () =>
      derivePremiumPhase({
        isPremium: profile?.isPremium ?? false,
        premiumExpiresAt: profile?.premiumExpiresAt,
        graceUntil: profile?.graceUntil,
      }),
    [profile?.isPremium, profile?.premiumExpiresAt, profile?.graceUntil]
  );

  return { ...phase, entitlement, hasStar, loading: !loaded, reload };
}
