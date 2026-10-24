import * as Notifications from "expo-notifications";
import { supabase } from "@/lib/supabase";
import { dayjs, todayString } from "@/lib/date";
import { logger } from "@/utils/logger";
import {
  cancelLocalNotification,
  scheduleDailyLocalNotification,
  scheduleDateLocalNotification,
  type LocalNotificationOptions,
} from "@/lib/notifications";

/**
 * Yerel (cihazda zamanlanan) hatırlatıcıların tek doğruluk kaynağı.
 *
 * Bir hatırlatıcıyı yalnızca onu oluşturan cihaz kurarsa, partnerin cihazı habersiz kalır:
 *  - Sevgilinin senin için eklediği ilaç sende çalmaz,
 *  - Sevgilinin planladığı buluşma için sende "2 saat kaldı" bildirimi kurulmaz,
 *  - Gönderilen mektubun kilidi alıcıda açıldığında haber verilmez.
 * Ayrıca silinen/süresi biten kayıtların bildirimleri cihazda yetim kalır.
 * syncLocalReminders sunucudaki güncel kayıtlara bakıp bu cihazın bildirimlerini eşitler.
 */

const MEDICINE_PREFIX = "med_";
const MEETING_PREFIX = "meeting_reminder_";
const LETTER_PREFIX = "letter_unlock_";

/** Mektup kilidi bildirimi, açılış gününün bu saatinde (yerel saat) gösterilir. */
const LETTER_UNLOCK_HOUR = 9;
/** Buluşmadan kaç saat önce hatırlatılır. */
const MEETING_REMINDER_HOURS = 2;
/** iOS en fazla 64 bekleyen yerel bildirim tutar: ilaç (günlük) bildirimlerine yer kalsın diye en yakınlar zamanlanır. */
const MAX_MEETING_REMINDERS = 15;
const MAX_LETTER_REMINDERS = 15;
/** Arka arkaya gelen senkron isteklerini sıklaştırmamak için alt sınır. */
const MIN_SYNC_INTERVAL_MS = 2 * 60 * 1000;

export const MEDICINE_REMINDER_OPTIONS: LocalNotificationOptions = {
  subtitle: "İlaç Takibi",
  color: "#34D399",
  channelId: "medicine_channel",
  data: { type: "medicine_reminder", route: "/(tabs)/medicine", actionLabel: "İlaç Takibine Git 💊" },
};

export const MEETING_REMINDER_OPTIONS: LocalNotificationOptions = {
  subtitle: "Buluşma Yaklaşıyor",
  color: "#C084FC",
  channelId: "partner_messages",
  data: { type: "meeting", route: "/(tabs)/meetings", actionLabel: "Planı Gör 🗓️" },
};

export const LETTER_UNLOCK_OPTIONS: LocalNotificationOptions = {
  subtitle: "Kilit Açıldı",
  color: "#F5C563",
  channelId: "letters_channel",
  data: { type: "letter", route: "/(tabs)/letters", actionLabel: "Mektubu Aç 📜" },
};

export const medicineReminderId = (medicineId: number | string, time: string) =>
  `${MEDICINE_PREFIX}${medicineId}_${time}`;

export const meetingReminderId = (meetingId: number | string) => `${MEETING_PREFIX}${meetingId}`;

const medicineReminderBody = (name: string) => `${name} ilacını alma vakti geldi. Kendine iyi bak 💙`;
const meetingReminderBody = (title: string) => `"${title}" buluşmanıza ${MEETING_REMINDER_HOURS} saat kaldı. Hazırlıklar tamam mı? 💕`;
const letterUnlockBody = (count: number) =>
  count > 1
    ? `Bugün ${count} mektubunun kilidi açıldı! Açmak için dokun 📜`
    : "Bugün bir mektubunun kilidi açıldı! Açmak için dokun 📜";

