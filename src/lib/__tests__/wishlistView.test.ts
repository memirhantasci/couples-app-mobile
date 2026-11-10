/// <reference types="jest" />
import {
  WISHLIST_DONE_PAGE_SIZE,
  WISHLIST_FREE_LIMIT,
  WISHLIST_OPEN_FETCH_LIMIT,
  WISHLIST_PREMIUM_LIMIT,
  activeWishlistFilter,
  buildWishlistView,
  getWishlistQuota,
  nextDoneOffset,
  openWishlistItems,
  pageDoneItems,
  placeDoneItem,
  placeOpenItem,
  wishlistBodyState,
  type WishlistDoneCache,
  type WishlistItem,
} from "../wishlist";
import { wishlistMock } from "../wishlistMock";

jest.mock("@/lib/i18n", () => ({ __esModule: true, default: { language: "tr", t: (key: string) => key } }));

const ME = "user-me";
const PARTNER = "user-partner";

let nextId = 1;
function makeItem(overrides: Partial<WishlistItem> = {}): WishlistItem {
  const id = overrides.id ?? nextId++;
  return {
    id,
    couple_id: 1,
    created_by: ME,
    title: `Madde ${id}`,
    note: null,
    category: "other",
    location_name: null,
    latitude: null,
    longitude: null,
    status: "open",
    done_at: null,
    done_by: null,
    created_at: new Date(Date.UTC(2026, 0, 1) + id * 60_000).toISOString(),
    updated_at: "2026-01-01T10:00:00.000Z",
    wants: [ME],
    ...overrides,
  };
}
const both = (overrides: Partial<WishlistItem> = {}) => makeItem({ wants: [ME, PARTNER], ...overrides });
const done = (overrides: Partial<WishlistItem> = {}) => {
  const item = makeItem({ status: "done", done_by: PARTNER, ...overrides });
  return { ...item, done_at: overrides.done_at ?? new Date(Date.UTC(2026, 2, 1) + item.id * 60_000).toISOString() };
};
const ids = (items: readonly WishlistItem[]) => items.map((item) => item.id);
const view = (openItems: WishlistItem[], doneTotal: number, filter: WishlistItem["category"] | null = null) =>
  buildWishlistView({ openItems, doneTotal, userId: ME, isPaired: true, filter });

beforeEach(() => {
  nextId = 1;
});

describe("okuma sınırları", () => {
  it("açık madde okuma sınırı Premium üst sınırıyla aynı, yapılanlar 30'ar", () => {
    expect(WISHLIST_OPEN_FETCH_LIMIT).toBe(WISHLIST_PREMIUM_LIMIT);
    expect(WISHLIST_DONE_PAGE_SIZE).toBe(30);
  });

  it("açıklar yapılanlardan ayrı okunur, en yeniden eskiye", () => {
    const items = [makeItem({ id: 1 }), done({ id: 2 }), makeItem({ id: 3 })];
    expect(ids(openWishlistItems(items))).toEqual([3, 1]);
  });
});

describe("pageDoneItems ve nextDoneOffset", () => {
  const many = () => Array.from({ length: 65 }, (_, i) => done({ id: i + 1, category: i % 2 ? "film" : "food" }));

  it("yapılanları yapılma tarihine göre sayfalar, toplamı verir", () => {
    const first = pageDoneItems(many(), null, 0, 30);
    expect(first.total).toBe(65);
    expect(first.items).toHaveLength(30);
    expect(first.items[0].id).toBe(65);
    const last = pageDoneItems(many(), null, 60, 30);
    expect(ids(last.items)).toEqual([5, 4, 3, 2, 1]);
  });

  it("kategoriye göre süzer ve toplamı o kategoride sayar", () => {
    const films = pageDoneItems(many(), "film", 0, 30);
    expect(films.total).toBe(32);
    expect(films.items.every((item) => item.category === "film")).toBe(true);
  });

  it("açık maddeleri asla yapılan sayfasına koymaz", () => {
    expect(pageDoneItems([makeItem(), makeItem()], null, 0, 30)).toEqual({ items: [], total: 0, offset: 0 });
  });

  it("sonraki sayfa yüklenen sayıdan başlar; hepsi yüklendiyse durur", () => {
    const items = many();
    const p1 = pageDoneItems(items, null, 0, 30);
    expect(nextDoneOffset([p1])).toBe(30);
    const p2 = pageDoneItems(items, null, 30, 30);
    const p3 = pageDoneItems(items, null, 60, 30);
    expect(nextDoneOffset([p1, p2])).toBe(60);
    expect(nextDoneOffset([p1, p2, p3])).toBeUndefined();
    expect(nextDoneOffset([pageDoneItems([], null, 0, 30)])).toBeUndefined();
  });
});

