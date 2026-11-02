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
 * Kartta gösterilecek buluşmayı seçer:
 *  1. Gelecekte planlı buluşma varsa en yakını (yeni buluşma planlanırsa geçmiş kutlamanın yerine hemen bu geçer).
 *  2. Yoksa, son 24 saat (CELEBRATION_MS) içinde gerçekleşen ve bu cihazda henüz kutlanmamış en son buluşma.
 *  3. Aksi halde null (kart hiç gösterilmez).
 */
export function pickActiveMeeting<T extends MeetingLike>(
  meetings: T[] | null | undefined,
  now: number = Date.now(),
  seenMeetingIds?: ReadonlySet<number | string> | ((id: number | string) => boolean)
): T | null {
  if (!meetings || meetings.length === 0) return null;

  const sorted = [...meetings].sort((a, b) => timeOf(a) - timeOf(b));

  // 1. Gelecekteki en yakın buluşma (varsa geçmiş kutlamaya hiç bakılmaz, doğrudan bu gösterilir)
  const upcoming = sorted.find((m) => timeOf(m) > now);
  if (upcoming) return upcoming;

  // 2. Gelecekte buluşma yoksa, son 24 saat içinde gerçekleşmiş en son buluşmaya bakılır
  const past = sorted.filter((m) => timeOf(m) <= now);
  if (past.length === 0) return null;

  const lastPast = past[past.length - 1];
  if (now - timeOf(lastPast) >= CELEBRATION_MS) return null;

  // Bu cihazda kullanıcı karta dokunup kutlamayı gördüyse kart gizlenir
  if (lastPast.id != null && seenMeetingIds) {
    const isSeen =
      typeof seenMeetingIds === "function"
        ? seenMeetingIds(lastPast.id)
        : seenMeetingIds.has(lastPast.id);
    if (isSeen) return null;
  }

  return lastPast;
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
