import { safeStorage } from "@/lib/safeStorage";

// ─── Kırılmış Mühür Hafızası ─────────────────────────────────────────────────
// Gelen bir mektubun mum mührü yalnızca ilk açılışta kırılır; sonraki açılışlarda mektup doğrudan
// açık kâğıtla gelir. Veritabanında mektubun açıldığı an tutulmadığından hafıza bu cihazdadır.
// Okuma penceresi fazını ilk karede bilmek zorunda olduğu için liste ekranı açılırken
// (bkz. preloadBrokenSeals) önbelleğe alınır ve senkron okunur.

const STORAGE_KEY = "@letters_broken_seals";
/** Saklanan en fazla kimlik sayısı: en eskiler düşer. */
const MAX_REMEMBERED = 500;

let cache: number[] | null = null;
let loading: Promise<number[]> | null = null;

function load(): Promise<number[]> {
  if (cache) return Promise.resolve(cache);
  if (!loading) {
    loading = safeStorage
      .getItem(STORAGE_KEY)
      .then((raw) => {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === "number") : [];
      })
      .catch(() => [])
      .then((ids) => {
        cache = ids;
        return ids;
      });
  }
  return loading;
}

/** Liste ekranı açılırken çağrılır: okuma penceresi açıldığında hafıza hazır olur. */
export function preloadBrokenSeals(): void {
  load();
}

/** Önbellek hazırsa senkron cevap verir; henüz yüklenmediyse `null`. */
export function isSealBrokenCached(letterId: number): boolean | null {
  return cache ? cache.includes(letterId) : null;
}

export async function isSealBroken(letterId: number): Promise<boolean> {
  return (await load()).includes(letterId);
}

export async function rememberBrokenSeal(letterId: number): Promise<void> {
  const ids = await load();
  if (ids.includes(letterId)) return;
  cache = [...ids, letterId].slice(-MAX_REMEMBERED);
  await safeStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}
