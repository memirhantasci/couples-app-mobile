import dayjs, { type Dayjs } from "dayjs";
import type { ParseKeys, TFunction } from "i18next";

// ─── Özel Günler & Dinamik Selamlama ────────────────────────────────────────────
// Saf fonksiyonlar (ağ / depolama yok): ana sayfa başlığı ve aşk sayacının altın ışıltısı
// buradan beslenir.

/** Sevgililik yıldönümüne bu kadar gün kala (yıldönümü günü dahil) ışıltı başlar. */
export const ANNIVERSARY_GLOW_DAYS = 3;

export interface UpcomingAnniversary {
  /** Bugünden yıldönümüne kalan gün (0 = yıldönümü bugün) */
  daysLeft: number;
  /** Kaçıncı yıldönümü (ilk yıldönümü = 1) */
  years: number;
}

export interface SpecialDayState {
  /** Bugün 14 Şubat mı (tüm kullanıcılar için) */
  isValentines: boolean;
  /** Bir sonraki sevgililik yıldönümü; sevgili olma tarihi yoksa / henüz gelmemişse null */
  anniversary: UpcomingAnniversary | null;
  /** Aşk sayacının etrafında altın ışıltı gösterilsin mi */
  glow: boolean;
}

/** `year` yılındaki yıldönümü; 29 Şubat başlangıcı artık olmayan yılda 28 Şubat'a çekilir. */
function anniversaryInYear(start: Dayjs, year: number): Dayjs {
  const month = start.month();
  const lastDay = dayjs(new Date(year, month, 1)).daysInMonth();
  return dayjs(new Date(year, month, Math.min(start.date(), lastDay))).startOf("day");
}

export function getSpecialDayState(
  relationshipStartDate: string | null | undefined,
  now: Dayjs = dayjs()
): SpecialDayState {
  const today = now.startOf("day");
  const isValentines = today.month() === 1 && today.date() === 14;

  let anniversary: UpcomingAnniversary | null = null;
  if (relationshipStartDate) {
    const start = dayjs(relationshipStartDate);
    // Başlangıç tarihi gelecekteyse henüz yıldönümü yoktur
    if (start.isValid() && !start.startOf("day").isAfter(today)) {
      const startDay = start.startOf("day");
      let years = today.year() - startDay.year();
      let next = anniversaryInYear(startDay, today.year());

      if (next.isBefore(today)) {
        // Bu yılki yıldönümü geçti → bir sonrakine bak
        next = anniversaryInYear(startDay, today.year() + 1);
        years += 1;
      }
      if (years < 1) {
        // Başlangıç günü / aynı yıl: ilk yıldönümü gelecek yıl
        next = anniversaryInYear(startDay, startDay.year() + 1);
        years = 1;
      }

      anniversary = { daysLeft: next.diff(today, "day"), years };
    }
  }

  const glow = isValentines || (anniversary !== null && anniversary.daysLeft <= ANNIVERSARY_GLOW_DAYS);
  return { isValentines, anniversary, glow };
}

// ─── Selamlama ──────────────────────────────────────────────────────────────────

export type DayPeriod = "morning" | "afternoon" | "evening" | "night";

export function getDayPeriod(hour: number): DayPeriod {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
}

// Metinler çeviri anahtarı olarak tutulur; getGreeting çağıranın `t` fonksiyonuyla çevirir
const PERIOD_GREETING: Record<DayPeriod, { textKey: ParseKeys; emoji: string }> = {
  morning: { textKey: "home.greeting.morning", emoji: "☀️" },
  afternoon: { textKey: "home.greeting.afternoon", emoji: "🌸" },
  evening: { textKey: "home.greeting.evening", emoji: "" },
  night: { textKey: "home.greeting.night", emoji: "🌙" },
};

// Anahtarlar MoodSelector'daki emojilerle aynıdır
const MOOD_CAPTION: Record<string, ParseKeys> = {
  "😍": "home.moodCaption.love",
  "😊": "home.moodCaption.happy",
  "😐": "home.moodCaption.calm",
  "😢": "home.moodCaption.sad",
  "😡": "home.moodCaption.angry",
  "😴": "home.moodCaption.sleepy",
};

export interface Greeting {
  text: string;
  emoji: string;
  /** Başlığın altındaki tek satırlık not (özel gün / yıldönümü sayacı / ruh hali); yoksa null */
  caption: string | null;
}

/**
 * `t` parametre olarak alınır: ana sayfa render sırasında çağırır; böylece (React Compiler önbelleğine
 * karşı) dil değişince sonuç yenilenir.
 */
export function getGreeting(
  now: Dayjs,
  special: SpecialDayState,
  t: TFunction,
  mood?: string | null
): Greeting {
  const period = PERIOD_GREETING[getDayPeriod(now.hour())];
  const base = { text: t(period.textKey), emoji: period.emoji };
  const anniversary = special.anniversary;

  // Öncelik: yıldönümü günü > 14 Şubat > yaklaşan yıldönümü > ruh hali
  if (anniversary && anniversary.daysLeft === 0) {
    return { ...base, emoji: "🥂", caption: t("home.caption.anniversaryToday", { years: anniversary.years }) };
  }
  if (special.isValentines) {
    return { ...base, emoji: "💘", caption: t("home.caption.valentines") };
  }
  if (anniversary && anniversary.daysLeft <= ANNIVERSARY_GLOW_DAYS) {
    const caption =
      anniversary.daysLeft === 1
        ? t("home.caption.anniversaryTomorrow", { years: anniversary.years })
        : t("home.caption.anniversaryDaysLeft", { years: anniversary.years, daysLeft: anniversary.daysLeft });
    return { ...base, caption };
  }
  const moodKey = mood ? MOOD_CAPTION[mood] : undefined;
  return { ...base, caption: moodKey ? t(moodKey) : null };
}
