import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { useCoupleAvatars } from "@/hooks/useCoupleAvatars";
import { supabase } from "@/lib/supabase";
import { caseLocale } from "@/lib/textCase";
import { DEMO_PHOTOS } from "@/constants/demoData";
import type { StoryPhotoSource } from "@/components/share/storyDecor";

export interface StoryCouple {
  myName: string | null;
  partnerName: string | null;
  /** "E & S" (isim yoksa null) */
  initials: string | null;
  /** "Emirhan & Elif" (biri yoksa tek isim, ikisi de yoksa null) */
  names: string | null;
  /** Kartlardaki çift fotoğrafı: son galeri fotoğrafı → son anı fotoğrafı → profil fotoğrafı */
  cover: StoryPhotoSource | null;
}

interface StoryCoupleRow {
  partnerName: string | null;
  photoPath: string | null;
  memoryPath: string | null;
}

function initialOf(name: string): string {
  // Array.from: emojiyle başlayan isimde yarım vekil karakter (bozuk glif) çıkmasın
  return (Array.from(name.trim())[0] ?? "").toLocaleUpperCase(caseLocale());
}

/**
 * Paylaşım kartları (yıldız sertifikası, Wrapped, yıldönümü) için çiftin isimleri, baş harfleri ve kapak
 * fotoğrafı. `enabled` false iken sorgu çalışmaz (ör. kart henüz açılmadıysa).
 */
export function useStoryCouple(enabled = true): StoryCouple {
  const { t } = useTranslation();
  const { session, profile, isDemoMode } = useAuth();
  const { myAvatarUrl, partnerAvatarUrl } = useCoupleAvatars();
  const userId = session?.user?.id ?? null;
  const coupleId = profile?.coupleId ?? null;
  const isPremium = !!profile?.isPremium;

  const { data } = useQuery({
    queryKey: ["story_couple", coupleId, isPremium],
    enabled: enabled && !!coupleId && !isDemoMode,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<StoryCoupleRow> => {
      const [members, photo, memory] = await Promise.all([
        supabase.from("users").select("id, display_name, username").eq("couple_id", coupleId),
        // Galeri Premium özelliğidir: süresi dolmuşsa kartta da gösterilmez (profil fotoğraflarıyla aynı kural)
        isPremium
          ? supabase
              .from("photo_archive")
              .select("storage_path")
              .eq("couple_id", coupleId)
              .order("taken_date", { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("memories")
          .select("image_path")
          .eq("couple_id", coupleId)
          .not("image_path", "is", null)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const partner = ((members.data ?? []) as { id: string; display_name: string | null; username: string | null }[]).find(
        (row) => row.id !== userId
      );
      return {
        partnerName: partner?.display_name?.trim() || partner?.username?.trim() || null,
        photoPath: (photo.data as { storage_path?: string } | null)?.storage_path ?? null,
        memoryPath: (memory.data as { image_path?: string } | null)?.image_path ?? null,
      };
    },
  });

  const myName = profile?.displayName?.trim() || null;
  const partnerName = isDemoMode ? t("common.partnerFallback") : (data?.partnerName ?? null);
  const demoCover = DEMO_PHOTOS[0]?.storage_path ?? null;
  const photoPath = data?.photoPath ?? null;
  const memoryPath = data?.memoryPath ?? null;

  const cover = useMemo<StoryPhotoSource | null>(() => {
    if (isDemoMode) return demoCover ? { uri: demoCover } : null;
    if (photoPath) return { bucket: "photos", path: photoPath };
    if (memoryPath) return { bucket: "memories", path: memoryPath };
    const avatar = myAvatarUrl ?? partnerAvatarUrl;
    return avatar ? { uri: avatar } : null;
  }, [isDemoMode, demoCover, photoPath, memoryPath, myAvatarUrl, partnerAvatarUrl]);

  const named = [myName, partnerName].filter((name): name is string => !!name);
  return {
    myName,
    partnerName,
    initials: named.length > 0 ? named.map(initialOf).join(" & ") : null,
    names: named.length > 0 ? named.join(" & ") : null,
    cover,
  };
}
