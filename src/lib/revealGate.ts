import { safeStorage } from "@/lib/safeStorage";
import { getFirstArrivalBird } from "@/lib/letterArrival";

// ─── Kart Girişi Kapısı ──────────────────────────────────────────────────────
// Kartlar (Reveal) yalnızca bir ekran bu soğuk açılışta ilk kez çizilirken süzülerek girer: ekranın
// "merhaba"sı. Aynı ekranda sonradan çizilen kartlar (mektup sekmesinde Tümü / Gelen / Giden, ilaçta
// Benim / Sevgilimin, yenileme, liste kaydırma) animasyonsuz belirir; sürekli sallanmaz.
// Durum yalnızca bu JS oturumunda tutulur: soğuk açılış her şeyi sıfırlar.
//
// Ana sayfa iki durumda hiç oynatmaz:
//  • İlk kurulumda: ana sayfa tanıtım turuyla açılır; hareket turun dikkatine ve hedef ölçümüne karışmasın.
//  • Mektup kuşu uçacaksa: karşılama kendi başına bir andır. Kuşun uçup uçmayacağı açılışta erken
//    sorgulanır (bkz. LetterArrivalHost); sonuç kartlar çizilmeden hazırsa buna bakılır.

/** Ekranın ilk kartından sonra, aynı ekranın diğer kartlarının ("kademeli giriş") hâlâ oynayabildiği süre. */
const REVEAL_WINDOW_MS = 700;

const HOME_SEEN_KEY = "@home_reveal_seen_v1";
/** null: henüz okunmadı. Okunamazsa ya da okunmadan ana sayfa çizilirse ilk kurulum sayılmaz. */
let homeSeenBefore: boolean | null = null;

safeStorage
  .getItem(HOME_SEEN_KEY)
  .then((value) => {
    homeSeenBefore = value === "1";
  })
  .catch(() => {
    homeSeenBefore = true;
  });

interface ScopeEntry {
  /** Ekranın ilk kartının çizildiği an */
  at: number;
  /** Bu ekran için giriş animasyonu oynatılıyor mu */
  play: boolean;
}

const scopes = new Map<string, ScopeEntry>();

/** Ekranın ilk çiziminde bir kez karar verilir; ana sayfa için ilk kurulum ve mektup kuşu hesaba katılır. */
function decide(scope: string): boolean {
  if (scope !== "home") return true;

  const firstInstall = homeSeenBefore === false;
  safeStorage.setItem(HOME_SEEN_KEY, "1").catch(() => {});
  if (firstInstall) return false;

  return getFirstArrivalBird() !== true;
}

/**
 * `scope` ekranının bir kartı çiziliyor: giriş animasyonu oynasın mı? Ekranın ilk kartı kararı verir,
 * kısa süre içinde gelen kardeş kartlar aynı kararı izler; sonradan çizilen kartlar animasyonsuz gelir.
 */
export function shouldReveal(scope: string, now: number = Date.now()): boolean {
  const entry = scopes.get(scope);
  if (!entry) {
    const play = decide(scope);
    scopes.set(scope, { at: now, play });
    return play;
  }
  return entry.play && now - entry.at < REVEAL_WINDOW_MS;
}
