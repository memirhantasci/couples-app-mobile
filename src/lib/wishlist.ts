import { seeded } from "@/lib/seededRandom";

/**
 * Ortak liste ("Birlikte Yapacaklarımız") saf mantığı: limit, bölümlere ayırma, sıralama, rastgele seçim.
 * Plan ve sözleşme: docs/ORTAK_LISTE_PLANI.md. React ve ağ bağımlılığı yoktur.
 */

/** Ücretsiz açık madde sınırı. Sunucudaki wishlist_free_limit() ile aynı olmalı. */
export const WISHLIST_FREE_LIMIT = 15;
/** Premium'da teknik üst sınır (sınırsız sayılır, ama tablo korunur). */
export const WISHLIST_PREMIUM_LIMIT = 300;
export const WISHLIST_TITLE_MAX = 80;
export const WISHLIST_NOTE_MAX = 300;

export const WISHLIST_CATEGORIES = ["place", "film", "food", "experience", "travel", "other"] as const;
export type WishlistCategory = (typeof WISHLIST_CATEGORIES)[number];
export type WishlistStatus = "open" | "done";

export interface WishlistItem {
  id: number;
  couple_id: number;
  created_by: string;
  title: string;
  note: string | null;
  category: WishlistCategory;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  status: WishlistStatus;
  done_at: string | null;
  done_by: string | null;
  created_at: string;
  updated_at: string;
  /** 💗 veren kullanıcıların kimlikleri (couple_wishlist_wants) */
  wants: string[];
}

export function isWishlistCategory(value: unknown): value is WishlistCategory {
  return typeof value === "string" && (WISHLIST_CATEGORIES as readonly string[]).includes(value);
}

/** Sunucudan bilinmeyen bir kategori gelirse (ileride eklenmiş olabilir) "Diğer" sayılır. */
export function normalizeWishlistCategory(value: unknown): WishlistCategory {
  return isWishlistCategory(value) ? value : "other";
}

export interface WishlistQuota {
  openCount: number;
  limit: number;
  reached: boolean;
  /** Sayaç ("7/15") yalnızca ücretsizde görünür */
  showCounter: boolean;
  /** Sayaçta gösterilen sayı: sınırı aşmaz (Premium bitince 22 açık madde kalmış olabilir; "22/15" değil "15/15") */
  shownCount: number;
}

/** Yapılanlar sayıya girmez. İstemci yalnızca önceden uyarır; asıl sınırı sunucu zorlar. */
export function getWishlistQuota(items: readonly WishlistItem[], isPremium: boolean): WishlistQuota {
  const openCount = items.filter((item) => item.status === "open").length;
  const limit = isPremium ? WISHLIST_PREMIUM_LIMIT : WISHLIST_FREE_LIMIT;
  return {
    openCount,
    limit,
    reached: openCount >= limit,
    showCounter: !isPremium,
    shownCount: Math.min(openCount, limit),
  };
}

/** Hem ben hem partner 💗 vermiş mi. Tek kalanda (partner yok) hiçbir madde "ikimiz de" sayılmaz. */
export function isBothWant(item: WishlistItem, userId: string | null, isPaired: boolean): boolean {
  if (!isPaired || !userId) return false;
  return item.wants.includes(userId) && item.wants.some((id) => id !== userId);
}

const byNewest = (a: WishlistItem, b: WishlistItem) =>
  b.created_at.localeCompare(a.created_at) || b.id - a.id;

const byDoneNewest = (a: WishlistItem, b: WishlistItem) =>
  (b.done_at ?? "").localeCompare(a.done_at ?? "") || b.id - a.id;

export interface WishlistSections {
  /** İkisinin de istediği açık maddeler */
  bothWant: WishlistItem[];
  /** Kalan açık maddeler ("ikimiz de" bölümündekiler burada tekrar edilmez) */
  open: WishlistItem[];
  done: WishlistItem[];
}

