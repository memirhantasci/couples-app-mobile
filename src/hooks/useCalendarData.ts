import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { dayjs, todayString } from "@/lib/date";
import { PERIOD_DURATION_DAYS } from "@/lib/periodCycle";
import {
  DEMO_CALENDAR_NOTES,
  DEMO_CALENDAR_USERS,
  DEMO_PARTNER_ID,
  DEMO_PHOTOS,
} from "@/constants/demoData";

export interface CalendarFetchParams {
  coupleId: number | null | undefined;
  userId: string | null | undefined;
  isPremium: boolean;
  canSeePeriod: boolean;
  isDemoMode: boolean;
  /** Verinin ortalandığı ay (YYYY-MM-DD ya da YYYY-MM). Boşsa bu ay. Önceki + sonraki ay da yüklenir. */
  anchorMonth?: string;
}

export function getCalendarQueryKey(
  coupleId: number | null | undefined,
  isPremium: boolean,
  canSeePeriod: boolean,
  isDemoMode: boolean,
  anchorMonth?: string
) {
  // Ay en sonda: ["calendar_data"] önekiyle yapılan toplu geçersiz kılma hepsini kapsar
  return ["calendar_data", coupleId, isPremium, canSeePeriod, isDemoMode, (anchorMonth ?? todayString()).slice(0, 7)];
}

export async function fetchCalendarData(params: CalendarFetchParams) {
  const { coupleId, userId, isPremium, canSeePeriod, isDemoMode, anchorMonth } = params;
  const today = todayString();

  if (isDemoMode) {
    return {
      notes: DEMO_CALENDAR_NOTES,
      moods: [
        { date: today, mood_type: "love", user_id: userId },
        { date: today, mood_type: "😍", user_id: DEMO_PARTNER_ID },
      ],
      photos: DEMO_PHOTOS.map((p) => ({
        id: p.id,
        user_id: p.user_id,
        storage_path: p.storage_path,
        thumb_path: (p as any).thumb_path || p.storage_path,
        title: p.title,
        description: p.description,
        taken_date: p.taken_date,
        taken_time: p.taken_time,
      })),
      meetings: [
        {
          id: 1,
          title: "Romantik Akşam Yemeği 🍷",
          location: "Boğaz Manzaralı Restoran",
          meeting_datetime: `${today}T19:30:00`,
          status: "approved",
          created_by: userId,
        },
      ],
      periods: canSeePeriod
        ? [
            {
              id: 1,
              date: dayjs().subtract(2, "day").format("YYYY-MM-DD"),
              user_id: "demo-partner",
            },
          ]
        : [],
      users: DEMO_CALENDAR_USERS,
    };
  }

  if (!coupleId) {
    return {
      notes: [],
      moods: [],
      photos: [],
      meetings: [],
      periods: [],
      users: [],
    };
  }

  // 🚀 PERFORMANS OPTİMİZASYONU:
  // Yalnızca 3 ay (önceki, ortadaki, sonraki) sorgulanır. Ortadaki ay BUGÜNE sabit değildir: kullanıcı
  // takvimde bu pencerenin dışına geçince ekran yeni aya göre yeniden ortalanır (aksi halde eski aylar boş görünürdü).
  const anchor = anchorMonth ? dayjs(anchorMonth) : dayjs();
  const startDate = anchor.subtract(1, "month").startOf("month").format("YYYY-MM-DD");
  const endDate = anchor.add(1, "month").endOf("month").format("YYYY-MM-DD");

  const [notesRes, moodsRes, photosRes, meetingsRes, periodsRes, usersRes] = await Promise.all([
    supabase
      .from("calendar_notes")
      .select("id, date, note, user_id, created_at")
      .eq("couple_id", coupleId)
      .gte("date", startDate)
      .lte("date", endDate),
    supabase
      .from("moods")
      .select("date, mood_type, user_id")
      .eq("couple_id", coupleId)
      .gte("date", startDate)
      .lte("date", endDate),
    isPremium
      ? supabase
          .from("photo_archive")
          .select("id, user_id, storage_path, thumb_path, title, description, taken_date, taken_time")
          .eq("couple_id", coupleId)
          .gte("taken_date", startDate)
          .lte("taken_date", endDate)
          .order("taken_time", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from("meetings")
      .select("id, title, location, meeting_datetime, status, created_by")
      .eq("couple_id", coupleId)
      .gte("meeting_datetime", `${startDate}T00:00:00`)
      .lte("meeting_datetime", `${endDate}T23:59:59`),
    canSeePeriod
      ? supabase
          .from("period_logs")
          .select("id, date, user_id")
          .eq("couple_id", coupleId)
          .gte("date", dayjs(startDate).subtract(PERIOD_DURATION_DAYS - 1, "day").format("YYYY-MM-DD"))
          .lte("date", endDate)
      : Promise.resolve({ data: [] }),
    // '*' yerine sadece gerekli hafif sütunlar
    supabase
      .from("users")
      .select("id, display_name, username, avatar_url")
      .eq("couple_id", coupleId),
  ]);

  const userMap = (usersRes.data || []).reduce((acc: any, u: any) => {
    acc[u.id] = u;
    return acc;
  }, {});

  return {
    notes: (notesRes.data || []).map((n: any) => ({
      ...n,
      user: userMap[n.user_id],
    })),
    moods: (moodsRes.data || []).map((m: any) => ({
      ...m,
      user: userMap[m.user_id],
    })),
    photos: (photosRes.data || []).map((p: any) => ({
      ...p,
      uploader: userMap[p.user_id],
    })),
    meetings: (meetingsRes.data || []).map((m: any) => ({
      ...m,
      creator: userMap[m.created_by],
    })),
    periods: (periodsRes.data || []).map((p: any) => ({
      ...p,
      user: userMap[p.user_id],
    })),
    users: Object.values(userMap) as any[],
  };
}

/**
 * ⚡ Takvim verisini arka planda önceden yükler (Prefetch)
 * Kullanıcı ana sayfadayken çağrılır, böylece Takvim sekmesine tıklandığı an
 * veri beklemeden sıfır gecikmeyle (0ms) açılır.
 */
export function prefetchCalendarData(queryClient: QueryClient, params: CalendarFetchParams) {
  const { coupleId, isPremium, canSeePeriod, isDemoMode, anchorMonth } = params;
  if (!coupleId && !isDemoMode) return;

  const key = getCalendarQueryKey(coupleId, isPremium, canSeePeriod, isDemoMode, anchorMonth);
  queryClient.prefetchQuery({
    queryKey: key,
    queryFn: () => fetchCalendarData(params),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCalendarData(params: CalendarFetchParams) {
  const { coupleId, userId, isPremium, canSeePeriod, isDemoMode, anchorMonth } = params;

  return useQuery({
    queryKey: getCalendarQueryKey(coupleId, isPremium, canSeePeriod, isDemoMode, anchorMonth),
    enabled: !!coupleId || !!userId || isDemoMode,
    queryFn: () => fetchCalendarData(params),
    staleTime: 1000 * 60 * 5, // 5 dakika taze kalır
    gcTime: 1000 * 60 * 30, // 30 dakika hafızada tutulur
    placeholderData: (previousData) => previousData, // Arka plan yenilemelerinde ekranda sıçrama olmasın
  });
}
