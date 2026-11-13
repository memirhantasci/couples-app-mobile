/**
 * Ortak listenin ("Birlikte Yapacaklarımız") açılış kapısı: tek kaynak.
 *
 * Sunucu (migration 20261109000000+) 2026-11-13'te canlıya uygulandı ve `WISHLIST_SERVER_READY` açıldı; menü satırı,
 * isteğe bağlı sekme, menüdeki rehber kaydı, bildirim rotası ve veri katmanı (wishlistData.ts) bu tek bayrağa bağlıdır.
 * React, ağ ve Supabase bağımlılığı yoktur: testler bayrakları doğrudan verir.
 */

/** Sunucu canlıda mı. Kapalıyken veri wishlistMock.ts'ten (bellek içi) gelir. */
export const WISHLIST_SERVER_READY = true;

export const WISHLIST_ROUTE = "/(tabs)/wishlist";

export interface WishlistGateFlags {
  /** Varsayılan: WISHLIST_SERVER_READY */
  serverReady?: boolean;
  /** Varsayılan: __DEV__ (geliştirme yapısında mock veriyle denenebilir) */
  isDev?: boolean;
}

const isDevBuild = (): boolean => typeof __DEV__ !== "undefined" && __DEV__ === true;

/**
 * Kalıcı yüzeyler (sekme seçeneği, bildirim rotası) açık mı. Üretim yapısında yalnızca sunucu hazırsa;
 * geliştirme yapısında mock veriyle de açılır.
 */
export function isWishlistReleased(flags: WishlistGateFlags = {}): boolean {
  const { serverReady = WISHLIST_SERVER_READY, isDev = isDevBuild() } = flags;
  return serverReady || isDev;
}

/** İsteğe bağlı sekme seçeneklerinde görünür mü: ortak liste sekmesi yalnızca yayındayken. */
export function isTabReleased(key: string, flags: WishlistGateFlags = {}): boolean {
  return key !== "wishlist" || isWishlistReleased(flags);
}

/** Menüdeki rehber listesinde görünür mü: ortak liste rehberi yalnızca ekrana girilebiliyorsa. */
export function isGuideListed(pageKey: string, isDemoMode: boolean, flags: WishlistGateFlags = {}): boolean {
  return pageKey !== "wishlist" || canOpenWishlist(isDemoMode, flags);
}

/** Ekrana girilebilir mi (menü satırı, rehber listesi, ekranın kendi kapısı). Demo modu örnek veriyle açar. */
export function canOpenWishlist(isDemoMode: boolean, flags: WishlistGateFlags = {}): boolean {
  return isDemoMode || isWishlistReleased(flags);
}

/**
 * Ekranda "örnek/geçici veri" uyarısı gerekir mi: demo (örnek liste) ya da sunucu kapalıyken (bellek içi mock).
 * Sunucu açıkken ve demo dışındayken null.
 */
export function wishlistDataNotice(
  isDemoMode: boolean,
  flags: Pick<WishlistGateFlags, "serverReady"> = {}
): "demo" | "mock" | null {
  if (isDemoMode) return "demo";
  const { serverReady = WISHLIST_SERVER_READY } = flags;
  return serverReady ? null : "mock";
}