export function splitWishlist(
  items: readonly WishlistItem[],
  userId: string | null,
  isPaired: boolean
): WishlistSections {
  const bothWant: WishlistItem[] = [];
  const open: WishlistItem[] = [];
  const done: WishlistItem[] = [];
  for (const item of items) {
    if (item.status === "done") done.push(item);
    else if (isBothWant(item, userId, isPaired)) bothWant.push(item);
    else open.push(item);
  }
  return { bothWant: bothWant.sort(byNewest), open: open.sort(byNewest), done: done.sort(byDoneNewest) };
}

// ────────────────────────────────────────────────────────────────────────────
// Okuma: açıklar ayrı (tamamı), yapılanlar ayrı (sayfalı, kategoriye göre). Veri katmanı: wishlistData.ts
// ────────────────────────────────────────────────────────────────────────────

/**
 * Açık maddeler tek sorguda gelir, en çok Premium üst sınırı kadar. Sunucu sınırı kişi başına saydığı için taşınan
 * eski maddeleri olan biri nadiren daha fazlasını görebilir; o durumda en eskiler okunmaz (wishlistData.ts).
 */
export const WISHLIST_OPEN_FETCH_LIMIT = WISHLIST_PREMIUM_LIMIT;
export const WISHLIST_DONE_PAGE_SIZE = 30;

export interface WishlistDonePage {
  items: WishlistItem[];
  /** Seçili kategorideki (yoksa tümü) yapılanların toplam sayısı */
  total: number;
  offset: number;
}

/** Açık maddeler, en yeniden eskiye (sunucu sorgusunun sırası). */
export function openWishlistItems(items: readonly WishlistItem[]): WishlistItem[] {
  return items.filter((item) => item.status === "open").sort(byNewest);
}

/** Yapılanlardan bir sayfa: kategoriye göre süzülmüş, yapılma tarihine göre en yeniden eskiye. */
export function pageDoneItems(
  items: readonly WishlistItem[],
  category: WishlistCategory | null,
  offset: number,
  limit: number
): WishlistDonePage {
  const done = filterByCategory(
    items.filter((item) => item.status === "done"),
    category
  ).sort(byDoneNewest);
  return { items: done.slice(offset, offset + limit), total: done.length, offset };
}

/** Sonraki sayfanın başlangıcı; hepsi yüklendiyse undefined. */
export function nextDoneOffset(pages: readonly WishlistDonePage[]): number | undefined {
  const last = pages[pages.length - 1];
  if (!last) return 0;
  const loaded = last.offset + last.items.length;
  return last.items.length > 0 && loaded < last.total ? loaded : undefined;
}

export interface WishlistDoneCache {
  pages: WishlistDonePage[];
  pageParams: unknown[];
}

/**
 * İyimser güncelleme ve geri alma için TEK maddeyi önbelleklerde yerine koyar (diğer maddelere dokunmaz).
 * `next` null ise madde kaldırılır. Açık listede ve kategorisine uyan yapılanlar önbelleklerinde (kategori null:
 * tümü) bulunuyorsa yerinde değişir; artık ait değilse çıkar, yeni ait olduysa eklenir ve toplam güncellenir.
 */
export function placeOpenItem(
  open: WishlistItem[] | undefined,
  id: number,
  next: WishlistItem | null
): WishlistItem[] | undefined {
  if (!open) return open;
  const belongs = !!next && next.status === "open";
  const index = open.findIndex((item) => item.id === id);
  if (index >= 0) {
    return belongs ? open.map((item) => (item.id === id ? next! : item)) : open.filter((item) => item.id !== id);
  }
  return belongs ? [...open, next!].sort(byNewest) : open;
}

