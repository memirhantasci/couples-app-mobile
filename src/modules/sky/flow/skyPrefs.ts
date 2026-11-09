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

/** Bozuk, eksik ya da yabancı biçimli kayıt güvenle varsayılana döner; alan alan doğrulanır. */
export function parseSkyPrefs(raw: string | null): SkyPrefs {
  if (!raw) return EMPTY_SKY_PREFS;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return EMPTY_SKY_PREFS;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return EMPTY_SKY_PREFS;
  const record = data as Record<string, unknown>;

  return {
    placeName: cleanPlaceName(record.placeName),
    time: isValidTime(record.time) ? record.time : DEFAULT_SKY_TIME,
    timeKnown: record.timeKnown === false ? false : true,
    title: typeof record.title === "string" ? record.title.slice(0, MAX_TITLE_LENGTH) : "",
  };
}

export function serializeSkyPrefs(prefs: SkyPrefs): string {
  return JSON.stringify({
    placeName: prefs.placeName,
    time: prefs.time,
    timeKnown: prefs.timeKnown,
    title: prefs.title.slice(0, MAX_TITLE_LENGTH),
  });
}

export async function loadSkyPrefs(): Promise<SkyPrefs> {
  try {
    return parseSkyPrefs(await safeStorage.getItem(SKY_PREFS_KEY));
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
