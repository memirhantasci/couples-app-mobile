import { safeStorage } from "@/lib/safeStorage";
import { cleanPlaceName, DEFAULT_SKY_TIME, isValidPlace, isValidTime, MAX_TITLE_LENGTH, type SkyPlace } from "./flowLogic";

/** Cihazda tutulan son seçimler. Sunucuya GİTMEZ; çıkışta AuthContext.signOut temizler. */
export const SKY_PREFS_KEY = "@night_sky_prefs";

export interface SkyPrefs {
  place: SkyPlace | null;
  time: string;
  /** Kullanıcı saati hatırlamıyorsa false */
  timeKnown: boolean;
  title: string;
}

export const EMPTY_SKY_PREFS: SkyPrefs = { place: null, time: DEFAULT_SKY_TIME, timeKnown: true, title: "" };

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

  let place: SkyPlace | null = null;
  const rawPlace = record.place;
  if (typeof rawPlace === "object" && rawPlace !== null) {
    const candidate = rawPlace as Record<string, unknown>;
    if (isValidPlace({ latitude: candidate.latitude, longitude: candidate.longitude })) {
      place = {
        latitude: candidate.latitude as number,
        longitude: candidate.longitude as number,
        name: cleanPlaceName(candidate.name),
      };
    }
  }
  return {
    place,
    time: isValidTime(record.time) ? record.time : DEFAULT_SKY_TIME,
    timeKnown: record.timeKnown === false ? false : true,
    title: typeof record.title === "string" ? record.title.slice(0, MAX_TITLE_LENGTH) : "",
  };
}

export function serializeSkyPrefs(prefs: SkyPrefs): string {
  return JSON.stringify({
    place: prefs.place,
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

/** Başarısızlık sessizdir: tercih kaydı akışı bozmaz. Koordinat asla loglanmaz. */
export async function saveSkyPrefs(prefs: SkyPrefs): Promise<void> {
  try {
    await safeStorage.setItem(SKY_PREFS_KEY, serializeSkyPrefs(prefs));
  } catch {
    // yok say
  }
}
