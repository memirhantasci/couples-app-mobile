import { notifyPartner } from "@/lib/notifications";
import { safeStorage } from "@/lib/safeStorage";
import { dayjs } from "@/lib/date";
import i18n from "@/lib/i18n";

// ─── Nazik Bakım: Hissini Partnerinle Paylaş ─────────────────────────────────
// Kadın, hassas günlerinde nasıl hissettiğini tek dokunuşla partnerine iletir.
//
// GİZLİLİK VE PREMIUM KURALI: Partner Premium değilse döngüyü göremez. Ona giden bildirimde ve
// bildirimden açılan paywall'da "döngü / regl / periyot / hassas gün" asla geçmez; bildirim yalnızca
// gizemli, romantik bir ilgi çağrısıdır. Premium çift bazındadır (couples.is_premium), bu yüzden
// gönderen telefon partnerin Premium durumunu kendi profilinden bilir.

export const GENTLE_CARE_FEELINGS = ["low_energy", "emotional", "resting"] as const;
export type GentleCareFeeling = (typeof GENTLE_CARE_FEELINGS)[number];

export function isGentleCareFeeling(value: unknown): value is GentleCareFeeling {
  return typeof value === "string" && (GENTLE_CARE_FEELINGS as readonly string[]).includes(value);
}

/** Aynı kişiye art arda bildirim yağmasın: iki paylaşım arasında en az bu kadar beklenir. */
export const GENTLE_CARE_COOLDOWN_MS = 15 * 60 * 1000;

const STORAGE_KEY_PREFIX = "@gentle_care_last_";

export interface GentleCareShare {
  feeling: GentleCareFeeling;
  /** Paylaşım anı (ms) */
  sentAt: number;
}

export async function getLastGentleCareShare(userId: string): Promise<GentleCareShare | null> {
  try {
    const raw = await safeStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && isGentleCareFeeling(parsed.feeling) && typeof parsed.sentAt === "number") return parsed;
  } catch {
    // bozuk kayıt: yokmuş gibi davranılır
  }
  return null;
}

/** Son paylaşımın üzerinden bekleme süresi geçmedi mi. */
export function isGentleCareCoolingDown(share: GentleCareShare | null): boolean {
  return !!share && Date.now() - share.sentAt < GENTLE_CARE_COOLDOWN_MS;
}

/** Bugün paylaşılmış his (yoksa null): seçenek listesinde "İletildi" olarak işaretlenir. */
export function feelingSharedToday(share: GentleCareShare | null): GentleCareFeeling | null {
  return share && dayjs(share.sentAt).isSame(dayjs(), "day") ? share.feeling : null;
}

/** Kilitli bildirime dokununca açılan paywall: bu bağlamda döngüden hiç söz etmez. */
export function gentleCarePaywallRoute(feeling: GentleCareFeeling): string {
  return `/paywall?context=feeling&feeling=${feeling}`;
}

/**
 * Hissi partnere iletir. Premium çiftte bildirim hissi açıkça söyler ve mesaj yazmaya çağırır;
 * Premium değilse hiçbir ipucu vermeyen kilitli bir bildirim gider (bkz. formatMessagingStyleNotification).
 */
export async function shareGentleCare(params: {
  coupleId: number;
  userId: string;
  feeling: GentleCareFeeling;
  partnerHasPremium: boolean;
}): Promise<GentleCareShare> {
  const { coupleId, userId, feeling, partnerHasPremium } = params;
  const data = partnerHasPremium
    ? {
        type: "gentle_care",
        feeling,
        locked: false,
        route: "/(tabs)/letters",
        actionLabel: i18n.t("notifications.actions.writeMessage"),
      }
    : {
        type: "gentle_care",
        feeling,
        locked: true,
        route: gentleCarePaywallRoute(feeling),
        actionLabel: i18n.t("notifications.actions.discoverFeeling"),
      };

  // Başlık ve gövde türe göre formatMessagingStyleNotification içinde kurulur
  await notifyPartner(coupleId, userId, "", "", data);

  const share: GentleCareShare = { feeling, sentAt: Date.now() };
  await safeStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(share));
  return share;
}
