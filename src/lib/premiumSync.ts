/**
 * Mağaza satın alması başarılı olunca Premium'u sunucuya RevenueCat webhook'u yazar (supabase/functions/
 * revenuecat-webhook); bu birkaç saniye sürebilir. Profil Premium görünene kadar kısa aralıklarla yenilenir.
 * Süre dolarsa sessizce biter: abonelik zaten RevenueCat'te aktiftir, profil bir sonraki yenilemede güncellenir.
 */
const ATTEMPTS = 8;
const DELAY_MS = 1500;

export async function waitForServerPremium(
  refreshProfile: () => Promise<{ isPremium: boolean } | null>
): Promise<boolean> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const profile = await refreshProfile().catch(() => null);
    if (profile?.isPremium) return true;
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }
  return false;
}
