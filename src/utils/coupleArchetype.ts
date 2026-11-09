/**
 * Couple Wrapped "çift tipi": çiftin bu dönemde zaten ürettiği verilerden (mektup, not, fotoğraf, buluşma ve
 * paylaşımların saati) tek bir tip çıkarır. Yeni veri toplanmaz, sunucuya dokunulmaz; yalnızca sayılar ve
 * saatler okunur, içerik hiç okunmaz. Kural sabit ve açıklanabilir (aynı girdi her zaman aynı tipi verir).
 */

export type ArchetypeId =
  | "nightOwls"
  | "earlyBirds"
  | "letterPoets"
  | "memoryHunters"
  | "explorers"
  | "journalists"
  | "starlight";

/** Karttaki/slayttaki "kanıt" satırının türü: hangi veri bu tipi seçtirdi. */
export type ArchetypeEvidenceKey = "night" | "morning" | "letters" | "photos" | "meetings" | "notes" | "none";

export interface ArchetypeInput {
  readonly lettersCount: number;
  readonly dailyNotesCount: number;
  readonly photosCount: number;
  readonly meetingsCount: number;
  readonly moodEntriesCount: number;
  /** Mektup, günlük not ve ruh hali kayıtlarının oluşturulma saatleri (0-23, cihazın yerel saati). */
  readonly entryHours: readonly number[];
}

export interface CoupleArchetype {
  readonly id: ArchetypeId;
  readonly evidence: { readonly key: ArchetypeEvidenceKey; readonly value: number };
}

/** Bundan az toplam kayıtla tip çıkarılmaz; çifte nazik bir başlangıç tipi verilir. */
export const MIN_ARCHETYPE_ACTIVITY = 4;
/** Saat tabanlı tipler için gereken en az saatli kayıt (az veriyle "gece kuşu" demek yanıltıcı olur). */
export const MIN_TIMED_ENTRIES = 8;
/** Saatli kayıtların bu payı gece (ya da sabah) saatlerindeyse saat tabanlı tip kazanır. */
export const TIME_SHARE_THRESHOLD = 0.6;
/** Buluşma nadir ve emek isteyen bir eylemdir: bir buluşma üç mektup/not/fotoğraf kadar sayılır. */
export const MEETING_WEIGHT = 3;

/** Eşitlikte bu sıra geçerlidir. */
const CONTENT_ORDER = ["letterPoets", "memoryHunters", "explorers", "journalists"] as const;

/** Gece: 22:00-04:59. */
export function isNightHour(hour: number): boolean {
  return hour >= 22 || hour < 5;
}

/** Sabah: 05:00-09:59. */
export function isMorningHour(hour: number): boolean {
  return hour >= 5 && hour < 10;
}

function validHours(hours: readonly number[]): number[] {
  return hours.filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23);
}

/**
 * Kural (sırayla):
 * 1. Toplam kayıt {@link MIN_ARCHETYPE_ACTIVITY}'den azsa → "starlight".
 * 2. Yeterli saatli kayıt varsa ve %60'ı gece ise "nightOwls", sabah ise "earlyBirds".
 * 3. Aksi halde ağırlıklı içerik payı en yüksek olan: letterPoets (mektup), memoryHunters (fotoğraf),
 *    explorers (buluşma ×3), journalists (günlük not). Eşitlikte sabit sıra; hepsi 0 ise "starlight".
 */
export function computeCoupleArchetype(input: ArchetypeInput): CoupleArchetype {
  const letters = Math.max(0, input.lettersCount);
  const notes = Math.max(0, input.dailyNotesCount);
  const photos = Math.max(0, input.photosCount);
  const meetings = Math.max(0, input.meetingsCount);
  const moods = Math.max(0, input.moodEntriesCount);

  if (letters + notes + photos + meetings + moods < MIN_ARCHETYPE_ACTIVITY) {
    return { id: "starlight", evidence: { key: "none", value: 0 } };
  }

  const hours = validHours(input.entryHours);
  if (hours.length >= MIN_TIMED_ENTRIES) {
    const nightShare = hours.filter(isNightHour).length / hours.length;
    if (nightShare >= TIME_SHARE_THRESHOLD) {
      return { id: "nightOwls", evidence: { key: "night", value: Math.round(nightShare * 100) } };
    }
    const morningShare = hours.filter(isMorningHour).length / hours.length;
    if (morningShare >= TIME_SHARE_THRESHOLD) {
      return { id: "earlyBirds", evidence: { key: "morning", value: Math.round(morningShare * 100) } };
    }
  }

  const scores = {
    letterPoets: letters,
    memoryHunters: photos,
    explorers: meetings * MEETING_WEIGHT,
    journalists: notes,
  } as const;
  const evidence = {
    letterPoets: { key: "letters", value: letters },
    memoryHunters: { key: "photos", value: photos },
    explorers: { key: "meetings", value: meetings },
    journalists: { key: "notes", value: notes },
  } as const;

  let winner: (typeof CONTENT_ORDER)[number] | null = null;
  let best = 0;
  for (const id of CONTENT_ORDER) {
    if (scores[id] > best) {
      best = scores[id];
      winner = id;
    }
  }

  return winner ? { id: winner, evidence: evidence[winner] } : { id: "starlight", evidence: { key: "none", value: 0 } };
}

/** Tipin simgesi (dil bağımsız). */
export const ARCHETYPE_EMOJI: Record<ArchetypeId, string> = {
  nightOwls: "🌙",
  earlyBirds: "🌅",
  letterPoets: "💌",
  memoryHunters: "📸",
  explorers: "🧭",
  journalists: "📔",
  starlight: "✨",
};
