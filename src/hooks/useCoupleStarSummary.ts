import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export interface CoupleStarSummary {
  /** Çiftin yıldız adı (verilmemişse null) */
  name: string | null;
}

/**
 * Çiftin sahiplendiği yıldızın özeti; yıldız yoksa null. Yalnızca "var mı" ve ad bilgisi gerektiren
 * yerler (Premium ekranı, ana sayfadaki kış uykusu kartı) için hafif bir sorgudur; gökyüzü ekranı kendi
 * ayrıntılı verisini ayrıca yükler.
 */
export function useCoupleStarSummary(): CoupleStarSummary | null {
  const { profile, isDemoMode } = useAuth();
  const coupleId = profile?.coupleId ?? null;

  const { data = null } = useQuery({
    queryKey: ["couple_star_summary", coupleId],
    enabled: !!coupleId && !isDemoMode,
    staleTime: 60_000,
    queryFn: async (): Promise<CoupleStarSummary | null> => {
      const { data: row } = await supabase
        .from("couple_stars")
        .select("id, custom_name")
        .eq("couple_id", coupleId)
        .maybeSingle();
      return row ? { name: row.custom_name?.trim() || null } : null;
    },
  });

  return data;
}
