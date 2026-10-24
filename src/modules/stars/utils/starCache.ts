import { safeStorage as AsyncStorage } from '@/lib/safeStorage';
import type { CoupleStarDetails, StarSystemMapPlanet } from '../types/star.types';

/**
 * Yıldız ekranının son bilinen verisi. Ekran açılırken ağı beklemeden bu kayıtla çizilir, ardından
 * sunucudan sessizce tazelenir (stale-while-revalidate). Hassas veri içermez (yıldız adı, konumu, gezegen listesi).
 */
interface StarCacheEntry {
  details: CoupleStarDetails;
  planets: StarSystemMapPlanet[];
}

const KEY_PREFIX = '@star_cache_v1_';
const memory = new Map<number, StarCacheEntry>();

export async function readStarCache(coupleId: number): Promise<StarCacheEntry | null> {
  const inMemory = memory.get(coupleId);
  if (inMemory) return inMemory;
  try {
    const raw = await AsyncStorage.getItem(`${KEY_PREFIX}${coupleId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StarCacheEntry;
    if (!parsed?.details?.star_id || !Array.isArray(parsed.planets)) return null;
    memory.set(coupleId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function writeStarCache(coupleId: number, entry: StarCacheEntry): void {
  memory.set(coupleId, entry);
  AsyncStorage.setItem(`${KEY_PREFIX}${coupleId}`, JSON.stringify(entry)).catch(() => {});
}

export function clearStarCache(coupleId: number | null | undefined): void {
  memory.clear();
  if (coupleId) AsyncStorage.removeItem(`${KEY_PREFIX}${coupleId}`).catch(() => {});
}
