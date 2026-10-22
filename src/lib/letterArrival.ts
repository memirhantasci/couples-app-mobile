import { safeStorage } from "@/lib/safeStorage";
import { supabase } from "@/lib/supabase";
import { logger } from "@/utils/logger";

// ─── Yeni Gelen Mektup Algılama ──────────────────────────────────────────────
// Kullanıcı uygulamaya girdiğinde, partnerinden kendisi görmeden gelmiş mektup varsa
// "mektup geldi" karşılaması (sol üstten uçup konan kuş) oynatılır. "Görüldü" işareti,
// SUNUCUNUN verdiği created_at değeri olarak saklanır: cihaz saati sapsa da aynı mektup
// iki kez "yeni" sayılmaz.

const SEEN_KEY_PREFIX = "@letters_seen_at_";
const EPOCH_ISO = "1970-01-01T00:00:00.000Z";
const MAX_ARRIVALS = 10;

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

function localDateString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Kullanıcının görmediği (kendisine gelmiş) mektupları bulur. İlk çalıştırmada mevcut mektuplar
 * "görülmüş" sayılır ve null döner: yalnızca bundan sonra gelenler karşılama tetikler.
 */
export async function fetchArrivedLetters(
  userId: string,
  coupleId: number
): Promise<ArrivedLetters | null> {
  try {
    const seenAt = await readSeenAt(userId);

    if (!seenAt) {
      const { data } = await supabase
        .from("letters")
        .select("created_at")
        .eq("couple_id", coupleId)
        .eq("receiver_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);
      await safeStorage.setItem(seenKey(userId), data?.[0]?.created_at ?? EPOCH_ISO);
      return null;
    }

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
      locked: !!unlockDate && unlockDate > localDateString(),
      newestCreatedAt: newest.created_at,
    };
  } catch (err) {
    logger.error("[LetterArrival] fetchArrivedLetters failed:", err);
    return null;
  }
}
