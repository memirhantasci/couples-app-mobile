import { supabase } from "@/lib/supabase";
import { dayjs, daysSince } from "@/lib/date";
import { DEMO_MAP_LOCATIONS, DEMO_PHOTOS } from "@/constants/demoData";
import i18n from "@/lib/i18n";
import type { ParseKeys } from "i18next";

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

/** Aylık özet, hesap en az bu kadar günlükse hazırlanır: yeni bir hesabın "ayı" yoktur. */
export const WRAPPED_MIN_ACCOUNT_DAYS = 30;

/**
 * Hesap, özetin gösterilmesi için yeterince eski mi? Oluşturulma tarihi bilinmiyorsa
 * (ya da geçersizse) özet gösterilmez.
 */
export function isAccountOldEnoughForWrapped(createdAt?: string | null): boolean {
  if (!createdAt) return false;
  const created = dayjs(createdAt);
  return created.isValid() && daysSince(created) >= WRAPPED_MIN_ACCOUNT_DAYS;
}

/** Dönemde özetlenecek hiçbir şey yoksa özet boş bir kart olurdu. */
export function hasWrappedActivity(data: CoupleWrappedData): boolean {
  return (
    data.lettersCount + data.dailyNotesCount + data.meetingsCount + data.photosCount + data.topMood.count > 0
  );
}

// moods.mood_type, ruh hali seçicideki emojinin kendisidir (bkz. MoodSelector MOODS)
const MOOD_EMOJIS: Record<string, { emoji: string; labelKey: ParseKeys }> = {
  "😍": { emoji: "😍", labelKey: "wrapped.moods.loveStruck" },
  "😊": { emoji: "😊", labelKey: "wrapped.moods.happy" },
  "😐": { emoji: "😐", labelKey: "wrapped.moods.calm" },
  "😢": { emoji: "😢", labelKey: "wrapped.moods.seekingTenderness" },
  "😡": { emoji: "😡", labelKey: "wrapped.moods.passionate" },
  "😴": { emoji: "😴", labelKey: "wrapped.moods.tiredTogether" },
};

/**
 * Belirli bir dönem için (aylık veya yıllık) Wrapped istatistiklerini hesaplar.
 * Sorgular başarısız olursa hata fırlatır: gerçek bir çifte uydurma sayılar gösterilmez.
 */
export async function computeCoupleWrapped(
  coupleId: number | null,
  startDateStr?: string | null,
  isDemoMode: boolean = false,
  period: "month" | "year" = "month",
  /** Özetlenecek dönemin içindeki bir an; verilmezse şimdi (ayın başında biten ayı özetlemek için). */
  reference: dayjs.Dayjs = dayjs()
): Promise<CoupleWrappedData> {
  const now = reference;
  const periodStart = period === "month" 
    ? now.startOf("month").toISOString() 
    : now.startOf("year").toISOString();
  const periodEnd = period === "month"
    ? now.endOf("month").toISOString()
    : now.endOf("year").toISOString();
  
  const periodTitle = period === "month" 
    ? i18n.t("wrapped.periodTitleMonth", { period: now.locale(i18n.language).format("MMMM YYYY") })
    : i18n.t("wrapped.periodTitleYear", { year: now.format("YYYY") });

  const daysTogether = startDateStr ? Math.max(1, daysSince(dayjs(startDateStr))) : 142;

  if (isDemoMode || !coupleId) {
    return {
      periodTitle,
      daysTogether: 184,
      lettersCount: 12,
      dailyNotesCount: 28,
      meetingsCount: 4,
      photosCount: DEMO_PHOTOS.length || 16,
      topMood: { emoji: "🥰", label: i18n.t("wrapped.moods.demoTop"), count: 22 },
      topLocation: i18n.t("wrapped.demoTopLocation"),
      totalLocationsCount: DEMO_MAP_LOCATIONS.length || 6,
      romanticStatement: i18n.t("wrapped.demoStatement"),
      highlightStat: i18n.t("wrapped.demoHighlight"),
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

  const topMoodObj = MOOD_EMOJIS[topMoodKey] || { emoji: "💖", labelKey: "wrapped.moods.fallback" as ParseKeys };

  // Lokasyon analizi
  const locations = (meetingsRes.data || [])
    .map((m) => m.location_name)
    .filter(Boolean) as string[];

  const topLocation = locations.length > 0 ? locations[0] : i18n.t("wrapped.anywhereTogether");
  const totalLocationsCount = locations.length;

  // Biten ayın tamamı, süren ayın şimdiye kadarki günleri sayılır
  const isCurrentPeriod = now.isSame(dayjs(), period);
  const daysCountInPeriod = isCurrentPeriod
    ? period === "month" ? now.date() : now.dayOfYear()
    : period === "month" ? now.daysInMonth() : now.endOf("year").dayOfYear();

  return {
    periodTitle,
    daysTogether,
    lettersCount,
    dailyNotesCount,
    meetingsCount,
    photosCount,
    topMood: {
      emoji: topMoodObj.emoji,
      label: i18n.t(topMoodObj.labelKey),
      count: maxMoodCount,
    },
    topLocation,
    totalLocationsCount,
    romanticStatement: i18n.t("wrapped.statement", { count: daysCountInPeriod }),
    highlightStat: i18n.t("wrapped.highlight", { count: lettersCount + photosCount }),
  };
}