export function placeDoneItem(
  cache: WishlistDoneCache | undefined,
  category: WishlistCategory | null,
  id: number,
  next: WishlistItem | null
): WishlistDoneCache | undefined {
  if (!cache || cache.pages.length === 0) return cache;
  const belongs = !!next && next.status === "done" && (category === null || next.category === category);
  const pageIndex = cache.pages.findIndex((page) => page.items.some((item) => item.id === id));
  const delta = (pageIndex >= 0 ? -1 : 0) + (belongs ? 1 : 0);
  let pages = cache.pages.map((page) => ({ ...page, total: Math.max(0, page.total + delta) }));

  if (pageIndex >= 0 && belongs) {
    pages = pages.map((page, i) =>
      i === pageIndex ? { ...page, items: page.items.map((item) => (item.id === id ? next! : item)) } : page
    );
  } else if (pageIndex >= 0) {
    pages = pages.map((page, i) => (i === pageIndex ? { ...page, items: page.items.filter((item) => item.id !== id) } : page));
  } else if (belongs) {
    pages = pages.map((page, i) => (i === 0 ? { ...page, items: [...page.items, next!].sort(byDoneNewest) } : page));
  }
  return { ...cache, pages };
}

export function filterByCategory<T extends { category: WishlistCategory }>(
  items: readonly T[],
  category: WishlistCategory | null
): T[] {
  return category ? items.filter((item) => item.category === category) : [...items];
}

export interface WishlistPick {
  item: WishlistItem;
  /** "both": ikisinin de istediklerinden; "open": tüm açık maddelerden */
  source: "both" | "open";
  /** Seçimin yapıldığı havuzun boyutu: 1 ise "Başka bir tane" anlamsızdır */
  poolSize: number;
}

export interface PickOptions {
  isPaired: boolean;
  /** Seçili kategori filtresi: düğme filtrenin altında durur, seçim de ona uyar */
  category?: WishlistCategory | null;
  /** "Başka bir tane" derken aynı maddeyi yeniden vermemek için */
  excludeId?: number | null;
  /** Aynı tohum aynı sonucu verir (test için); verilmezse gerçekten rastgeledir */
  seed?: number;
}

/** İkisinin de istediklerinden rastgele seçer; hiç yoksa tüm açık maddelerden. Seçilecek yoksa null. */
export function pickWishlistItem(
  items: readonly WishlistItem[],
  userId: string | null,
  options: PickOptions
): WishlistPick | null {
  const { isPaired, category = null, excludeId = null, seed = Math.random() * 1_000_000 } = options;
  const openItems = filterByCategory(
    items.filter((item) => item.status === "open"),
    category
  );
  const bothPool = openItems.filter((item) => isBothWant(item, userId, isPaired));
  const source = bothPool.length > 0 ? "both" : "open";
  const pool = (source === "both" ? bothPool : openItems).sort((a, b) => a.id - b.id);
  if (pool.length === 0) return null;

  const candidates = pool.length > 1 ? pool.filter((item) => item.id !== excludeId) : pool;
  const index = Math.min(Math.floor(seeded(seed, 7) * candidates.length), candidates.length - 1);
  return { item: candidates[index], source, poolSize: pool.length };
}

// ────────────────────────────────────────────────────────────────────────────
// Ekranın bölümleri: tek yerde, saf (wishlist.tsx yalnızca bunu çizer)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Geçerli kategori filtresi: hiç açık madde yokken filtre çipleri görünmez, seçili kalmış bir kategori de
 * uygulanmaz (boş durum ve yapılanlar tüm kategorilerle hesaplanır). Yapılanlar sorgusu da bunu kullanır.
 */
export function activeWishlistFilter(
  openItems: readonly WishlistItem[],
  filter: WishlistCategory | null
): WishlistCategory | null {
  return openItems.length > 0 ? filter : null;
}

export interface WishlistViewInput {
  /** Açık maddelerin tamamı (süzülmemiş) */
  openItems: readonly WishlistItem[];
  /** Geçerli filtredeki yapılanların toplamı (sunucu sayımı) */
  doneTotal: number;
  userId: string | null;
  isPaired: boolean;
  /** Kullanıcının seçtiği kategori; geçerlisi activeWishlistFilter ile bulunur */
  filter: WishlistCategory | null;
}

