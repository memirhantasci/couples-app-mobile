import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export const COUPLE_AVATARS_QUERY_KEY = "couple_avatars";

type AvatarMap = Record<string, string | null>;

/**
 * Çiftin (ben + partner) profil fotoğrafları için tek doğruluk kaynağı.
 * Premium aktif değilse (ör. süre doldu) fotoğraflar gizlenir ve her yer harf avatarına döner.
 */
export function useCoupleAvatars() {
  const { session, profile, isDemoMode } = useAuth();
  const userId = session?.user?.id ?? null;
  const coupleId = profile?.coupleId ?? null;
  const isPremium = !!profile?.isPremium;

  const { data, isLoading } = useQuery({
    queryKey: [COUPLE_AVATARS_QUERY_KEY, coupleId ?? userId],
    enabled: !isDemoMode && !!userId,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<AvatarMap> => {
      const query = supabase.from("users").select("id, avatar_url");
      const { data: rows, error } = coupleId
        ? await query.eq("couple_id", coupleId)
        : await query.eq("id", userId);
      // Migration henüz uygulanmadıysa sütun yoktur: uygulama harf avatarlarıyla çalışmaya devam eder
      if (error || !rows) return {};
      return rows.reduce<AvatarMap>((acc, row: { id: string; avatar_url: string | null }) => {
        acc[row.id] = row.avatar_url ?? null;
        return acc;
      }, {});
    },
  });

  const avatars = useMemo<AvatarMap>(() => (isPremium && data ? data : {}), [isPremium, data]);

  const getAvatarUrl = useCallback(
    (id: string | null | undefined) => (id ? avatars[id] ?? null : null),
    [avatars]
  );

  const partnerId = useMemo(
    () => Object.keys(data ?? {}).find((id) => id !== userId) ?? null,
    [data, userId]
  );

  return {
    myAvatarUrl: getAvatarUrl(userId),
    partnerAvatarUrl: getAvatarUrl(partnerId),
    /** Premium'suz bile kullanıcının yüklü bir fotoğrafı var mı (kaldırma seçeneği için) */
    hasStoredAvatar: !!(userId && data?.[userId]),
    partnerId,
    getAvatarUrl,
    isLoading,
  };
}
