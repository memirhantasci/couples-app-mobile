import { supabase } from "@/lib/supabase";
import { RevenueCatService } from "@/lib/revenuecat";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { logger } from "@/utils/logger";

/**
 * Premium sürekliliği (docs/HESAP_SILME_VE_PREMIUM_TASARIMI.md madde 4): kişinin mağaza aboneliği
 * GÜNCEL çiftine yazılır. Yeni biriyle eşleşen ya da hesabını silip aynı Apple/Google hesabıyla yeniden
 * kayıt olan kişinin kalan süresi böylece geri gelir.
 *
 * İstemci yalnızca mağaza satın almalarını sessizce RevenueCat'e iletir ve sunucudan "doğrula" ister; hak
 * sunucuda RevenueCat kaydından okunur (sync-premium Edge Function), istemcinin söylediğine güvenilmez.
 * Sonuç çift satırına yazılırsa profil realtime ile yenilenir.
 */
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const keyFor = (userId: string) => `@premium_sync_at_${userId}`;

let inFlight: Promise<void> | null = null;

export function syncStorePremium(userId: string, options: { force?: boolean } = {}): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      if (!options.force) {
        const last = Number(await AsyncStorage.getItem(keyFor(userId)).catch(() => null));
        if (Number.isFinite(last) && last > 0 && Date.now() - last < SYNC_INTERVAL_MS) return;
      }
      await RevenueCatService.syncPurchases();
      const { error } = await supabase.functions.invoke("sync-premium", { body: {} });
      if (error) {
        logger.warn("[premiumContinuity] sync-premium başarısız:", error);
        return;
      }
      await AsyncStorage.setItem(keyFor(userId), String(Date.now())).catch(() => {});
    } catch (err) {
      logger.warn("[premiumContinuity] senkron başarısız:", err);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

const TOUCH_INTERVAL_MS = 6 * 60 * 60 * 1000;
let lastTouchAt = 0;

/**
 * Son uygulama açılışı (hareketsiz eşleşmemiş hesap temizliği için, madde 5). Sunucu da en fazla 6 saatte
 * bir yazar; burada gereksiz istek atılmaz.
 */
export function touchLastSeen(): void {
  if (Date.now() - lastTouchAt < TOUCH_INTERVAL_MS) return;
  lastTouchAt = Date.now();
  Promise.resolve(supabase.rpc("touch_last_seen"))
    .then(({ error }) => {
      if (error) lastTouchAt = 0;
    })
    .catch(() => {
      lastTouchAt = 0;
    });
}
