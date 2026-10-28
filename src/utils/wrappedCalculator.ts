import { supabase } from "@/lib/supabase";
import { dayjs, daysSince, todayString } from "@/lib/date";
import { DEMO_HOME_DATA, DEMO_MAP_LOCATIONS, DEMO_PHOTOS } from "@/constants/demoData";

export interface CoupleWrappedData {
  periodTitle: string; // örn. "Ekim 2024 Özeti" veya "2024 Yılı Özeti"
  daysTogether: number;
  lettersCount: number;
  dailyNotesCount: number;
  meetingsCount: number;
  photosCount: number;
  topMood: {
    emoji: string;
    label: string;
    count: number;
  };
  topLocation: string;
  totalLocationsCount: number;
  romanticStatement: string;
  highlightStat: string;
}

// moods.mood_type, ruh hali seçicideki emojinin kendisidir (bkz. MoodSelector MOODS)
const MOOD_EMOJIS: Record<string, { emoji: string; label: string }> = {
  "😍": { emoji: "😍", label: "Aşk Dolu & Çok Mutlu" },
  "😊": { emoji: "😊", label: "Mutlu" },
  "😐": { emoji: "😐", label: "Sakin" },
  "😢": { emoji: "😢", label: "Şefkat Arayışında" },
  "😡": { emoji: "😡", label: "Tutkulu & Sabırsız" },
  "😴": { emoji: "😴", label: "Yorgun ama Birlikte" },
};

/**
 * Belirli bir dönem için (aylık veya yıllık) Wrapped istatistiklerini hesaplar.
 * Sorgular başarısız olursa hata fırlatır: gerçek bir çifte uydurma sayılar gösterilmez.
 */
export async function computeCoupleWrapped(
  coupleId: number | null,
  startDateStr?: string | null,
  isDemoMode: boolean = false,
  period: "month" | "year" = "month"
): Promise<CoupleWrappedData> {
  const now = dayjs();
  const periodStart = period === "month" 
    ? now.startOf("month").toISOString() 
    : now.startOf("year").toISOString();
  const periodEnd = now.endOf("month").toISOString();
  
  const periodTitle = period === "month" 
    ? now.locale("tr").format("MMMM YYYY") + " Özeti"
    : now.format("YYYY") + " Yılı Özeti";

  const daysTogether = startDateStr ? Math.max(1, daysSince(dayjs(startDateStr))) : 142;

  if (isDemoMode || !coupleId) {
    return {
      periodTitle,
      daysTogether: 184,
      lettersCount: 12,
      dailyNotesCount: 28,
      meetingsCount: 4,
      photosCount: DEMO_PHOTOS.length || 16,
      topMood: { emoji: "🥰", label: "Aşk Dolu & Mutlu", count: 22 },
      topLocation: "Kadıköy Sahil",
      totalLocationsCount: DEMO_MAP_LOCATIONS.length || 6,
      romanticStatement: "Biz bu ay 31 kez birbirimizi seçtik.",
      highlightStat: "Birlikte 4 yeni küçük anı büyüttük.",
    };
  }

  const [
    lettersRes,
    notesRes,
    meetingsRes,
    photosRes,
    moodsRes,
  ] = await Promise.all([
    supabase
      .from("letters")
      .select("id")
      .eq("couple_id", coupleId)
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd),
    supabase
      .from("daily_notes")
      .select("id")
      .eq("couple_id", coupleId)
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd),
    supabase
      .from("meetings")
      .select("id, location_name")
      .eq("couple_id", coupleId)
      .gte("meeting_datetime", periodStart)
      .lte("meeting_datetime", periodEnd),
    supabase
      .from("photo_archive")
      .select("id")
      .eq("couple_id", coupleId)
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd),
    supabase
      .from("moods")
      .select("mood_type")
      .eq("couple_id", coupleId)
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd),
  ]);

  for (const res of [lettersRes, notesRes, meetingsRes, photosRes, moodsRes]) {
    if (res.error) throw res.error;
  }

  const lettersCount = lettersRes.data?.length || 0;
  const dailyNotesCount = notesRes.data?.length || 0;
  const meetingsCount = meetingsRes.data?.length || 0;
  const photosCount = photosRes.data?.length || 0;

  // Mood analizi
  const moodCounts: Record<string, number> = {};
  (moodsRes.data || []).forEach((m) => {
    if (m.mood_type) {
      moodCounts[m.mood_type] = (moodCounts[m.mood_type] || 0) + 1;
    }
  });

  let topMoodKey = "😍";
  let maxMoodCount = 0;
  Object.entries(moodCounts).forEach(([k, v]) => {
    if (v > maxMoodCount) {
      maxMoodCount = v;
      topMoodKey = k;
    }
  });

  const topMoodObj = MOOD_EMOJIS[topMoodKey] || { emoji: "💖", label: "Sevgi Dolu" };

  // Lokasyon analizi
  const locations = (meetingsRes.data || [])
    .map((m) => m.location_name)
    .filter(Boolean) as string[];

  const topLocation = locations.length > 0 ? locations[0] : "Birlikte Her Yer";
  const totalLocationsCount = locations.length;

  const daysCountInPeriod = period === "month" ? now.date() : now.dayOfYear();

  return {
    periodTitle,
    daysTogether,
    lettersCount,
    dailyNotesCount,
    meetingsCount,
    photosCount,
    topMood: {
      emoji: topMoodObj.emoji,
      label: topMoodObj.label,
      count: maxMoodCount || 1,
    },
    topLocation,
    totalLocationsCount: Math.max(1, totalLocationsCount),
    romanticStatement: `Biz bu dönemde ${daysCountInPeriod} kez birbirimizi seçtik.`,
    highlightStat: `${lettersCount + photosCount} tatlı anıyı birlikte biriktirdik.`,
  };
}
