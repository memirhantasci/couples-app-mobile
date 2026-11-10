import {
  WISHLIST_FREE_LIMIT,
  WISHLIST_PREMIUM_LIMIT,
  openWishlistItems,
  pageDoneItems,
  type WishlistCategory,
  type WishlistDonePage,
  type WishlistItem,
} from "@/lib/wishlist";
import { WISHLIST_WRITE_DENIED } from "@/lib/wishlistErrors";

/**
 * Sunucu (Faz 1A) hazır olana kadar veri katmanını besleyen bellek içi sahte arka uç. Uygulama kapanınca sıfırlanır.
 * 1A yayınlanınca wishlistAvailability.ts'te bayrak açılır, bu dosya silinir.
 *
 * Sunucu sözleşmesini taklit eder: açık maddeler ve yapılanlar ayrı okunur; sınır dolunca ekleme ve "yaptık"ı geri
 * alma P0022 (WISHLIST_LIMIT) verir; yalnızca ekleyen düzenler/siler (değilse WISHLIST_WRITE_DENIED, 0 satır);
 * görünmeyen maddeye RPC 42501 verir; "yaptık" zaten yapılmış maddeye dokunmaz (20261109000003).
 */

const LATENCY_MS = 120;

let store: WishlistItem[] = [];
let nextId = 1;
let failReads = false;
let premium = false;

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS));
const copy = (item: WishlistItem): WishlistItem => ({ ...item, wants: [...item.wants] });

/** Sunucudaki hata nesneleriyle aynı biçim (PostgREST: code + message) */
const serverError = (code: string, message: string) => Object.assign(new Error(message), { code });

function findVisible(id: number): WishlistItem {
  const item = store.find((row) => row.id === id);
  if (!item) throw serverError("42501", "Madde bulunamadı veya yetkiniz yok.");
  return item;
}

function assertCapacity(coupleId: number): void {
  const open = store.filter((row) => row.couple_id === coupleId && row.status === "open").length;
  if (open >= (premium ? WISHLIST_PREMIUM_LIMIT : WISHLIST_FREE_LIMIT)) throw serverError("P0022", "WISHLIST_LIMIT");
}

function assertCreator(id: number, userId: string): WishlistItem {
  // Sunucuda RLS satırı göstermez: 0 satır döner, veri katmanı bunu WISHLIST_WRITE_DENIED'a çevirir
  const item = store.find((row) => row.id === id);
  if (!item || item.created_by !== userId) throw new Error(WISHLIST_WRITE_DENIED);
  return item;
}

export const wishlistMock = {
  async listOpen(coupleId: number): Promise<WishlistItem[]> {
    await wait();
    if (failReads) throw new Error("WISHLIST_MOCK_READ_FAILED");
    return openWishlistItems(store.filter((row) => row.couple_id === coupleId)).map(copy);
  },

  async listDone(
    coupleId: number,
    options: { category: WishlistCategory | null; offset: number; limit: number }
  ): Promise<WishlistDonePage> {
    await wait();
    if (failReads) throw new Error("WISHLIST_MOCK_READ_FAILED");
    const page = pageDoneItems(
      store.filter((row) => row.couple_id === coupleId),
      options.category,
      options.offset,
      options.limit
    );
    return { ...page, items: page.items.map(copy) };
  },

  async add(input: { coupleId: number; userId: string; title: string; category: WishlistCategory }): Promise<void> {
    await wait();
    assertCapacity(input.coupleId);
    const now = new Date().toISOString();
    store.push({
      id: nextId++,
      couple_id: input.coupleId,
      created_by: input.userId,
      title: input.title,
      note: null,
      category: input.category,
      location_name: null,
      latitude: null,
      longitude: null,
      status: "open",
      done_at: null,
      done_by: null,
      created_at: now,
      updated_at: now,
      wants: [input.userId],
    });
  },

  async update(id: number, userId: string, patch: Partial<WishlistItem>): Promise<void> {
    await wait();
    Object.assign(assertCreator(id, userId), patch, { updated_at: new Date().toISOString() });
  },

  async remove(id: number, userId: string): Promise<void> {
    await wait();
    assertCreator(id, userId);
    store = store.filter((row) => row.id !== id);
  },

  async setWant(id: number, userId: string, want: boolean): Promise<void> {
    await wait();
    const item = findVisible(id);
    item.wants = want ? [...new Set([...item.wants, userId])] : item.wants.filter((other) => other !== userId);
  },

  async setDone(id: number, userId: string, done: boolean): Promise<void> {
    await wait();
    const item = findVisible(id);
    if (done) {
      // Zaten yapılmışsa ilk "yaptık" (tarih ve kişi) korunur
      if (item.status !== "open") return;
      item.status = "done";
      item.done_at = new Date().toISOString();
      item.done_by = userId;
      return;
    }
    if (item.status !== "done") return;
    assertCapacity(item.couple_id);
    item.status = "open";
    item.done_at = null;
    item.done_by = null;
  },

  /** Doğrulama senaryoları için: listeyi verilen maddelerle değiştirir. */
  seed(items: WishlistItem[], options?: { failReads?: boolean; premium?: boolean }): void {
    store = items.map(copy);
    nextId = store.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    failReads = options?.failReads ?? false;
    premium = options?.premium ?? false;
  },

  /** Testler için: depodaki maddelerin kopyası. */
  snapshot(): WishlistItem[] {
    return store.map(copy);
  },
};
