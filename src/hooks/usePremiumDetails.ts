import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
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
  const coupleId = profile?.coupleId ?? null;

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

  const { data: hasStar = false } = useQuery({
    queryKey: ["couple_star_exists", coupleId],
    enabled: !!coupleId && !isDemoMode,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("couple_stars").select("id").eq("couple_id", coupleId).maybeSingle();
      return !!data;
    },
  });

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
