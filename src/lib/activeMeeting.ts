// Ana sayfadaki buluşma kartı için seçim mantığı ve görüldü hafızası.
import { safeStorage } from "@/lib/safeStorage";

/** Gerçekleşen buluşma, kutlama kartı olarak bu süre boyunca (saat) gösterilir. */
export const MEETING_CELEBRATION_HOURS = 24;
export const MEETING_CELEBRATION_MINUTES = MEETING_CELEBRATION_HOURS * 60;

export const CELEBRATION_MS = MEETING_CELEBRATION_HOURS * 60 * 60 * 1000;

export const SEEN_CELEBRATION_KEY_PREFIX = "@seen_celebration_";

export function seenCelebrationKey(meetingId: number | string): string {
  return `${SEEN_CELEBRATION_KEY_PREFIX}${meetingId}`;
}

/** Buluşma kutlaması bu cihazda daha önce görüldü / dokunuldu mu */
export async function isMeetingCelebrationSeen(meetingId: number | string): Promise<boolean> {
  try {
    const val = await safeStorage.getItem(seenCelebrationKey(meetingId));
    return val === "true";
  } catch {
    return false;
  }
}

/** Buluşma kutlamasını bu cihaz için görüldü olarak işaretler */
export async function markMeetingCelebrationSeen(meetingId: number | string): Promise<void> {
  try {
    await safeStorage.setItem(seenCelebrationKey(meetingId), "true");
  } catch {
    // Depolama hatası akışı bozmasın
  }
}

export interface MeetingLike {
  id?: number | string;
  meeting_datetime: string;
}

const timeOf = (m: MeetingLike) => new Date(m.meeting_datetime).getTime();

/**
 * Kutlama adayı: son 24 saat (CELEBRATION_MS) içinde gerçekleşen en son buluşma. Cihazda kutlanıp kutlanmadığına
 * bakılmaz; kart henüz görüldü kayıtları okunmadan karar vermemek için bunu ayrıca sorar.
 */
export function celebrationCandidate<T extends MeetingLike>(
  meetings: T[] | null | undefined,
  now: number = Date.now()
): T | null {
  let last: T | null = null;
  for (const m of meetings ?? []) {
    if (timeOf(m) <= now && (last === null || timeOf(m) >= timeOf(last))) last = m;
  }
  return last !== null && now - timeOf(last) < CELEBRATION_MS ? last : null;
}

/**
 * Kartta gösterilecek buluşmayı seçer:
 *  1. Son 24 saat içinde gerçekleşen ve bu cihazda henüz kutlanmamış en son buluşma. Sırada başka bir buluşma
 *     (ya da yeni planlanan) olsa bile kutlama yarıda kesilmez; kutlanınca ya da kapatılınca sıradaki gelir.
 *  2. Yoksa gelecekteki en yakın planlı buluşma.
 *  3. Aksi halde null (kart hiç gösterilmez).
 */
export function pickActiveMeeting<T extends MeetingLike>(
  meetings: T[] | null | undefined,
  now: number = Date.now(),
  seenMeetingIds?: ReadonlySet<number | string> | ((id: number | string) => boolean)
): T | null {
  if (!meetings || meetings.length === 0) return null;

  // 1. Kutlama bekleyen buluşma (kullanıcı karta dokunup kutlamayı gördüyse ya da kapattıysa sayılmaz)
  const celebration = celebrationCandidate(meetings, now);
  if (celebration) {
    const isSeen =
      celebration.id != null &&
      !!seenMeetingIds &&
      (typeof seenMeetingIds === "function"
        ? seenMeetingIds(celebration.id)
        : seenMeetingIds.has(celebration.id));
    if (!isSeen) return celebration;
  }

  // 2. Gelecekteki en yakın buluşma
  let upcoming: T | null = null;
  for (const m of meetings) {
    if (timeOf(m) > now && (upcoming === null || timeOf(m) < timeOf(upcoming))) upcoming = m;
  }
  return upcoming;
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
