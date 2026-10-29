import dayjs from "dayjs";
import "dayjs/locale/tr";
import dayOfYearPlugin from "dayjs/plugin/dayOfYear";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween";
import relativeTime from "dayjs/plugin/relativeTime";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(isBetween);
dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.extend(dayOfYearPlugin);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("tr");

// Varsayılan olarak Türkiye saatini kullan
dayjs.tz.setDefault("Europe/Istanbul");

export { dayjs };

// Generic fallback dates (gerçek tarihler çift profili veya demo verisinden gelir)
export const MEETING_DATE = dayjs().subtract(100, "day");
export const TOGETHER_DATE = dayjs().subtract(90, "day");

/**
 * Returns the number of days since a given date (0 if in the future)
 */
export function daysSince(date: dayjs.Dayjs): number {
  const today = dayjs().startOf("day");
  const diff = today.diff(date.startOf("day"), "day");
  return Math.max(0, diff);
}

/**
 * Returns day of year (1-indexed)
 */
/**
 * Returns day of year (1-indexed)
 */
export function dayOfYear(date: dayjs.Dayjs = dayjs()): number {
  return (date as any).dayOfYear() as number;
}

/**
 * Returns today's date as YYYY-MM-DD string
 */
/**
 * Returns today's date as YYYY-MM-DD string
 */
export function todayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a date for display in Turkish
 */
export function formatDateTR(date: string | Date | dayjs.Dayjs): string {
  return dayjs(date).locale("tr").format("D MMMM YYYY");
}

/**
 * Pseudo-random number between min and max using a seed
 * Same seed always produces same result
 */
export function seededRandom(seed: number, min: number, max: number): number {
  const x = Math.sin(seed + 1) * 10000;
  const rand = x - Math.floor(x);
  return Math.floor(rand * (max - min + 1)) + min;
}

/**
 * Returns today's love meter value (80-100, stable within the same day)
 */
/**
 * Returns today's love meter value (80-100, stable within the same day)
 */
export function getLoveMeter(): number {
  const today = dayjs().startOf("day");
  const seed = today.diff(dayjs("2020-01-01"), "day");
  return seededRandom(seed, 80, 100);
}

/**
 * Returns today's greeting (hitap) based on day of year
 */
export function getTodayHitap(): string {
  const hitaplar = [
    "Aşkım",
    "Sevgilim",
    "Bebeğim",
    "Bir Tanem",
    "Balım",
    "Tatlım",
    "Canım",
    "Ömrüm",
    "Hayatım",
    "Gözbebeğim",
    "Ay Yüzlüm",
    "En Sevdiğim",
    "En Güzel Tesadüfüm",
    "Kalbim",
    "Cennetim",
  ];
  const doy = dayOfYear();
  return hitaplar[doy % hitaplar.length];
}

/**
 * Returns a countdown object from now to a future datetime
 */
export function getCountdown(targetDate: string | Date) {
  const target = dayjs(targetDate);
  const now = dayjs();
  const diff = target.diff(now, "second");

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }

  const days = Math.floor(diff / (24 * 3600));
  const hours = Math.floor((diff % (24 * 3600)) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  return { days, hours, minutes, seconds, isPast: false };
}
