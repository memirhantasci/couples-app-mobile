import { NativeModules, Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { dayjs } from "@/lib/date";
import { logger } from "@/utils/logger";

/**
 * Ana ekran widget'ı köprüsü (iOS: expo-widgets / WidgetKit, Android: yerel AppWidget).
 *
 * Widget uygulamadan bağımsız çalıştığı için gün sayısı burada DEĞİL widget içinde hesaplanır:
 * köprü yalnızca `startDate`'i taşır. Böylece uygulama günlerce açılmasa da sayaç doğru kalır.
 */

export type CoupleWidgetState = "ready" | "locked" | "signedOut";

/** iOS widget'ı ve Android yerel modülü aynı sözleşmeyi okur — alanları değiştirirken ikisini de güncelleyin. */
export interface CoupleWidgetPayload {
  state: CoupleWidgetState;
  myName: string;
  partnerName: string;
  /** Sevgili olma (yoksa tanışma) tarihi, YYYY-MM-DD */
  startDate: string | null;
  /** Premium bitiş zamanı (epoch ms). null = süresiz. Widget bu andan sonra kendini kilitler. */
  premiumUntilMs: number | null;
  partnerMoodEmoji: string | null;
  partnerMoodLabel: string | null;
  /** Ruh halinin ait olduğu gün (YYYY-MM-DD); başka güne ait ruh hali gösterilmez. */
  moodDate: string | null;
  /** Yerel dosya (file://) yolları; yoksa baş harf gösterilir */
  myAvatarPath: string | null;
  partnerAvatarPath: string | null;
}

export interface CoupleWidgetInput {
  isPremium: boolean;
  premiumExpiresAt?: string | null;
  myName?: string | null;
  partnerName?: string | null;
  /** relationshipStartDate || meetDate */
  startDate?: string | null;
  partnerMoodEmoji?: string | null;
  partnerMoodLabel?: string | null;
  myAvatarUrl?: string | null;
  partnerAvatarUrl?: string | null;
}

const EMPTY_PAYLOAD: CoupleWidgetPayload = {
  state: "signedOut",
  myName: "",
  partnerName: "",
  startDate: null,
  premiumUntilMs: null,
  partnerMoodEmoji: null,
  partnerMoodLabel: null,
  moodDate: null,
  myAvatarPath: null,
  partnerAvatarPath: null,
};

// iOS'ta sistem her gece yarısı widget'ı yeniden çizer; bu kadar gün önceden zamanlanır
const IOS_TIMELINE_DAYS = 30;

// ─── Fotoğraf dosyaları ──────────────────────────────────────────────────────

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/** iOS: App Group klasörü (widget buradan okur). Android: uygulamanın kalıcı klasörü. */
function getAvatarDirectory(): Directory | null {
  if (Platform.OS === "ios") {
    // expo-widgets yalnızca iOS'ta yüklenir; lazy require ile Android/web paketine girmez
    const { widgetsDirectory } = require("expo-widgets") as { widgetsDirectory: string | null };
    return widgetsDirectory ? new Directory(widgetsDirectory) : null;
  }
  if (Platform.OS === "android") {
    const dir = new Directory(Paths.document, "widget");
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    return dir;
  }
  return null;
}

/**
 * Avatarı widget'ın okuyabileceği yerel dosyaya indirir ve yolunu döner.
 * Dosya adı URL'nin hash'ini içerir: fotoğraf değişince yeni dosya oluşur, eskiler silinir.
 */
async function ensureAvatarFile(role: "me" | "partner", url: string | null | undefined): Promise<string | null> {
  const dir = getAvatarDirectory();
  if (!dir) return null;

  const prefix = `widget_${role}_`;
  const wantedName = url ? `${prefix}${hashString(url)}.jpg` : null;

  try {
    for (const entry of dir.list()) {
      if (entry instanceof File && entry.name.startsWith(prefix) && entry.name !== wantedName) {
        entry.delete();
      }
    }

    if (!url || !wantedName) return null;

    const file = new File(dir, wantedName);
    if (!file.exists) {
      await File.downloadFileAsync(url, file, { idempotent: true });
    }
    return file.uri;
  } catch (error) {
    // Fotoğraf indirilemese bile widget baş harfle çalışmaya devam etmeli
    logger.error(`[WidgetBridge] ${role} avatar could not be prepared:`, error);
    return null;
  }
}

async function removeAllAvatarFiles(): Promise<void> {
  const dir = getAvatarDirectory();
  if (!dir) return;
  try {
    for (const entry of dir.list()) {
      if (entry instanceof File && entry.name.startsWith("widget_")) entry.delete();
    }
  } catch (error) {
    logger.error("[WidgetBridge] avatar cleanup error:", error);
  }
}

// ─── Platforma gönderim ──────────────────────────────────────────────────────

function pushToIos(payload: CoupleWidgetPayload): void {
  const { coupleWidget } = require("../../widgets/CoupleWidget") as typeof import("../../widgets/CoupleWidget");

  const now = new Date();
  const entries = [{ date: now, props: payload }];
  // Her gece yarısı için bir kayıt: widget gün sayısını kendi hesaplar (env.date kayıt tarihidir)
  for (let i = 1; i <= IOS_TIMELINE_DAYS; i++) {
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 0, 0, 5);
    entries.push({ date: midnight, props: payload });
  }
  // Premium bittiği anda widget kendini kilitlesin
  if (payload.premiumUntilMs && payload.premiumUntilMs > now.getTime()) {
    entries.push({ date: new Date(payload.premiumUntilMs), props: payload });
  }
  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  coupleWidget.updateTimeline(entries);
}

