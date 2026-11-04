import { safeStorage } from "@/lib/safeStorage";
import { supabase } from "@/lib/supabase";
import { logger } from "@/utils/logger";
import { LETTER_TZ_OFFSET } from "@/lib/letterPolicy";

// ─── Yeni Gelen Mektup Algılama ──────────────────────────────────────────────
// Kullanıcı uygulamaya girdiğinde, partnerinden kendisi görmeden gelmiş mektup varsa
// "mektup geldi" karşılaması (sol üstten uçup konan kuş) oynatılır. "Görüldü" işareti,
// SUNUCUNUN verdiği created_at değeri olarak saklanır: cihaz saati sapsa da aynı mektup
// iki kez "yeni" sayılmaz.

// Uygulama açıkken partnerden mektup bildirimi gelince karşılamayı hemen tetiklemek için
// (LetterArrivalHost dinler; normalde yalnızca açılışta / öne gelince kontrol eder).
const arrivalCheckListeners = new Set<() => void>();

export function requestLetterArrivalCheck(): void {
  arrivalCheckListeners.forEach((listener) => listener());
}

export function onLetterArrivalCheckRequested(listener: () => void): () => void {
  arrivalCheckListeners.add(listener);
  return () => {
    arrivalCheckListeners.delete(listener);
  };
}

// Soğuk açılıştaki ilk kontrolün sonucu: kuş karşılaması kendi başına bir andır, ana sayfanın "merhaba"
// titreşimi kuş uçacaksa susar (bkz. hapticGreeting) ve bunun için sonucu bekler.
let firstCheckBird: boolean | null = null;
const firstCheckWaiters = new Set<(bird: boolean) => void>();

/** İlk kontrol bitince bir kez bildirilir (kuş gösterilecek mi); sonraki çağrılar yok sayılır. */
export function reportFirstArrivalCheck(bird: boolean): void {
  if (firstCheckBird !== null) return;
  firstCheckBird = bird;
  firstCheckWaiters.forEach((settle) => settle(bird));
  firstCheckWaiters.clear();
}

/** İlk kontrolün sonucunu bekler; kontrol hiç çalışmazsa (misafir, eşleşme yok) süre dolunca false döner. */
export function waitForFirstArrivalCheck(timeoutMs: number): Promise<boolean> {
  if (firstCheckBird !== null) return Promise.resolve(firstCheckBird);
  return new Promise((resolve) => {
    const settle = (bird: boolean) => {
      clearTimeout(timer);
      firstCheckWaiters.delete(settle);
      resolve(bird);
    };
    const timer = setTimeout(() => settle(false), timeoutMs);
    firstCheckWaiters.add(settle);
  });
}

const SEEN_KEY_PREFIX = "@letters_seen_at_";
const EPOCH_ISO = "1970-01-01T00:00:00.000Z";
const MAX_ARRIVALS = 10;
// İlk kontrolde bundan yeni mektuplar "yeni geldi" sayılır (cihaz saati sapsa da tolere eder)
const FIRST_RUN_WINDOW_MS = 24 * 60 * 60 * 1000;

function seenKey(userId: string): string {
  return `${SEEN_KEY_PREFIX}${userId}`;
}

/** Hermes/V8'de güvenli ayrıştırma: mikrosaniyeli ("…:30.123456+00:00") metni ms'ye kırpar. */
function toMillis(iso: string): number {
  const ms = Date.parse(iso.replace(/(\.\d{3})\d+/, "$1"));
  return Number.isNaN(ms) ? 0 : ms;
}

async function readSeenAt(userId: string): Promise<string | null> {
  return safeStorage.getItem(seenKey(userId));
}

/**
 * Mektupları `upTo` zamanına kadar görülmüş say (verilmezse "şimdi").
 * İşaret yalnızca ileri gider; eski bir zaman damgası daha yeni olanı geri almaz.
 */