/** "09:00" / "09:00:00" → "09:00"; geçersizse null. */
function normalizeTime(raw: string | null | undefined): string | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(raw ?? "");
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${match[2]}`;
}

/** Tek bir ilaç dozu için günlük hatırlatıcıyı kurar (ilaç ekranı ve senkron ortak kullanır). */
export function scheduleMedicineReminder(medicineId: number | string, name: string, time: string) {
  const normalized = normalizeTime(time);
  if (!normalized) return Promise.resolve();
  const [h, m] = normalized.split(":").map(Number);
  return scheduleDailyLocalNotification(
    medicineReminderId(medicineId, normalized),
    "İlaç Vakti 💧",
    medicineReminderBody(name),
    h,
    m,
    MEDICINE_REMINDER_OPTIONS
  );
}

/**
 * Buluşmadan 2 saat önceki tek seferlik hatırlatıcıyı kurar. Saat geçmişteyse (örn. buluşma
 * yakına çekildiyse) eski hatırlatıcı iptal edilir ve yenisi kurulmaz.
 */
export function scheduleMeetingReminder(meetingId: number | string, title: string, meetingDateTime: Date | string) {
  const when = dayjs(meetingDateTime).subtract(MEETING_REMINDER_HOURS, "hour").toDate();
  return scheduleDateLocalNotification(
    meetingReminderId(meetingId),
    "Buluşma Yaklaşıyor! ⏳",
    meetingReminderBody(title),
    when,
    MEETING_REMINDER_OPTIONS
  );
}

type ScheduledMap = Map<string, Notifications.NotificationRequest>;

/** Aynı kimlikle zaten aynı içerik/zamanla kurulmuşsa yeniden kurmaya gerek yok. */
function dailyUpToDate(existing: Notifications.NotificationRequest | undefined, body: string, h: number, m: number) {
  const trigger = existing?.trigger as any;
  return !!existing && existing.content.body === body && trigger?.type === "daily" && trigger.hour === h && trigger.minute === m;
}

function dateUpToDate(existing: Notifications.NotificationRequest | undefined, body: string, when: Date) {
  const trigger = existing?.trigger as any;
  const value = typeof trigger?.value === "number" ? trigger.value : trigger?.date ? new Date(trigger.date).getTime() : NaN;
  return !!existing && existing.content.body === body && Math.abs(value - when.getTime()) < 1000;
}

async function cancelOrphans(scheduled: ScheduledMap, prefix: string, keep: Set<string>) {
  for (const id of scheduled.keys()) {
    if (id.startsWith(prefix) && !keep.has(id)) await cancelLocalNotification(id);
  }
}

async function syncMedicines(userId: string, coupleId: number, scheduled: ScheduledMap) {
  const { data, error } = await supabase
    .from("medicines")
    .select("id, name, time, times, end_date")
    .eq("couple_id", coupleId)
    .eq("user_id", userId)
    .eq("is_active", true);
  if (error) throw error;

  const today = todayString();
  const keep = new Set<string>();

  for (const med of data ?? []) {
    // Süresi bitmiş ilaç için hatırlatıcı çalmasın (günlük tetikleyicinin bitiş tarihi yoktur)
    if (med.end_date && med.end_date < today) continue;

    const slots = (Array.isArray(med.times) && med.times.length > 0 ? med.times : [med.time])
      .map((t: string) => normalizeTime(t))
      .filter((t: string | null): t is string => !!t);

    for (const time of slots) {
      const id = medicineReminderId(med.id, time);
      keep.add(id);
      const [h, m] = time.split(":").map(Number);
      if (dailyUpToDate(scheduled.get(id), medicineReminderBody(med.name), h, m)) continue;
      await scheduleMedicineReminder(med.id, med.name, time);
    }
  }

  await cancelOrphans(scheduled, MEDICINE_PREFIX, keep);
}

async function syncMeetings(coupleId: number, scheduled: ScheduledMap) {
  const { data, error } = await supabase
    .from("meetings")
    .select("id, title, meeting_datetime")
    .eq("couple_id", coupleId)
    .eq("is_active", true)
    .gt("meeting_datetime", new Date().toISOString())
    .order("meeting_datetime", { ascending: true })
    .limit(MAX_MEETING_REMINDERS);
  if (error) throw error;

  const keep = new Set<string>();

  for (const meeting of data ?? []) {
    const when = dayjs(meeting.meeting_datetime).subtract(MEETING_REMINDER_HOURS, "hour").toDate();
    if (when.getTime() <= Date.now()) continue;

    const id = meetingReminderId(meeting.id);
    keep.add(id);
    const body = meetingReminderBody(meeting.title);
    if (dateUpToDate(scheduled.get(id), body, when)) continue;
    await scheduleMeetingReminder(meeting.id, meeting.title, meeting.meeting_datetime);
  }

  await cancelOrphans(scheduled, MEETING_PREFIX, keep);
}

async function syncLetterUnlocks(scheduled: ScheduledMap) {
  // Kilitli mektuplar RLS ile alıcıdan gizlidir (018); yalnızca "ne zaman açılacak" bilgisini
  // veren SECURITY DEFINER RPC kullanılır (20261019000002 migrasyonu).
  const { data, error } = await supabase.rpc("get_my_pending_letter_unlocks");
  if (error) throw error;

  // Aynı güne denk gelen mektuplar tek bildirimde birleşir
  const countByDate = new Map<string, number>();
  for (const row of (data ?? []) as { unlock_date: string }[]) {
    const date = String(row.unlock_date).substring(0, 10);
    countByDate.set(date, (countByDate.get(date) ?? 0) + 1);
  }

  const keep = new Set<string>();
  const nearestDates = [...countByDate].sort(([a], [b]) => a.localeCompare(b)).slice(0, MAX_LETTER_REMINDERS);
  for (const [date, count] of nearestDates) {
    const when = dayjs(`${date}T${String(LETTER_UNLOCK_HOUR).padStart(2, "0")}:00:00`).toDate();
    if (when.getTime() <= Date.now()) continue;

    const id = `${LETTER_PREFIX}${date}`;
    keep.add(id);
    const body = letterUnlockBody(count);
    if (dateUpToDate(scheduled.get(id), body, when)) continue;
    await scheduleDateLocalNotification(id, "Mühürlü Mektup 💌", body, when, LETTER_UNLOCK_OPTIONS);
  }

  await cancelOrphans(scheduled, LETTER_PREFIX, keep);
}

let inFlight: Promise<void> | null = null;
let lastSyncAt = 0;
let lastSyncKey = "";

/**
 * Bu cihazdaki ilaç, buluşma ve mektup-kilidi hatırlatıcılarını sunucudaki güncel kayıtlarla eşitler.
 * Bildirim izni yoksa hiçbir şey kurmaz (izin penceresini ASLA kendisi açmaz).
 * Bir kaynak okunamazsa (ağ hatası vb.) o kaynağın mevcut bildirimlerine dokunulmaz.
 */
export function syncLocalReminders(userId: string, coupleId: number, options: { force?: boolean } = {}): Promise<void> {
  if (inFlight) return inFlight;

  const key = `${userId}:${coupleId}`;
  if (!options.force && key === lastSyncKey && Date.now() - lastSyncAt < MIN_SYNC_INTERVAL_MS) {
    return Promise.resolve();
  }

  inFlight = (async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") return;

      const list = await Notifications.getAllScheduledNotificationsAsync();
      const scheduled: ScheduledMap = new Map(
        list.map((n): [string, Notifications.NotificationRequest] => [n.identifier, n])
      );

      const results = await Promise.allSettled([
        syncMedicines(userId, coupleId, scheduled),
        syncMeetings(coupleId, scheduled),
        syncLetterUnlocks(scheduled),
      ]);

      results.forEach((result, i) => {
        if (result.status === "rejected") {
          logger.log(`[ReminderSync] ${["medicines", "meetings", "letters"][i]} skipped:`, result.reason?.message ?? result.reason);
        }
      });
    } catch (err) {
      logger.log("[ReminderSync] failed:", err);
    } finally {
      lastSyncKey = key;
      lastSyncAt = Date.now();
      inFlight = null;
    }
  })();

  return inFlight;
}