describe("bulgu 5/11: yapılanlar biriktikçe açıklar kaybolmaz", () => {
  it("400 yapılan + 10 açık: açıkların hepsi gelir, sayaç ve boş durum doğru", async () => {
    const items = [
      ...Array.from({ length: 400 }, (_, i) => done({ id: i + 1, couple_id: 7 })),
      ...Array.from({ length: 10 }, (_, i) => makeItem({ id: 1000 + i, couple_id: 7 })),
    ];
    wishlistMock.seed(items);
    const open = await wishlistMock.listOpen(7);
    const firstDone = await wishlistMock.listDone(7, { category: null, offset: 0, limit: WISHLIST_DONE_PAGE_SIZE });

    expect(open).toHaveLength(10);
    expect(firstDone.items).toHaveLength(30);
    expect(firstDone.total).toBe(400);
    expect(getWishlistQuota(open, false)).toMatchObject({ openCount: 10, reached: false });

    const v = view(open, firstDone.total);
    expect(v.emptyState).toBeNull();
    expect(v.doneCount).toBe(400);
    expect(v.canPick).toBe(true);
  });

  it("15 açık + 300'den fazla yapılan: ücretsiz sınır doğru dolu görünür", async () => {
    wishlistMock.seed([
      ...Array.from({ length: 320 }, (_, i) => done({ id: i + 1, couple_id: 8 })),
      ...Array.from({ length: WISHLIST_FREE_LIMIT }, (_, i) => makeItem({ id: 1000 + i, couple_id: 8 })),
    ]);
    const open = await wishlistMock.listOpen(8);
    expect(getWishlistQuota(open, false)).toMatchObject({ openCount: 15, reached: true });
  });

  it("hiç açık yok, yalnızca yapılan var: 'hepsini yaptınız'; hiç madde yoksa 'boş'", () => {
    expect(view([], 400).emptyState).toBe("allDone");
    expect(view([], 0).emptyState).toBe("empty");
  });
});

describe("karar (b): sayaç sınırı aşmaz", () => {
  it("22 açık maddede ücretsiz sayaç 15/15 gösterir, sınır dolu", () => {
    const quota = getWishlistQuota(
      Array.from({ length: 22 }, () => makeItem()),
      false
    );
    expect(quota).toMatchObject({ openCount: 22, shownCount: 15, limit: 15, reached: true });
  });

  it("sınırın altında gerçek sayıyı gösterir", () => {
    expect(getWishlistQuota([makeItem(), makeItem()], false).shownCount).toBe(2);
  });
});

describe("buildWishlistView: bölümler (bulgu 9/10) ve karar (a)", () => {
  it("bütün açık maddeler 'ikimiz de' iken filtresiz AÇIK bölümü çizilmez, 'başka fikir yok' yazmaz", () => {
    const v = view([both(), both()], 0);
    expect(v.bothWant).toHaveLength(2);
    expect(v.open).toHaveLength(0);
    expect(v.showOpenSection).toBe(false);
    expect(v.showFilteredEmpty).toBe(false);
  });

  it("filtre seçiliyken o kategoride açık yoksa 'Bu kategoride başka fikir yok' yazar", () => {
    const v = view([makeItem({ category: "film" })], 0, "food");
    expect(v.showOpenSection).toBe(true);
    expect(v.showFilteredEmpty).toBe(true);
  });

  it("filtre 'İkimiz de' bölümüne uygulanır; o kategoride ortak madde yoksa bölüm çizilmez", () => {
    const items = [both({ category: "film" }), makeItem({ category: "food" })];
    expect(view(items, 0, "film").bothWant).toHaveLength(1);
    expect(view(items, 0, "food").bothWant).toHaveLength(0);
    expect(ids(view(items, 0, "food").open)).toEqual([items[1].id]);
  });

  it("🎲 alt yazısı ve kaynağı seçili kategoriye göre", () => {
    const items = [both({ category: "film" }), makeItem({ category: "food" })];
    expect(view(items, 0, null).pickSource).toBe("both");
    expect(view(items, 0, "food").pickSource).toBe("open");
    expect(view(items, 0, "travel").canPick).toBe(false);
  });

  it("'Yaptıklarımız (n)' seçili kategorinin sunucu toplamıdır; 0 ise bölüm yok", () => {
    expect(view([makeItem()], 12, "film")).toMatchObject({ doneCount: 12, showDoneSection: true });
    expect(view([makeItem()], 0, "film")).toMatchObject({ doneCount: 0, showDoneSection: false });
  });

  it("hiç açık madde yokken seçili kalmış filtre uygulanmaz, çipler gizlenir", () => {
    expect(activeWishlistFilter([], "film")).toBeNull();
    expect(activeWishlistFilter([makeItem()], "film")).toBe("film");
    const v = view([], 3, "film");
    expect(v).toMatchObject({ filter: null, showFilterChips: false, showOpenSection: false, emptyState: "allDone" });
  });

  it("tek kalanda 'ikimiz de' yok, hepsi açık bölümde", () => {
    const v = buildWishlistView({ openItems: [both()], doneTotal: 0, userId: ME, isPaired: false, filter: null });
    expect(v.bothWant).toHaveLength(0);
    expect(v.open).toHaveLength(1);
    expect(v.showOpenSection).toBe(true);
  });
});