export async function markLettersSeen(userId: string, upTo?: string): Promise<void> {
  try {
    const next = upTo ?? new Date().toISOString();
    const current = await readSeenAt(userId);
    if (current && toMillis(current) >= toMillis(next)) return;
    await safeStorage.setItem(seenKey(userId), next);
  } catch (err) {
    logger.error("[LetterArrival] markLettersSeen failed:", err);
  }
}

export interface ArrivedLetters {
  /** Görülmemiş mektup sayısı (en çok MAX_ARRIVALS; fazlası "10+" diye gösterilir) */
  count: number;
  hasMore: boolean;
  /** Gönderenin görünen adı; çözülemezse null */
  senderName: string | null;
  /** En yeni mektubun açılış tarihi (YYYY-MM-DD) */
  unlockDate: string | null;
  /** Açılış tarihi gelecekte mi (mühürlü mü) */
  locked: boolean;
  /** En yeni mektubun created_at'i (sunucudan, ham) */
  newestCreatedAt: string;
}


/**
 * Kullanıcının görmediği (kendisine gelmiş) mektupları bulur. İlk çalıştırmada 24 saatten eski mektuplar
 * "görülmüş" sayılır; daha yeni olanlar (ör. ilk girişten hemen önce gönderilen) karşılama tetikler.
 */
export async function fetchArrivedLetters(
  userId: string,
  coupleId: number
): Promise<ArrivedLetters | null> {
  try {
    let storedSeenAt = await readSeenAt(userId);

    if (!storedSeenAt) {
      // Bu hesabın bu cihazdaki ilk kontrolü: eski mektuplar (yeniden kurulum, yeni cihaz) kuş tetiklemesin,
      // ama yakın zamanda gelmiş olanlar tetiklesin. Mektup, alıcı bu cihazda ilk kez giriş yapmadan önce
      // gönderilmiş olabilir; hepsini "görülmüş" saymak ilk girişteki karşılamayı yutuyordu.
      const cutoff = new Date(Date.now() - FIRST_RUN_WINDOW_MS).toISOString();
      const { data, error } = await supabase
        .from("letters")
        .select("created_at")
        .eq("couple_id", coupleId)
        .eq("receiver_id", userId)
        .lte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1);
      // Sorgu başarısızsa işaret yazılmaz: bir sonraki kontrol yeniden dener, eski mektuplar yanlışlıkla
      // "yeni" sayılmaz
      if (error) return null;
      const baseline: string = data?.[0]?.created_at ?? EPOCH_ISO;
      storedSeenAt = baseline;
      await safeStorage.setItem(seenKey(userId), baseline);
    }
    const seenAt: string = storedSeenAt;

    const { data, error } = await supabase
      .from("letters")
      .select("id, created_at, unlock_date, sender_id")
      .eq("couple_id", coupleId)
      .eq("receiver_id", userId)
      .gt("created_at", seenAt)
      .order("created_at", { ascending: false })
      .limit(MAX_ARRIVALS);

    if (error || !data || data.length === 0) return null;

    const newest = data[0];

    let senderName: string | null = null;
    try {
      const { data: sender } = await supabase
        .from("users")
        .select("display_name, username")
        .eq("id", newest.sender_id)
        .maybeSingle();
      senderName = sender?.display_name || sender?.username || null;
    } catch {
      senderName = null;
    }

    const unlockDate = typeof newest.unlock_date === "string" ? newest.unlock_date.substring(0, 10) : null;

    return {
      count: data.length,
      hasMore: data.length >= MAX_ARRIVALS,
      senderName,
      unlockDate,
      // Sunucu açılış gününün 00:00'ında (Türkiye saati) açar; cihaz saat diliminden bağımsız aynı an
      locked: !!unlockDate && Date.parse(`${unlockDate}T00:00:00${LETTER_TZ_OFFSET}`) > Date.now(),
      newestCreatedAt: newest.created_at,
    };
  } catch (err) {
    logger.error("[LetterArrival] fetchArrivedLetters failed:", err);
    return null;
  }
}
