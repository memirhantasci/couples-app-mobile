/// <reference types="jest" />
/// <reference types="node" />
import { readFileSync } from "fs";
import { join } from "path";

import {
  WISHLIST_CATEGORIES,
  WISHLIST_FREE_LIMIT,
  WISHLIST_NOTE_MAX,
  WISHLIST_PREMIUM_LIMIT,
  WISHLIST_TITLE_MAX,
  filterByCategory,
  getWishlistQuota,
  isBothWant,
  isWishlistCategory,
  normalizeWishlistCategory,
  pickWishlistItem,
  splitWishlist,
  type WishlistItem,
} from "../wishlist";

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
    created_at: `2026-01-${String((id % 27) + 1).padStart(2, "0")}T10:00:00.000Z`,
    updated_at: "2026-01-01T10:00:00.000Z",
    wants: [ME],
    ...overrides,
  };
}

const both = (overrides: Partial<WishlistItem> = {}) => makeItem({ wants: [ME, PARTNER], ...overrides });
const done = (overrides: Partial<WishlistItem> = {}) =>
  makeItem({ status: "done", done_at: "2026-03-01T10:00:00.000Z", done_by: PARTNER, ...overrides });
const ids = (items: readonly WishlistItem[]) => items.map((item) => item.id);

describe("sunucu sözleşmesiyle eşleşen sabitler", () => {
  const migration = readFileSync(
    join(__dirname, "../../../supabase/migrations/20261109000000_couple_wishlist.sql"),
    "utf8"
  );
  const sqlConstant = (fn: string): number => {
    const match = migration.match(new RegExp(`FUNCTION public\\.${fn}\\(\\)[\\s\\S]*?SELECT\\s+(\\d+)`));
    if (!match) throw new Error(`${fn}() migration dosyasında bulunamadı`);
    return Number(match[1]);
  };

  it("WISHLIST_FREE_LIMIT sunucudaki wishlist_free_limit() ile aynı", () => {
    expect(WISHLIST_FREE_LIMIT).toBe(sqlConstant("wishlist_free_limit"));
  });

  it("WISHLIST_PREMIUM_LIMIT sunucudaki wishlist_premium_limit() ile aynı", () => {
    expect(WISHLIST_PREMIUM_LIMIT).toBe(sqlConstant("wishlist_premium_limit"));
  });

  it("başlık ve not uzunluk sınırları tablo kısıtlarıyla aynı", () => {
    expect(migration).toMatch(new RegExp(`char_length\\(title\\) BETWEEN 1 AND ${WISHLIST_TITLE_MAX}\\b`));
    expect(migration).toMatch(new RegExp(`char_length\\(note\\) <= ${WISHLIST_NOTE_MAX}\\b`));
  });

  it("kategori listesi tablo kısıtıyla aynı", () => {
    const match = migration.match(/CHECK \(category IN \(([^)]*)\)\)/);
    expect(match).not.toBeNull();
    const sqlCategories = [...match![1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect([...sqlCategories].sort()).toEqual([...WISHLIST_CATEGORIES].sort());
  });

  it("ücretsiz sınır 15", () => {
    expect(WISHLIST_FREE_LIMIT).toBe(15);
  });
});

describe("kategori doğrulama", () => {
  it("altı kategoriyi tanır", () => {
    expect(WISHLIST_CATEGORIES).toHaveLength(6);
    for (const category of WISHLIST_CATEGORIES) expect(isWishlistCategory(category)).toBe(true);
  });

  it("bilinmeyen ya da yanlış türdeki değeri reddeder", () => {
    for (const value of ["gift", "", "PLACE", null, undefined, 3, {}]) expect(isWishlistCategory(value)).toBe(false);
  });

  it("bilinmeyen kategoriyi Diğer'e düşürür, bilineni korur", () => {
    expect(normalizeWishlistCategory("gift")).toBe("other");
    expect(normalizeWishlistCategory(undefined)).toBe("other");
    expect(normalizeWishlistCategory("travel")).toBe("travel");
  });
});

describe("getWishlistQuota", () => {
  it("boş listede sayaç sıfır, sınıra ulaşılmamış", () => {
    expect(getWishlistQuota([], false)).toEqual({ openCount: 0, limit: 15, reached: false, showCounter: true, shownCount: 0 });
  });

  it("yalnızca açık maddeleri sayar, yapılanlar sayıya girmez", () => {
    const items = [makeItem(), makeItem(), done(), done(), done()];
    const quota = getWishlistQuota(items, false);
    expect(quota.openCount).toBe(2);
    expect(quota.reached).toBe(false);
  });

  it("ücretsizde 14 açıkta sınıra ulaşılmaz, 15'te ulaşılır", () => {
    const fourteen = Array.from({ length: 14 }, () => makeItem());
    expect(getWishlistQuota(fourteen, false).reached).toBe(false);
    expect(getWishlistQuota([...fourteen, makeItem()], false).reached).toBe(true);
  });

  it("15 açık + çok sayıda yapılan: sınır yine açık maddelere göre", () => {
    const items = [...Array.from({ length: 15 }, () => makeItem()), ...Array.from({ length: 20 }, () => done())];
    expect(getWishlistQuota(items, false)).toMatchObject({ openCount: 15, reached: true });
  });

  it("Premium'da üst sınır 300, sayaç gizli", () => {
    const items = Array.from({ length: 20 }, () => makeItem());
    expect(getWishlistQuota(items, true)).toEqual({ openCount: 20, limit: 300, reached: false, showCounter: false, shownCount: 20 });
    const full = Array.from({ length: 300 }, () => makeItem());
    expect(getWishlistQuota(full, true).reached).toBe(true);
  });
});

describe("isBothWant", () => {
  it("ikisi de 💗 verdiyse true", () => {
    expect(isBothWant(both(), ME, true)).toBe(true);
    // Sıra önemli değil
    expect(isBothWant(makeItem({ wants: [PARTNER, ME] }), ME, true)).toBe(true);
  });

  it("yalnızca ben ya da yalnızca partner istiyorsa false", () => {
    expect(isBothWant(makeItem({ wants: [ME] }), ME, true)).toBe(false);
    expect(isBothWant(makeItem({ wants: [PARTNER] }), ME, true)).toBe(false);
    expect(isBothWant(makeItem({ wants: [] }), ME, true)).toBe(false);
  });

  it("tek kalan (eşleşmemiş) kullanıcıda hiçbir madde 'ikimiz de' sayılmaz", () => {
    expect(isBothWant(both(), ME, false)).toBe(false);
  });

  it("kullanıcı kimliği yoksa false", () => {
    expect(isBothWant(both(), null, true)).toBe(false);
  });
});

describe("splitWishlist", () => {
  it("boş liste üç boş bölüm verir", () => {
    expect(splitWishlist([], ME, true)).toEqual({ bothWant: [], open: [], done: [] });
  });

  it("maddeleri üç bölüme ayırır, 'ikimiz de' maddeleri açık listede tekrar etmez", () => {
    const a = both({ id: 1 });
    const b = makeItem({ id: 2 });
    const c = done({ id: 3 });
    const d = makeItem({ id: 4, wants: [PARTNER] });
    const sections = splitWishlist([a, b, c, d], ME, true);
    expect(ids(sections.bothWant)).toEqual([1]);
    expect(ids(sections.open).sort()).toEqual([2, 4]);
    expect(ids(sections.done)).toEqual([3]);
  });

  it("yapılmış madde ikisi de istese bile yalnızca Yaptıklarımız'da görünür", () => {
    const sections = splitWishlist([done({ wants: [ME, PARTNER] })], ME, true);
    expect(sections.bothWant).toHaveLength(0);
    expect(sections.open).toHaveLength(0);
    expect(sections.done).toHaveLength(1);
  });

  it("tek kalanda 'ikimiz de' bölümü boş kalır, hepsi açıkta", () => {
    const sections = splitWishlist([both({ id: 1 }), both({ id: 2 })], ME, false);
    expect(sections.bothWant).toHaveLength(0);
    expect(sections.open).toHaveLength(2);
  });

  it("açık maddeleri yeniden eskiye sıralar; aynı anda eklenenlerde yüksek kimlik önde", () => {
    const sections = splitWishlist(
      [
        makeItem({ id: 1, created_at: "2026-02-01T10:00:00.000Z" }),
        makeItem({ id: 2, created_at: "2026-02-03T10:00:00.000Z" }),
        makeItem({ id: 3, created_at: "2026-02-03T10:00:00.000Z" }),
        makeItem({ id: 4, created_at: "2026-02-02T10:00:00.000Z" }),
      ],
      ME,
      true
    );
    expect(ids(sections.open)).toEqual([3, 2, 4, 1]);
  });

  it("yapılanları yapılma tarihine göre en yeniden eskiye sıralar", () => {
    const sections = splitWishlist(
      [
        done({ id: 1, done_at: "2026-03-01T10:00:00.000Z" }),
        done({ id: 2, done_at: "2026-05-01T10:00:00.000Z" }),
        done({ id: 3, done_at: "2026-04-01T10:00:00.000Z" }),
      ],
      ME,
      true
    );
    expect(ids(sections.done)).toEqual([2, 3, 1]);
  });

  it("girdi dizisini değiştirmez", () => {
    const items = [makeItem({ id: 1 }), makeItem({ id: 2, created_at: "2027-01-01T00:00:00.000Z" })];
    const snapshot = ids(items);
    splitWishlist(items, ME, true);
    expect(ids(items)).toEqual(snapshot);
  });
});

describe("filterByCategory", () => {
  const items = [
    makeItem({ id: 1, category: "food" }),
    makeItem({ id: 2, category: "film" }),
    makeItem({ id: 3, category: "food" }),
  ];

  it("kategori verilince yalnızca o kategoriyi döndürür", () => {
    expect(ids(filterByCategory(items, "food"))).toEqual([1, 3]);
    expect(filterByCategory(items, "travel")).toEqual([]);
  });

  it("kategori yoksa (Tümü) hepsini, ama kopya bir dizi olarak döndürür", () => {
    const all = filterByCategory(items, null);
    expect(ids(all)).toEqual([1, 2, 3]);
    expect(all).not.toBe(items);
  });

  it("boş listede boş döner", () => {
    expect(filterByCategory([], "food")).toEqual([]);
    expect(filterByCategory([], null)).toEqual([]);
  });
});

describe("pickWishlistItem", () => {
  const pool = [
    both({ id: 10, category: "food" }),
    both({ id: 11, category: "film" }),
    both({ id: 12, category: "travel" }),
    makeItem({ id: 13, category: "food" }),
    makeItem({ id: 14, category: "place", wants: [PARTNER] }),
    done({ id: 15, wants: [ME, PARTNER] }),
  ];

  it("boş listede ve yalnızca yapılanlar varsa null döner", () => {
    expect(pickWishlistItem([], ME, { isPaired: true, seed: 1 })).toBeNull();
    expect(pickWishlistItem([done(), done()], ME, { isPaired: true, seed: 1 })).toBeNull();
  });

  it("aynı tohum aynı sonucu verir", () => {
    for (const seed of [1, 7, 42, 999, 123456]) {
      const first = pickWishlistItem(pool, ME, { isPaired: true, seed });
      const second = pickWishlistItem(pool, ME, { isPaired: true, seed });
      expect(first?.item.id).toBe(second?.item.id);
    }
  });

  it("girdi sırası sonucu değiştirmez (aynı tohum)", () => {
    const reversed = [...pool].reverse();
    for (const seed of [3, 17, 256, 4096]) {
      expect(pickWishlistItem(reversed, ME, { isPaired: true, seed })?.item.id).toBe(
        pickWishlistItem(pool, ME, { isPaired: true, seed })?.item.id
      );
    }
  });

  it("ikisinin de istedikleri varsa yalnızca onlardan seçer", () => {
    for (let seed = 0; seed < 60; seed++) {
      const pick = pickWishlistItem(pool, ME, { isPaired: true, seed });
      expect(pick?.source).toBe("both");
      expect(pick?.poolSize).toBe(3);
      expect([10, 11, 12]).toContain(pick?.item.id);
    }
  });

  it("ortak madde yoksa tüm açık maddelerden seçer, yapılanları asla seçmez", () => {
    const noBoth = pool.filter((item) => item.id >= 13);
    for (let seed = 0; seed < 60; seed++) {
      const pick = pickWishlistItem(noBoth, ME, { isPaired: true, seed });
      expect(pick?.source).toBe("open");
      expect(pick?.poolSize).toBe(2);
      expect([13, 14]).toContain(pick?.item.id);
    }
  });

  it("tek kalanda ortak madde sayılmaz: tüm açıklardan seçer", () => {
    const pick = pickWishlistItem(pool, ME, { isPaired: false, seed: 5 });
    expect(pick?.source).toBe("open");
    expect(pick?.poolSize).toBe(5);
  });

  it("kategori filtresine uyar: önce o kategorideki ortak maddeler, yoksa o kategorideki açıklar", () => {
    const food = pickWishlistItem(pool, ME, { isPaired: true, category: "food", seed: 9 });
    expect(food).toMatchObject({ source: "both", poolSize: 1 });
    expect(food?.item.id).toBe(10);

    const place = pickWishlistItem(pool, ME, { isPaired: true, category: "place", seed: 9 });
    expect(place).toMatchObject({ source: "open", poolSize: 1 });
    expect(place?.item.id).toBe(14);

    expect(pickWishlistItem(pool, ME, { isPaired: true, category: "other", seed: 9 })).toBeNull();
  });

  it("'Başka bir tane' aynı maddeyi yeniden vermez", () => {
    for (let seed = 0; seed < 80; seed++) {
      const pick = pickWishlistItem(pool, ME, { isPaired: true, excludeId: 11, seed });
      expect(pick?.item.id).not.toBe(11);
      expect(pick?.poolSize).toBe(3);
    }
  });

  it("havuzda tek madde varsa dışlansa bile onu verir", () => {
    const single = [makeItem({ id: 50 })];
    const pick = pickWishlistItem(single, ME, { isPaired: true, excludeId: 50, seed: 1 });
    expect(pick?.item.id).toBe(50);
    expect(pick?.poolSize).toBe(1);
  });

  it("farklı tohumlar havuzdaki maddelerin hepsine ulaşır", () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 300; seed++) {
      const pick = pickWishlistItem(pool, ME, { isPaired: true, seed });
      if (pick) seen.add(pick.item.id);
    }
    expect([...seen].sort()).toEqual([10, 11, 12]);
  });

  it("girdi dizisini değiştirmez", () => {
    const snapshot = ids(pool);
    pickWishlistItem(pool, ME, { isPaired: true, seed: 3 });
    expect(ids(pool)).toEqual(snapshot);
  });

  it("tohum verilmezse de geçerli bir madde döndürür", () => {
    const pick = pickWishlistItem(pool, ME, { isPaired: true });
    expect([10, 11, 12]).toContain(pick?.item.id);
  });
});