export interface WishlistView {
  filter: WishlistCategory | null;
  /** "İkimiz de istiyoruz" (seçili kategoride); boşsa bölüm çizilmez */
  bothWant: WishlistItem[];
  /** Kalan açık maddeler (seçili kategoride) */
  open: WishlistItem[];
  showFilterChips: boolean;
  /** "AÇIK FİKİRLER" bölümü: filtre yokken yalnızca içinde madde varsa */
  showOpenSection: boolean;
  /** "Bu kategoride başka fikir yok": yalnızca filtre seçiliyken */
  showFilteredEmpty: boolean;
  /** Hiç açık madde yokken: hiç madde yoksa "empty", yalnızca yapılanlar varsa "allDone" */
  emptyState: "empty" | "allDone" | null;
  /** 🎲 düğmesi ve alt yazısının kaynağı (seçili kategoride) */
  canPick: boolean;
  pickSource: "both" | "open";
  /** "Yaptıklarımız (n)" (seçili kategoride); 0 ise bölüm çizilmez */
  doneCount: number;
  showDoneSection: boolean;
}

/**
 * Ekran gövdesinin durumu. Açık madde VARSA yalnızca açık maddeler sorgusuna bağlıdır: yapılanlar sorgusunun
 * yüklenmesi, hatası ya da çevrimdışı beklemesi açık listeyi ve çipleri gizlemez ("Yaptıklarımız" bölümü kendi
 * durumunu gösterir).
 *
 * Açık madde YOKSA ekranın söyleyeceği şey ("Listeniz henüz boş" + hazır fikirler mi, "Hepsini yaptınız" mı)
 * yapılanlara bağlıdır. Yapılanlardan hiç veri yokken boş durum gösterilmez: ilk yükleme sürüyorsa iskelet,
 * çevrimdışı bekliyorsa çevrimdışı, hata verdiyse hata durumu. (Gizlenen bir açık liste ya da çip yoktur.)
 */
export function wishlistBodyState(state: {
  isLoaded: boolean;
  isError: boolean;
  isPaused: boolean;
  /** Açık maddeler (yüklendiyse) */
  openItems?: readonly unknown[];
  /** Yapılanlar sorgusunun durumu (useWishlist().done) */
  done?: { isInitialLoading: boolean; isError: boolean; isPaused: boolean };
}): "ready" | "loading" | "offline" | "error" {
  if (!state.isLoaded) {
    if (state.isPaused) return "offline";
    if (state.isError) return "error";
    return "loading";
  }
  const hasOpen = (state.openItems?.length ?? 0) > 0;
  if (!hasOpen && state.done) {
    // Yalnızca yapılanlardan HİÇ veri yokken: önceki sayfalar (kategori değişimi) görünüyorsa durum biliniyor sayılır
    if (state.done.isError) return "error";
    if (state.done.isInitialLoading) return state.done.isPaused ? "offline" : "loading";
  }
  return "ready";
}

/** Karar (a): kategori filtresi her şeye uygulanır: "İkimiz de", 🎲, açıklar ve "Yaptıklarımız (n)". */
export function buildWishlistView(input: WishlistViewInput): WishlistView {
  const { openItems, doneTotal, userId, isPaired } = input;
  const hasAnyOpen = openItems.length > 0;
  const filter = activeWishlistFilter(openItems, input.filter);
  const split = splitWishlist(openItems, userId, isPaired);
  const bothWant = filterByCategory(split.bothWant, filter);
  const open = filterByCategory(split.open, filter);

  return {
    filter,
    bothWant,
    open,
    showFilterChips: hasAnyOpen,
    showOpenSection: hasAnyOpen && (filter !== null || open.length > 0),
    showFilteredEmpty: filter !== null && open.length === 0,
    emptyState: hasAnyOpen ? null : doneTotal > 0 ? "allDone" : "empty",
    canPick: bothWant.length + open.length > 0,
    pickSource: bothWant.length > 0 ? "both" : "open",
    doneCount: doneTotal,
    showDoneSection: doneTotal > 0,
  };
}
