import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { dayjs } from "@/lib/date";
import { isAwaitingPurge } from "@/lib/letterPolicy";
import { DEMO_LETTERS, DEMO_MEETINGS, DEMO_PHOTOS, DEMO_PROFILE } from "@/constants/demoData";
import type { PhotoItem } from "@/components/photos/photoTypes";

/**
 * Ana sekmelerin liste sorguları. Hem ekranlar hem de arka plan ön yüklemesi (prefetchMainScreens) aynı
 * anahtar ve aynı getirme işlevini kullanır: ana sayfa açıkken veri önceden iner, sekmeye geçilince
 * ağ beklenmeden çizilir.
 */

// ─── Mektuplar ───────────────────────────────────────────────────────────────
export const LETTERS_PAGE_SIZE = 30;

export const lettersQueryKey = (
  coupleId: number | null,
  userId: string | null,
  pageLimit: number,
  isDemoMode: boolean
) => ["letters_data", coupleId, userId, pageLimit, isDemoMode] as const;

export async function fetchLetters(params: {
  coupleId: number | null;
  userId: string | null;
  pageLimit: number;
  isDemoMode: boolean;
}) {
  const { coupleId, userId, pageLimit, isDemoMode } = params;
  if (isDemoMode) {
    const all = DEMO_LETTERS;
    const received = DEMO_LETTERS.filter((l) => l._type === "received");
    const sent = DEMO_LETTERS.filter((l) => l._type === "sent");
    return { all, received, sent };
  }
  const [receivedRes, sentRes, usersRes] = await Promise.all([
    supabase
      .from("letters")
      .select("*")
      .eq("couple_id", coupleId)
      .eq("receiver_id", userId)
      .order("created_at", { ascending: false })
      .limit(pageLimit),
    supabase
      .from("letters")
      .select("*")
      .eq("couple_id", coupleId)
      .eq("sender_id", userId)
      .order("created_at", { ascending: false })
      .limit(pageLimit),
    supabase.from("users").select("id, username, display_name").eq("couple_id", coupleId),
  ]);

  // Ağ hatasında boş mektup kutusu başarılı veri olarak önbelleğe alınmasın
  const firstError = receivedRes.error || sentRes.error || usersRes.error;
  if (firstError) throw firstError;

  const userMap = (usersRes.data || []).reduce((acc: any, u: any) => {
    acc[u.id] = u;
    return acc;
  }, {});

  // Silinmesi onaylanıp vakti gelen mektuplar saatlik iş silene kadar gösterilmez
  const now = Date.now();
  const received = (receivedRes.data || [])
    .filter((l: any) => !isAwaitingPurge(l, now))
    .map((l: any) => {
      const senderObj = userMap[l.sender_id];
      return {
        ...l,
        _type: "received" as const,
        // İçerik burada çözülmez: crypto-js saf JS olduğundan 30-60 mektubu birden çözmek ekranı
        // kilitliyordu. Çözme yalnızca ekranda görünen/açılan satır için render'da (önbellekli) yapılır.
        content: l.content,
        sender: senderObj ? { ...senderObj, username: senderObj.username || "Sevgilin" } : null,
      };
    });

  const sent = (sentRes.data || [])
    .filter((l: any) => !isAwaitingPurge(l, now))
    .map((l: any) => {
      const receiverObj = userMap[l.receiver_id];
      return {
        ...l,
        _type: "sent" as const,
        content: l.content,
        receiver: receiverObj ? { ...receiverObj, username: receiverObj.username || "Sevgilin" } : null,
      };
    });

  return {
    received,
    sent,
    all: [...received, ...sent].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ),
  };
}

// ─── Fotoğraflar ─────────────────────────────────────────────────────────────
export const PHOTOS_PAGE_SIZE = 30;
export type PhotoSortOrder = "desc" | "asc";

export const photosQueryKey = (coupleId: number | null, isDemoMode: boolean, sortOrder: PhotoSortOrder) =>
  ["photo_archive", coupleId, isDemoMode, sortOrder] as const;

export async function fetchPhotosPage(params: {
  coupleId: number | null;
  pageParam: number;
  sortOrder: PhotoSortOrder;
  isDemoMode: boolean;
}): Promise<PhotoItem[]> {
  const { coupleId, pageParam, sortOrder, isDemoMode } = params;
  if (isDemoMode) {
    const sorted = [...(DEMO_PHOTOS as any[])].sort((a, b) => {
      const diff = new Date(a.taken_date).getTime() - new Date(b.taken_date).getTime();
      return sortOrder === "asc" ? diff : -diff;
    });
    return sorted as any;
  }
  const asc = sortOrder === "asc";
  const { data, error } = await supabase
    .from("photo_archive")
    .select("id, storage_path, thumb_path, taken_date, taken_time, title, description, user_id, created_at")
    .eq("couple_id", coupleId)
    .order("taken_date", { ascending: asc })
    .order("created_at", { ascending: asc })
    .range(pageParam * PHOTOS_PAGE_SIZE, (pageParam + 1) * PHOTOS_PAGE_SIZE - 1);

  if (error) throw error;
  return (data || []) as PhotoItem[];
}

