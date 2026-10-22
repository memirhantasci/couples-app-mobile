import { safeStorage } from "@/lib/safeStorage";
import { supabase } from "@/lib/supabase";
import { letterUnlockAt } from "@/lib/letterPolicy";
import { logger } from "@/utils/logger";

// ─── Widget okunmamış rozeti ─────────────────────────────────────────────────
// "Okunmamış" = kullanıcının mektuplar ekranına son girişinden sonra gelen ya da kilidi açılan
// mektuplar + yanıt bekleyen silme istekleri. Ziyaret anı cihazda saklanır; ilk çalıştırmada
// "şimdi" sayılır, böylece eski mektuplar bir anda okunmamış görünmez.
// Uygulama kapalıyken açılacak mektupların açılış anları da widget'a verilir: widget bu anlar
// geçtikçe rozeti kendisi artırır (src/utils/widgetBridge.ts → letterUnlocksMs).

const VISITED_KEY_PREFIX = "@letters_visited_at_";
const MAX_RECENT_LETTERS = 50;

function visitedKey(userId: string): string {
  return `${VISITED_KEY_PREFIX}${userId}`;
}

/** Hermes'te güvenli ayrıştırma: mikrosaniyeli ("…:30.123456+00:00") metni ms'ye kırpar. */
function toMillis(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso.replace(/(\.\d{3})\d+/, "$1"));
  return Number.isNaN(ms) ? 0 : ms;
}

/** Mektuplar ekranı görüldü: o ana kadar gelen ve açılan mektuplar okunmuş sayılır. */
export async function markLettersVisited(userId: string): Promise<void> {
  try {
    await safeStorage.setItem(visitedKey(userId), String(Date.now()));
  } catch (err) {
    logger.error("[WidgetUnread] markLettersVisited failed:", err);
  }
}

export interface WidgetUnreadInfo {
  unreadCount: number;
  /** Alıcısı olunan, henüz kilitli mektupların açılış anları (epoch ms) */
  letterUnlocksMs: number[];
}

export async function fetchWidgetUnread(userId: string, coupleId: number): Promise<WidgetUnreadInfo> {
  try {
    let visitedAt = Number(await safeStorage.getItem(visitedKey(userId)));
    if (!visitedAt) {
      visitedAt = Date.now();
      await safeStorage.setItem(visitedKey(userId), String(visitedAt));
    }
    const now = Date.now();
    // Açılış günü oluşturulma gününden önce olamaz: ziyaretten sonra gelen ya da açılan her mektup
    // ziyaret günü veya sonrasında açılır
    const visitedDay = new Date(visitedAt).toISOString().substring(0, 10);

    const [recentRes, pendingRes, unlocksRes] = await Promise.all([
      supabase
        .from("letters")
        .select("unlock_date, created_at")
        .eq("couple_id", coupleId)
        .eq("receiver_id", userId)
        .gte("unlock_date", visitedDay)
        .limit(MAX_RECENT_LETTERS),
      supabase
        .from("letters")
        .select("id", { count: "exact", head: true })
        .eq("couple_id", coupleId)
        .eq("receiver_id", userId)
        .not("deletion_requested_at", "is", null)
        .is("deletion_approved_at", null)
        .is("deletion_rejected_at", null),
      // Kilitli mektuplar RLS ile alıcıdan gizlidir; RPC yalnızca açılış tarihlerini verir
      supabase.rpc("get_my_pending_letter_unlocks"),
    ]);

    const newLetters = (recentRes.data || []).filter((letter: any) => {
      const unlockAt = letterUnlockAt(letter);
      return unlockAt <= now && Math.max(unlockAt, toMillis(letter.created_at)) > visitedAt;
    }).length;
    const pendingApprovals = pendingRes.error ? 0 : pendingRes.count ?? 0;
    const letterUnlocksMs = ((unlocksRes.data as { unlock_date: string }[] | null) || [])
      .map((row) => letterUnlockAt(row))
      .filter((ms) => ms > now);

    return { unreadCount: newLetters + pendingApprovals, letterUnlocksMs };
  } catch (err) {
    logger.error("[WidgetUnread] fetchWidgetUnread failed:", err);
    return { unreadCount: 0, letterUnlocksMs: [] };
  }
}
