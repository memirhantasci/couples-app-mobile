import { safeStorage } from "@/lib/safeStorage";
import { waitForFirstArrivalCheck } from "@/lib/letterArrival";
import { hapticTap } from "@/lib/soundEffects";

// ─── Sekme Selamı ────────────────────────────────────────────────────────────
// Alt çubukta sekmeler arasında gezinirken her geçişte titreşim rahatsız eder. Bunun yerine her ana sekme,
// uygulama açıldıktan sonra ilk görüldüğünde tek bir hafif "merhaba" titreşimi verir; aynı sekmeye sonraki
// geçişlerde titreşim olmaz. Durum yalnızca bu JS oturumunda tutulur: soğuk açılış her şeyi sıfırlar.
//
// Ana sayfa iki durumda sessiz kalır:
//  • İlk kurulumda: ana sayfa tanıtım turuyla açılır ve titreşimin ne olduğu anlatılmamıştır.
//  • Mektup kuşu uçacaksa: karşılama kendi başına bir andır, üstüne titreşim binmesin. Kuşun uçup uçmayacağı
//    ilk kontrol bitince belli olur; selam o zamana kadar bekler.

const HOME_HELLO_SEEN_KEY = "@haptic_home_hello_seen_v1";
/** Kuş kontrolü hiç çalışmıyorsa (misafir, eşleşme yok) ana sayfa selamı en fazla bu kadar bekler. */
const HOME_BIRD_WAIT_MS = 4000;

const greeted = new Set<string>();
// Ana sayfa kararı oturumda bir kez verilir: ilk kurulum bayrağı bir kez yazılır, ana sayfaya sonraki
// dönüşlerde aynı karar geçerli kalır
let homeDecision: Promise<boolean> | null = null;

const noop = () => {};

async function shouldGreetHome(): Promise<boolean> {
  let seenBefore = true;
  try {
    seenBefore = (await safeStorage.getItem(HOME_HELLO_SEEN_KEY)) === "1";
    if (!seenBefore) await safeStorage.setItem(HOME_HELLO_SEEN_KEY, "1");
  } catch {
    // Depo okunamazsa ilk kurulum sayılmaz
  }
  if (!seenBefore) return false;
  return !(await waitForFirstArrivalCheck(HOME_BIRD_WAIT_MS));
}

/**
 * `routeName` sekmesi odağa geldi: bu oturumda ilk kez görülüyorsa tek bir hafif titreşim verir.
 * Dönen fonksiyon, selam henüz verilmeden sekmeden ayrılınca (ana sayfa kuş kontrolünü beklerken)
 * çağrılır; selam o zaman verilmez, sekmeye sonraki dönüşte verilir.
 */
export function greetTab(routeName: string): () => void {
  if (greeted.has(routeName)) return noop;

  if (routeName !== "home") {
    greeted.add(routeName);
    hapticTap();
    return noop;
  }

  let cancelled = false;
  if (!homeDecision) homeDecision = shouldGreetHome();
  homeDecision.then((greet) => {
    if (!greet) {
      greeted.add("home");
      return;
    }
    if (cancelled || greeted.has("home")) return;
    greeted.add("home");
    hapticTap();
  });
  return () => {
    cancelled = true;
  };
}