describe("önbellekte tek madde yerleştirme (iyimser güncelleme / geri alma)", () => {
  const cache = (items: WishlistItem[], total = items.length): WishlistDoneCache => ({
    pages: [{ items, total, offset: 0 }],
    pageParams: [0],
  });

  it("açık listede yerinde değiştirir, diğerlerine dokunmaz", () => {
    const a = makeItem();
    const b = makeItem();
    const next = placeOpenItem([b, a], a.id, { ...a, wants: [ME, PARTNER] })!;
    expect(next[1].wants).toEqual([ME, PARTNER]);
    expect(next[0]).toBe(b);
  });

  it("yapıldı işaretlenen madde açıktan çıkar, kategorisine uyan yapılanlar önbelleğine girer", () => {
    const a = makeItem({ category: "film" });
    const doneA = { ...a, status: "done" as const, done_at: "2027-01-01T00:00:00.000Z", done_by: ME };
    expect(placeOpenItem([a], a.id, doneA)).toEqual([]);

    const all = placeDoneItem(cache([done()]), null, a.id, doneA)!;
    expect(all.pages[0].total).toBe(2);
    expect(all.pages[0].items[0].id).toBe(a.id);
    const films = placeDoneItem(cache([], 0), "film", a.id, doneA)!;
    expect(films.pages[0].total).toBe(1);
    const food = placeDoneItem(cache([], 0), "food", a.id, doneA)!;
    expect(food.pages[0].total).toBe(0);
  });

  it("geri alma maddeyi önceki yerine koyar, toplamı düzeltir", () => {
    const d = done({ category: "film" });
    const reopened = { ...d, status: "open" as const, done_at: null, done_by: null };
    const after = placeDoneItem(cache([d]), null, d.id, reopened)!;
    expect(after.pages[0]).toMatchObject({ items: [], total: 0 });
    const restored = placeDoneItem(after, null, d.id, d)!;
    expect(restored.pages[0]).toMatchObject({ total: 1 });
    expect(restored.pages[0].items[0]).toBe(d);
  });

  it("yüklenmemiş önbelleğe dokunmaz", () => {
    expect(placeOpenItem(undefined, 1, makeItem())).toBeUndefined();
    expect(placeDoneItem(undefined, null, 1, done())).toBeUndefined();
  });
});

describe("wishlistBodyState: açık madde yokken yapılanlar bilinmeden boş durum çıkmaz", () => {
  const loaded = { isLoaded: true, isError: false, isPaused: false };
  const doneOk = { isInitialLoading: false, isError: false, isPaused: false };
  const one = [makeItem()];

  it("açık madde yok, yapılanlar ilk kez yükleniyor: iskelet (boş durum değil)", () => {
    expect(wishlistBodyState({ ...loaded, openItems: [], done: { ...doneOk, isInitialLoading: true } })).toBe("loading");
  });

  it("açık madde yok, yapılanlar çevrimdışı bekliyor: çevrimdışı durumu", () => {
    expect(
      wishlistBodyState({ ...loaded, openItems: [], done: { isInitialLoading: true, isError: false, isPaused: true } })
    ).toBe("offline");
  });

  it("açık madde yok, yapılanlar hata verdi: hata durumu", () => {
    expect(wishlistBodyState({ ...loaded, openItems: [], done: { ...doneOk, isError: true } })).toBe("error");
  });

  it("açık madde yok, yapılanlar geldi: hazır (boş ya da hepsini yaptınız doğru hesaplanır)", () => {
    expect(wishlistBodyState({ ...loaded, openItems: [], done: doneOk })).toBe("ready");
  });

  it("açık madde yok, kategori değişiminde önceki yapılanlar görünüyor (veri var) ve çevrimdışı: hazır", () => {
    expect(wishlistBodyState({ ...loaded, openItems: [], done: { ...doneOk, isPaused: true } })).toBe("ready");
  });

  it("açık madde varken yapılanların hiçbir durumu gövdeyi değiştirmez", () => {
    for (const done of [
      { ...doneOk, isInitialLoading: true },
      { isInitialLoading: true, isError: false, isPaused: true },
      { ...doneOk, isError: true },
    ]) {
      expect(wishlistBodyState({ ...loaded, openItems: one, done })).toBe("ready");
    }
  });

  it("açık maddeler yüklenmediyse eski kural geçerli", () => {
    expect(wishlistBodyState({ isLoaded: false, isError: false, isPaused: true })).toBe("offline");
    expect(wishlistBodyState({ isLoaded: false, isError: true, isPaused: false })).toBe("error");
    expect(wishlistBodyState({ isLoaded: false, isError: false, isPaused: false })).toBe("loading");
  });
});
