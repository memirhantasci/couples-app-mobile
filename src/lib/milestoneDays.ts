import dayjs, { type Dayjs } from "dayjs";

/**
 * "Birlikte N. gün" dönüm noktaları: ilişki başlangıcından itibaren 100'ün katı günler (100, 200, 300...).
 * Gün sayısı ana sayfadaki sayaçla ve widget ile aynıdır: başlangıç günü 0, ertesi gün 1.
 */
export const DAY_MILESTONE_STEP = 100;

/** Başlangıçtan `now`a geçen gün; başlangıç yok / geçersiz / gelecekteyse null. */
export function daysTogether(startDate: string | null | undefined, now: Dayjs = dayjs()): number | null {
  if (!startDate) return null;
  const start = dayjs(startDate);
  if (!start.isValid()) return null;
  const days = now.startOf("day").diff(start.startOf("day"), "day");
  return days >= 0 ? days : null;
}

/** Bugün 100'ün katı bir gün mü (0. gün sayılmaz). */
export function isDayMilestone(days: number | null | undefined): days is number {
  return typeof days === "number" && days > 0 && days % DAY_MILESTONE_STEP === 0;
}

/** Bugün dahil, sıradaki dönüm noktası günü ve tarihi; başlangıç yoksa null. */
export function nextDayMilestone(
  startDate: string | null | undefined,
  now: Dayjs = dayjs()
): { days: number; date: Dayjs } | null {
  const elapsed = daysTogether(startDate, now);
  if (elapsed === null) return null;
  const days = Math.max(1, Math.ceil(elapsed / DAY_MILESTONE_STEP)) * DAY_MILESTONE_STEP;
  return { days, date: dayjs(startDate).startOf("day").add(days, "day") };
}
