import { safeStorage } from "@/lib/safeStorage";
import { cleanPlaceName, DEFAULT_SKY_TIME, isValidTime, MAX_TITLE_LENGTH } from "./flowLogic";

/** Cihazda tutulan son seçimler. Sunucuya GİTMEZ; çıkışta AuthContext.signOut temizler. */
export const SKY_PREFS_KEY = "@night_sky_prefs";

/**
 * Koordinat bilerek YOKTUR: bu depolama Android'in bulut yedeğine girebilir, kesin konum orada iz bırakmasın.
 * Yuvarlamak yerine hiç saklamamak seçildi: ~0,1° yuvarlama sınıra yakın yerde saat dilimini, dolayısıyla posteri
 * sessizce değiştirebilirdi; yeri yeniden seçmek ise tek dokunuş. Yer adı zaten ilçe/şehir düzeyindedir.
 */
export interface SkyPrefs {
  /** Yalnızca 2. adımda hatırlatma olarak gösterilir, hesaba girmez */
  placeName: string | null;
  time: string;
  /** Kullanıcı saati hatırlamıyorsa false */
  timeKnown: boolean;
  title: string;
}

export const EMPTY_SKY_PREFS: SkyPrefs = { placeName: null, time: DEFAULT_SKY_TIME, timeKnown: true, title: "" };

/** Eski sürüm koordinatı `place: { latitude, longitude, name }` olarak yazardı. */
function hasLegacyLocation(record: Record<string, unknown>): boolean {
  return "place" in record || "latitude" in record || "longitude" in record;
}

function parseRecord(raw: string | null): { prefs: SkyPrefs; legacy: boolean } {
  const empty = { prefs: EMPTY_SKY_PREFS, legacy: false };
  if (!raw) return empty;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return empty;
  const record = data as Record<string, unknown>;
  const legacy = hasLegacyLocation(record);

  return {
    // Eski biçimli kayıtta adın coğrafi kodlayıcıdan mı (tam adres) kullanıcıdan mı geldiği bilinmez: kısaltmak yerine
    // "Son seçimin" satırı gösterilmez. Eski sürümün adı zaten `place.name` içindeydi ve hiç okunmaz.
    prefs: {
      placeName: legacy ? null : cleanPlaceName(record.placeName),
      time: isValidTime(record.time) ? record.time : DEFAULT_SKY_TIME,
      timeKnown: record.timeKnown === false ? false : true,
      title: typeof record.title === "string" ? record.title.slice(0, MAX_TITLE_LENGTH) : "",
    },
    legacy,
  };
}

/** Bozuk, eksik ya da yabancı biçimli kayıt güvenle varsayılana döner; alan alan doğrulanır. */
export function parseSkyPrefs(raw: string | null): SkyPrefs {
  return parseRecord(raw).prefs;
}

export function serializeSkyPrefs(prefs: SkyPrefs): string {
  return JSON.stringify({
    placeName: prefs.placeName,
    time: prefs.time,
    timeKnown: prefs.timeKnown,
    title: prefs.title.slice(0, MAX_TITLE_LENGTH),
  });
}

/**
 * Eski biçimde koordinat bulunursa kayıt HEMEN koordinatsız yeniden yazılır: iz, kullanıcı 4. adıma varana kadar
 * (belki hiç) diskte ve yedekte kalmasın. Yazma başarısızsa kayıt silinmeyi dener; ikisi de olmazsa akış sürer.
 */
export async function loadSkyPrefs(): Promise<SkyPrefs> {
  try {
    const { prefs, legacy } = parseRecord(await safeStorage.getItem(SKY_PREFS_KEY));
    if (legacy) {
      try {
        await safeStorage.setItem(SKY_PREFS_KEY, serializeSkyPrefs(prefs));
      } catch {
        try {
          await safeStorage.removeItem(SKY_PREFS_KEY);
        } catch {
          // yok say
        }
      }
    }
    return prefs;
  } catch {
    return EMPTY_SKY_PREFS;
  }
}

/** Başarısızlık sessizdir: tercih kaydı akışı bozmaz. Yer adı asla loglanmaz. */
export async function saveSkyPrefs(prefs: SkyPrefs): Promise<void> {
  try {
    await safeStorage.setItem(SKY_PREFS_KEY, serializeSkyPrefs(prefs));
  } catch {
    // yok say
  }
}
