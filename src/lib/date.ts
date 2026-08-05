import dayjs from "dayjs";
import "dayjs/locale/tr";
import isBetween from "dayjs/plugin/isBetween";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import dayOfYearPlugin from "dayjs/plugin/dayOfYear";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

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

export function daysSince(date: dayjs.Dayjs): number {
  const today = dayjs().tz("Europe/Istanbul").startOf("day");
  const diff = today.diff(date.tz("Europe/Istanbul").startOf("day"), "day");
  return Math.max(0, diff);
}

export function dayOfYear(date: dayjs.Dayjs = dayjs().tz("Europe/Istanbul")): number {
  return (date as any).dayOfYear() as number;
}

export function todayString(): string {
  return dayjs().tz("Europe/Istanbul").format("YYYY-MM-DD");
}

export function formatDateTR(date: string | Date | dayjs.Dayjs): string {
  return dayjs(date).locale("tr").format("D MMMM YYYY");
}

export function seededRandom(seed: number, min: number, max: number): number {
  const x = Math.sin(seed + 1) * 10000;
  const rand = x - Math.floor(x);
  return Math.floor(rand * (max - min + 1)) + min;
}

export function getLoveMeter(): number {
  const today = dayjs().tz("Europe/Istanbul").startOf("day");
  const seed = today.diff(dayjs.tz("2020-01-01", "Europe/Istanbul"), "day");
  return seededRandom(seed, 80, 100);
}

export function getTodayHitap(): string {
  const hitaplar = [
    "Güzelim",
    "Aşkım",
    "Bebeğim",
    "Bir Tanem",
    "Balım",
    "Tatlım",
    "Hanımefendi",
    "Ömrüm",
    "Hayatım",
    "Prensesim",
    "Ay Yüzlüm",
    "En Sevdiğim",
    "En Güzel Tesadüfüm",
    "Cennetim",
  ];
  const doy = dayOfYear();
  return hitaplar[doy % hitaplar.length];
}

export function getCountdown(targetDate: string | Date) {
  const target = dayjs.tz(targetDate, "Europe/Istanbul");
  const now = dayjs().tz("Europe/Istanbul");
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