// ─── Anılar / özel günler ────────────────────────────────────────────────────
export const MEMORIES_PAGE_SIZE = 15;

export const memoriesQueryKey = (coupleId: number | null, isDemoMode: boolean) =>
  ["memories", coupleId, isDemoMode] as const;

export async function fetchMemoriesPage(params: { coupleId: number | null; pageParam: number; isDemoMode: boolean }) {
  const { coupleId, pageParam, isDemoMode } = params;
  if (isDemoMode) {
    return [
      {
        id: 1,
        title: "Sevgili Olduğumuz İlk Gün 💖",
        date: DEMO_PROFILE.relationshipStartDate ?? dayjs().subtract(365, "day").format("YYYY-MM-DD"),
        description: "Birlikte el ele tutuşup geleceğe söz verdiğimiz o an...",
      },
      {
        id: 2,
        title: "İlk Tanıştığımız Gün ☕",
        date: DEMO_PROFILE.meetDate ?? dayjs().subtract(428, "day").format("YYYY-MM-DD"),
        description: "Gözlerinin içindeki parıltıyı ilk fark ettiğim gün.",
      },
    ] as any[];
  }
  const { data, error } = await supabase
    .from("memories")
    .select("id, date, title, description, image_path, is_default")
    .eq("couple_id", coupleId)
    .order("date", { ascending: false })
    .range(pageParam * MEMORIES_PAGE_SIZE, (pageParam + 1) * MEMORIES_PAGE_SIZE - 1);

  if (error) throw error;
  return data || [];
}

// ─── Buluşmalar ──────────────────────────────────────────────────────────────
export const meetingsQueryKey = (coupleId: number | null | undefined, isDemoMode: boolean) =>
  ["meetings", coupleId, isDemoMode] as const;

export async function fetchMeetings(params: { coupleId: number | null | undefined; isDemoMode: boolean }) {
  const { coupleId, isDemoMode } = params;
  if (isDemoMode) return DEMO_MEETINGS;
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("couple_id", coupleId)
    .order("meeting_datetime", { ascending: false })
    .limit(300);

  if (error) throw error;
  return data || [];
}

// ─── Arka plan ön yüklemesi ──────────────────────────────────────────────────
const PREFETCH_STALE_MS = 1000 * 60 * 5;

/**
 * Ana sayfa açıldıktan sonra sık kullanılan sekmelerin ilk sayfasını sessizce indirir.
 * Hatalar yutulur: ön yükleme asla kullanıcıya görünmez, ekran açılınca normal yükleme devreye girer.
 */
export function prefetchMainScreens(
  queryClient: QueryClient,
  ctx: { coupleId: number | null; userId: string | null; isPremium: boolean; isDemoMode: boolean }
) {
  const { coupleId, userId, isPremium, isDemoMode } = ctx;
  if (!isDemoMode && (!coupleId || !userId)) return;

  queryClient
    .prefetchQuery({
      queryKey: lettersQueryKey(coupleId, userId, LETTERS_PAGE_SIZE, isDemoMode),
      queryFn: () => fetchLetters({ coupleId, userId, pageLimit: LETTERS_PAGE_SIZE, isDemoMode }),
      staleTime: PREFETCH_STALE_MS,
    })
    .catch(() => {});

  queryClient
    .prefetchQuery({
      queryKey: meetingsQueryKey(coupleId, isDemoMode),
      queryFn: () => fetchMeetings({ coupleId, isDemoMode }),
      staleTime: PREFETCH_STALE_MS,
    })
    .catch(() => {});

  queryClient
    .prefetchInfiniteQuery({
      queryKey: memoriesQueryKey(coupleId, isDemoMode),
      initialPageParam: 0,
      queryFn: ({ pageParam }) => fetchMemoriesPage({ coupleId, pageParam, isDemoMode }),
      staleTime: PREFETCH_STALE_MS,
    })
    .catch(() => {});

  // Fotoğraf arşivi Premium'dur: ücretsiz hesap için boşuna istek atılmaz
  if (isPremium || isDemoMode) {
    queryClient
      .prefetchInfiniteQuery({
        queryKey: photosQueryKey(coupleId, isDemoMode, "desc"),
        initialPageParam: 0,
        queryFn: ({ pageParam }) => fetchPhotosPage({ coupleId, pageParam, sortOrder: "desc", isDemoMode }),
        staleTime: PREFETCH_STALE_MS,
      })
      .catch(() => {});
  }
}