async function pushToAndroid(payload: CoupleWidgetPayload): Promise<void> {
  const { CoupleWidgetModule } = NativeModules;
  if (CoupleWidgetModule && typeof CoupleWidgetModule.updateWidget === "function") {
    await CoupleWidgetModule.updateWidget(JSON.stringify(payload));
  } else {
    logger.log("[WidgetBridge] CoupleWidgetModule not linked (Expo Go / web).");
  }
}

// Aynı veriyle art arda gelen çağrılar (ana sayfa her render'da tetikleyebilir) tekrar çalışmasın
let lastSignature = "";
let queue: Promise<unknown> = Promise.resolve();

async function pushPayload(payload: CoupleWidgetPayload): Promise<boolean> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return false;

  const signature = JSON.stringify(payload);
  if (signature === lastSignature) return true;

  try {
    if (Platform.OS === "ios") pushToIos(payload);
    else await pushToAndroid(payload);
    lastSignature = signature;
    return true;
  } catch (error) {
    logger.error("[WidgetBridge] Error updating widget:", error);
    return false;
  }
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

// ─── Dış API ─────────────────────────────────────────────────────────────────

/** Widget'ı güncel çift verisiyle günceller. Premium değilse kilit görünümü gönderilir. */
export function syncCoupleWidget(input: CoupleWidgetInput): Promise<boolean> {
  return enqueue(async () => {
    if (!input.isPremium) {
      await removeAllAvatarFiles();
      return pushPayload({ ...EMPTY_PAYLOAD, state: "locked" });
    }

    const [myAvatarPath, partnerAvatarPath] = await Promise.all([
      ensureAvatarFile("me", input.myAvatarUrl),
      ensureAvatarFile("partner", input.partnerAvatarUrl),
    ]);

    const hasMood = !!input.partnerMoodEmoji;
    const premiumUntilMs = input.premiumExpiresAt ? Date.parse(input.premiumExpiresAt) : NaN;
    return pushPayload({
      state: "ready",
      myName: input.myName?.trim() || "",
      partnerName: input.partnerName?.trim() || "Sevgilin",
      startDate: input.startDate ? input.startDate.substring(0, 10) : null,
      premiumUntilMs: Number.isFinite(premiumUntilMs) ? premiumUntilMs : null,
      partnerMoodEmoji: hasMood ? input.partnerMoodEmoji! : null,
      partnerMoodLabel: hasMood ? input.partnerMoodLabel ?? null : null,
      moodDate: hasMood ? dayjs().format("YYYY-MM-DD") : null,
      myAvatarPath,
      partnerAvatarPath,
    });
  });
}

/** Çıkış / hesap silme: önceki hesabın verisi ve fotoğrafları ekranda kalmasın. */
export function clearCoupleWidget(): Promise<boolean> {
  return enqueue(async () => {
    await removeAllAvatarFiles();
    return pushPayload({ ...EMPTY_PAYLOAD });
  });
}
