// Ana sayfadaki buluşma kartı için seçim mantığı.

/** Gerçekleşen buluşma, kutlama kartı olarak bu süre boyunca (dakika) gösterilir. */
export const MEETING_CELEBRATION_MINUTES = 30;

const CELEBRATION_MS = MEETING_CELEBRATION_MINUTES * 60 * 1000;

interface MeetingLike {
  meeting_datetime: string;
}

const timeOf = (m: MeetingLike) => new Date(m.meeting_datetime).getTime();

/**
 * Kartta gösterilecek buluşmayı seçer:
 *  1. Gelecekte planlı buluşma varsa en yakını (geçmiş buluşmaya hiç bakılmaz).
 *  2. Yoksa, yalnızca son MEETING_CELEBRATION_MINUTES içinde gerçekleşen en son buluşma.
 *  3. Aksi halde null (kart hiç gösterilmez).
 */
export function pickActiveMeeting<T extends MeetingLike>(
  meetings: T[] | null | undefined,
  now: number = Date.now()
): T | null {
  if (!meetings || meetings.length === 0) return null;

  const sorted = [...meetings].sort((a, b) => timeOf(a) - timeOf(b));

  const upcoming = sorted.find((m) => timeOf(m) > now);
  if (upcoming) return upcoming;

  const lastPast = sorted[sorted.length - 1];
  return now - timeOf(lastPast) < CELEBRATION_MS ? lastPast : null;
}

/**
 * pickActiveMeeting sonucunun değişeceği bir sonraki an (epoch ms): bir buluşmanın saati
 * geldiğinde veya kutlama süresi dolduğunda. Böyle bir an yoksa null.
 */
export function nextMeetingBoundary(
  meetings: MeetingLike[] | null | undefined,
  now: number = Date.now()
): number | null {
  let next: number | null = null;
  for (const m of meetings ?? []) {
    for (const t of [timeOf(m), timeOf(m) + CELEBRATION_MS]) {
      if (t > now && (next === null || t < next)) next = t;
    }
  }
  return next;
}
