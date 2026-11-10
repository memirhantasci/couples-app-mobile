/// <reference types="jest" />
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { buildWishlistView, wishlistBodyState, type WishlistCategory, type WishlistDonePage, type WishlistItem } from "@/lib/wishlist";
import * as data from "@/lib/wishlistData";
import { shouldCancelBeforeOptimistic, useWishlist } from "../useWishlist";

jest.mock("@/lib/supabase", () => ({ supabase: {} }));
jest.mock("@/constants/demoData", () => ({ DEMO_WISHLIST: [] }));
jest.mock("@/lib/i18n", () => ({ __esModule: true, default: { language: "tr", t: (key: string) => key } }));
jest.mock("@/lib/wishlistData", () => {
  const actual = jest.requireActual("@/lib/wishlistData");
  return {
    ...actual,
    fetchWishlistOpen: jest.fn(),
    fetchWishlistDonePage: jest.fn(),
    setWishlistWant: jest.fn(),
    setWishlistDone: jest.fn(),
    addWishlistItem: jest.fn(),
    updateWishlistItem: jest.fn(),
    deleteWishlistItem: jest.fn(),
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer");
const { act } = TestRenderer;

const mocked = data as jest.Mocked<typeof data>;
const ME = "user-me";
const PARTNER = "user-partner";
const COUPLE = 5;

function item(id: number, overrides: Partial<WishlistItem> = {}): WishlistItem {
  return {
    id,
    couple_id: COUPLE,
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
    created_at: new Date(Date.UTC(2026, 0, id)).toISOString(),
    updated_at: "2026-01-01T00:00:00.000Z",
    wants: [ME],
    ...overrides,
  };
}

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type Hook = ReturnType<typeof useWishlist>;

// Testler arasında açık kalan ağaç ve önbellek zamanlayıcıları Jest işçisini kapanmaktan alıkoymasın
const cleanups: (() => void)[] = [];

/** TanStack Query bildirimleri bir sonraki tura erteler: hook'un son hâlini okumadan önce o turu bekle. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  onlineManager.setOnline(true);
});

async function mount(open: WishlistItem[], donePage: WishlistDonePage = { items: [], total: 0, offset: 0 }) {
  mocked.fetchWishlistOpen.mockResolvedValue(open);
  mocked.fetchWishlistDonePage.mockResolvedValue(donePage);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const hook: { current: Hook } = { current: undefined as unknown as Hook };
  function Harness({ filter }: { filter: WishlistCategory | null }) {
    hook.current = useWishlist({ coupleId: COUPLE, userId: ME, isDemoMode: false, filter });
    return null;
  }
  const tree = (filter: WishlistCategory | null) => (
    <QueryClientProvider client={client}>
      <Harness filter={filter} />
    </QueryClientProvider>
  );
  let renderer!: { update: (node: unknown) => void; unmount: () => void };
  await act(async () => {
    renderer = TestRenderer.create(tree(null));
  });
  cleanups.push(() => {
    act(() => renderer.unmount());
    client.clear();
  });
  // Yazımdan sonraki yenilemeyi say; sunucuya gitmesin ki geri alınan önbellek doğrudan görülsün
  const invalidate = jest.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
  const setFilter = async (filter: WishlistCategory | null) => {
    await act(async () => renderer.update(tree(filter)));
    await flush();
  };
  return { hook, client, invalidate, setFilter };
}

/** Ekranın çizdiği hâl: wishlist.tsx ile aynı türetme (çipler, açık bölüm, boş durum). */
function screenOf(hook: { current: Hook }, filter: WishlistCategory | null) {
  const view = buildWishlistView({
    openItems: hook.current.openItems ?? [],
    doneTotal: hook.current.doneTotal,
    userId: ME,
    isPaired: true,
    filter,
  });
  return { view, body: wishlistBodyState(hook.current) };
}

const openOf = (client: QueryClient) => client.getQueryData<WishlistItem[]>(data.wishlistOpenKey(COUPLE, false))!;
const byId = (items: WishlistItem[], id: number) => items.find((row) => row.id === id);
/** Hızlı eklemenin gönderdiği alanlar: yalnızca başlık ve kategori */
const quick = (title: string, category: WishlistCategory) => ({
  title,
  category,
  note: null,
  location_name: null,
  latitude: null,
  longitude: null,
});

beforeEach(() => jest.clearAllMocks());

describe("useWishlist iyimser güncelleme", () => {
  it("hata olunca yalnızca o madde eski hâline döner; aynı anda süren başka maddenin değişikliği korunur", async () => {
    const { hook, client, invalidate } = await mount([item(1), item(2)]);
    const writeA = deferred();
    const writeB = deferred();
    mocked.setWishlistWant.mockImplementation((id: number) => (id === 1 ? writeA.promise : writeB.promise));

    let resultA!: Promise<string>;
    let resultB!: Promise<string>;
    await act(async () => {
      resultA = hook.current.toggleWant(item(1));
      resultB = hook.current.toggleWant(item(2, { wants: [ME] }));
    });
    // İkisi de iyimser olarak "istemiyorum" oldu
    expect(byId(openOf(client), 1)!.wants).toEqual([]);
    expect(byId(openOf(client), 2)!.wants).toEqual([]);

    // B başarılı ama A hâlâ sürüyor: yenileme yapılmaz
    await act(async () => {
      writeB.resolve();
      await resultB;
    });
    expect(invalidate).not.toHaveBeenCalled();

    // A başarısız: yalnızca A geri döner, B'nin değişikliği ezilmez
    await act(async () => {
      writeA.reject({ code: "42501", message: "Madde bulunamadı veya yetkiniz yok." });
      expect(await resultA).toBe("denied");
    });
    expect(byId(openOf(client), 1)!.wants).toEqual([ME]);
    expect(byId(openOf(client), 2)!.wants).toEqual([]);
    // Süren yazım kalmayınca tek yenileme
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("'yaptık' reddedilince madde açık listeye geri döner, yapılanlar sayısı eski hâline gelir", async () => {
    const { hook, client } = await mount([item(1), item(2)], { items: [item(9, { status: "done", done_at: "2026-02-01T00:00:00.000Z" })], total: 1, offset: 0 });
    mocked.setWishlistDone.mockRejectedValue(new TypeError("Network request failed"));

    let result!: string;
    await act(async () => {
      result = await hook.current.toggleDone(item(1));
    });
    expect(result).toBe("network");
    expect(openOf(client).map((row) => row.id).sort()).toEqual([1, 2]);
    expect(byId(openOf(client), 1)!.status).toBe("open");
    expect(hook.current.doneTotal).toBe(1);
    expect(hook.current.doneItems.map((row) => row.id)).toEqual([9]);
  });

  it("'yaptık' geri alınırken sınır doluysa sonuç 'limit', madde yapılanlarda kalır", async () => {
    const doneItem = item(9, { status: "done", done_at: "2026-02-01T00:00:00.000Z", done_by: PARTNER });
    const { hook } = await mount([item(1)], { items: [doneItem], total: 1, offset: 0 });
    mocked.setWishlistDone.mockRejectedValue({ code: "P0022", message: "WISHLIST_LIMIT" });

    let result!: string;
    await act(async () => {
      result = await hook.current.toggleDone(doneItem);
    });
    expect(result).toBe("limit");
    expect(hook.current.doneItems.map((row) => row.id)).toEqual([9]);
    expect(hook.current.openItems!.map((row) => row.id)).toEqual([1]);
  });

  it("aynı maddeye üst üste basılırsa ikinci istek gönderilmez", async () => {
    const { hook } = await mount([item(1)]);
    const write = deferred();
    mocked.setWishlistWant.mockReturnValue(write.promise);
    await act(async () => {
      void hook.current.toggleWant(item(1));
      void hook.current.toggleWant(item(1));
    });
    expect(mocked.setWishlistWant).toHaveBeenCalledTimes(1);
    await act(async () => write.resolve());
  });

  it("ekleme hatası türüyle döner (P0022 → limit, 23514 → invalidTitle)", async () => {
    const { hook } = await mount([]);
    mocked.addWishlistItem.mockRejectedValueOnce({ code: "P0022", message: "WISHLIST_LIMIT" });
    mocked.addWishlistItem.mockRejectedValueOnce({
      code: "23514",
      message: 'new row for relation "couple_wishlist_items" violates check constraint "couple_wishlist_items_title_check"',
    });
    let first!: string;
    let second!: string;
    await act(async () => {
      first = await hook.current.addItem(quick("x", "other"));
      second = await hook.current.addItem(quick("y", "other"));
    });
    expect(first).toBe("limit");
    expect(second).toBe("invalidTitle");
  });
});

describe("ekran durumu yalnızca açık maddelere bağlı (yapılanlar sorgusundan bağımsız)", () => {
  const open = [item(1, { category: "food" }), item(2, { category: "film" })];
  const doneAll: WishlistDonePage = {
    items: [item(9, { status: "done", done_at: "2026-02-01T00:00:00.000Z", category: "food" })],
    total: 1,
    offset: 0,
  };

  it("filtre değişince yeni kategorinin yapılanları gelene kadar açık liste ve çipler kaybolmaz", async () => {
    const { hook, setFilter } = await mount(open, doneAll);
    const pending = deferred<WishlistDonePage>();
    mocked.fetchWishlistDonePage.mockReturnValue(pending.promise);

    await setFilter("food");
    const screen = screenOf(hook, "food");
    expect(screen.body).toBe("ready");
    expect(screen.view.showFilterChips).toBe(true);
    expect(screen.view.open.map((row) => row.id)).toEqual([1]);
    // Yapılanlar bölümü önceki sayfaları gösterir ve yalnızca kendisi "yükleniyor" der
    expect(hook.current.done.isSwitching).toBe(true);
    expect(hook.current.doneItems.map((row) => row.id)).toEqual([9]);

    await act(async () => pending.resolve({ items: [], total: 0, offset: 0 }));
    await flush();
    expect(hook.current.done.isSwitching).toBe(false);
    expect(hook.current.doneTotal).toBe(0);
    expect(screenOf(hook, "food").body).toBe("ready");
  });

  it("yapılanlar sorgusu hata verince açık liste durur; hata yalnızca Yaptıklarımız bölümündedir", async () => {
    mocked.fetchWishlistOpen.mockResolvedValue(open);
    const { hook, setFilter } = await mount(open, doneAll);
    mocked.fetchWishlistDonePage.mockRejectedValue(new Error("statement timeout"));

    await setFilter("film");
    const screen = screenOf(hook, "film");
    expect(screen.body).toBe("ready");
    expect(hook.current.isError).toBe(false);
    expect(screen.view.open.map((row) => row.id)).toEqual([2]);
    expect(hook.current.done.isError).toBe(true);
  });

  it("ilk açılışta yapılanlar hata verse de açık liste görünür", async () => {
    mocked.fetchWishlistOpen.mockResolvedValue(open);
    mocked.fetchWishlistDonePage.mockRejectedValue(new Error("boom"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const hook: { current: Hook } = { current: undefined as unknown as Hook };
    function Harness() {
      hook.current = useWishlist({ coupleId: COUPLE, userId: ME, isDemoMode: false, filter: null });
      return null;
    }
    let renderer!: { unmount: () => void };
    await act(async () => {
      renderer = TestRenderer.create(
        <QueryClientProvider client={client}>
          <Harness />
        </QueryClientProvider>
      );
    });
    cleanups.push(() => {
      act(() => renderer.unmount());
      client.clear();
    });
    await flush();
    expect(screenOf(hook, null).body).toBe("ready");
    expect(hook.current.openItems!.map((row) => row.id).sort()).toEqual([1, 2]);
    expect(hook.current.done.isError).toBe(true);
  });

  it("çevrimdışıyken filtre değişimi tüm ekranı 'çevrimdışı' boş durumuna düşürmez", async () => {
    const { hook, setFilter } = await mount(open, doneAll);
    await act(async () => onlineManager.setOnline(false));

    await setFilter("food");
    const screen = screenOf(hook, "food");
    expect(screen.body).toBe("ready");
    expect(hook.current.isPaused).toBe(false);
    expect(screen.view.showFilterChips).toBe(true);
    expect(screen.view.open.map((row) => row.id)).toEqual([1]);
    // Yapılanlar beklemede ama önceki sayfalar görünür
    expect(hook.current.done.isPaused).toBe(true);
    expect(hook.current.doneItems.map((row) => row.id)).toEqual([9]);
  });
});

describe("yenileme beklemesi ve iptal", () => {
  it("başka bir yazım sürerken ekleme, o yazım bitip yenileme yapılana kadar dönmez (fikir kilidi erken açılmaz)", async () => {
    const { hook, invalidate } = await mount([item(1)]);
    const want = deferred();
    mocked.setWishlistWant.mockReturnValue(want.promise);
    mocked.addWishlistItem.mockResolvedValue(undefined);

    let added = false;
    let addPromise!: Promise<string>;
    await act(async () => {
      void hook.current.toggleWant(item(1));
      addPromise = hook.current.addItem(quick("Kapadokya", "travel")).then((result) => {
        added = true;
        return result;
      });
    });
    // Ekleme yazıldı ama 💗 hâlâ yolda: yenileme yapılmadı, ekleme de bitmiş sayılmadı
    expect(mocked.addWishlistItem).toHaveBeenCalledTimes(1);
    expect(mocked.addWishlistItem).toHaveBeenCalledWith({ coupleId: COUPLE, userId: ME, item: quick("Kapadokya", "travel") });
    expect(invalidate).not.toHaveBeenCalled();
    expect(added).toBe(false);

    await act(async () => {
      want.resolve();
      expect(await addPromise).toBe("ok");
    });
    expect(added).toBe(true);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("iyimser yazım 'daha fazla göster' yüklemesini iptal etmez, sıradan okumaları eder", () => {
    const state = (fetchStatus: string, fetchMeta: unknown) =>
      ({ state: { fetchStatus, fetchMeta } }) as unknown as Parameters<typeof shouldCancelBeforeOptimistic>[0];
    expect(shouldCancelBeforeOptimistic(state("fetching", { fetchMore: { direction: "forward" } }))).toBe(false);
    expect(shouldCancelBeforeOptimistic(state("fetching", null))).toBe(true);
    expect(shouldCancelBeforeOptimistic(state("idle", { fetchMore: { direction: "forward" } }))).toBe(true);
  });
});

describe("açık madde yokken boş durum yapılanları bekler", () => {
  it("yapılanlar yolda: gövde 'loading' (Listeniz henüz boş + hazır fikirler gösterilmez)", async () => {
    const pending = deferred<WishlistDonePage>();
    const { hook } = await mount([]);
    // mount ilk sayfayı çözdü; yeni bir kategoriye değil, ilk açılışa benzetmek için önbelleği boşaltıp yeniden kur
    mocked.fetchWishlistDonePage.mockReturnValue(pending.promise);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const local: { current: Hook } = { current: undefined as unknown as Hook };
    function Harness() {
      local.current = useWishlist({ coupleId: COUPLE, userId: ME, isDemoMode: false, filter: null });
      return null;
    }
    let renderer!: { unmount: () => void };
    await act(async () => {
      renderer = TestRenderer.create(
        <QueryClientProvider client={client}>
          <Harness />
        </QueryClientProvider>
      );
    });
    cleanups.push(() => {
      act(() => renderer.unmount());
      client.clear();
    });
    await flush();
    expect(local.current.openItems).toEqual([]);
    expect(screenOf(local, null).body).toBe("loading");

    await act(async () => pending.resolve({ items: [item(9, { status: "done", done_at: "2026-02-01T00:00:00.000Z" })], total: 1, offset: 0 }));
    await flush();
    expect(screenOf(local, null).body).toBe("ready");
    expect(screenOf(local, null).view.emptyState).toBe("allDone");
    expect(hook.current.openItems).toEqual([]);
  });

  it("yapılanlar hata verdi: gövde 'error' (boş durum değil)", async () => {
    mocked.fetchWishlistOpen.mockResolvedValue([]);
    mocked.fetchWishlistDonePage.mockRejectedValue(new Error("boom"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const local: { current: Hook } = { current: undefined as unknown as Hook };
    function Harness() {
      local.current = useWishlist({ coupleId: COUPLE, userId: ME, isDemoMode: false, filter: null });
      return null;
    }
    let renderer!: { unmount: () => void };
    await act(async () => {
      renderer = TestRenderer.create(
        <QueryClientProvider client={client}>
          <Harness />
        </QueryClientProvider>
      );
    });
    cleanups.push(() => {
      act(() => renderer.unmount());
      client.clear();
    });
    await flush();
    expect(local.current.openItems).toEqual([]);
    expect(screenOf(local, null).body).toBe("error");
  });
});
