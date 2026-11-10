/// <reference types="jest" />
/// <reference types="node" />
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

import type { WishlistItem } from "../wishlist";
import type { WishlistItemPatch } from "../wishlistData";

jest.mock("@/lib/i18n", () => ({ __esModule: true, default: { language: "tr", t: (key: string) => key } }));

const MIGRATIONS = join(__dirname, "../../../supabase/migrations");
const wishlistMigrations = readdirSync(MIGRATIONS)
  .filter((name) => name >= "20261109000000")
  .sort()
  .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS, name), "utf8") }));

function grantedColumns(privilege: "INSERT" | "UPDATE"): string[] {
  const pattern = new RegExp(
    `GRANT\\s+${privilege}\\s*\\(([^)]*)\\)\\s+ON\\s+public\\.couple_wishlist_items\\s+TO\\s+authenticated`,
    "gi"
  );
  const columns = wishlistMigrations.flatMap(({ sql }) =>
    [...sql.matchAll(pattern)].flatMap((match) => match[1].split(",").map((column) => column.trim()))
  );
  return [...new Set(columns)].sort();
}

/** Bir migration ileride tabloya sütun listesiz INSERT/UPDATE verirse sütun koruması tümden kalkar. */
function tableWideGrants(): string[] {
  return wishlistMigrations.flatMap(({ name, sql }) =>
    [...sql.matchAll(/GRANT\s+([A-Z ,]+?)\s+ON\s+(?:TABLE\s+)?public\.couple_wishlist_items\s+TO\s+([a-z_, ]+)/gi)]
      .filter((match) => /\b(INSERT|UPDATE|ALL)\b/i.test(match[1]) && /\bauthenticated\b/.test(match[2]))
      .map((match) => `${name}: ${match[0]}`)
  );
}

describe("istemcinin yazabildiği sütunlar = migration'daki sütun yetkileri", () => {
  // Modül yüklenirken supabase istemcisi kurulmasın
  jest.doMock("@/lib/supabase", () => ({ supabase: {} }));
  jest.doMock("@/constants/demoData", () => ({ DEMO_WISHLIST: [] }));
  const { WISHLIST_INSERT_COLUMNS, WISHLIST_UPDATE_COLUMNS } = require("../wishlistData") as typeof import("../wishlistData");

  it("GRANT INSERT sütunları", () => {
    expect(grantedColumns("INSERT")).toEqual([...WISHLIST_INSERT_COLUMNS].sort());
  });

  it("GRANT UPDATE sütunları", () => {
    expect(grantedColumns("UPDATE")).toEqual([...WISHLIST_UPDATE_COLUMNS].sort());
  });

  it("sunucuya ait sütunlar istemci listelerinde yok", () => {
    for (const column of ["status", "done_at", "done_by", "created_at", "updated_at", "meeting_id", "memory_id", "id"]) {
      expect(WISHLIST_INSERT_COLUMNS as readonly string[]).not.toContain(column);
      expect(WISHLIST_UPDATE_COLUMNS as readonly string[]).not.toContain(column);
    }
  });

  it("hiçbir migration tabloya sütun listesiz INSERT/UPDATE vermiyor", () => {
    expect(tableWideGrants()).toEqual([]);
  });

  it("WishlistItemPatch tam olarak UPDATE sütunlarıdır (status eklenirse tip denetimi de kırılır)", () => {
    type PatchKey = keyof WishlistItemPatch;
    type Allowed = (typeof WISHLIST_UPDATE_COLUMNS)[number];
    // İki yönlü eşitlik: fazla ya da eksik anahtar derleme hatasıdır
    const extra: [Exclude<PatchKey, Allowed>] extends [never] ? true : false = true;
    const missing: [Exclude<Allowed, PatchKey>] extends [never] ? true : false = true;
    const noStatus: ["status" extends PatchKey ? true : false] extends [false] ? true : false = true;
    expect([extra, missing, noStatus]).toEqual([true, true, true]);

    const sample: WishlistItemPatch = {
      title: "t",
      note: null,
      category: "other",
      location_name: null,
      latitude: null,
      longitude: null,
    };
    expect(Object.keys(sample).sort()).toEqual([...WISHLIST_UPDATE_COLUMNS].sort());
  });
});

describe("istek gövdesi yalnızca izinli sütunları taşır (sunucu açıkken)", () => {
  const load = () => {
    jest.resetModules();
    const calls: { insert?: Record<string, unknown>; update?: Record<string, unknown> } = {};
    const chain = {
      eq: () => chain,
      select: async () => ({ data: [{ id: 1 }], error: null }),
    };
    jest.doMock("@/lib/supabase", () => ({
      supabase: {
        from: () => ({
          insert: async (row: Record<string, unknown>) => {
            calls.insert = row;
            return { error: null };
          },
          update: (row: Record<string, unknown>) => {
            calls.update = row;
            return chain;
          },
        }),
      },
    }));
    jest.doMock("@/constants/demoData", () => ({ DEMO_WISHLIST: [] }));
    jest.doMock("@/lib/wishlistAvailability", () => ({
      ...jest.requireActual("@/lib/wishlistAvailability"),
      WISHLIST_SERVER_READY: true,
    }));
    return { data: require("../wishlistData") as typeof import("../wishlistData"), calls };
  };
  afterEach(() => {
    jest.dontMock("@/lib/supabase");
    jest.dontMock("@/lib/wishlistAvailability");
  });

  it("ekleme yalnızca INSERT sütunlarını gönderir", async () => {
    const { data, calls } = load();
    await data.addWishlistItem({ coupleId: 3, userId: "u", title: "Kapadokya", category: "travel" });
    expect(Object.keys(calls.insert!).every((key) => (data.WISHLIST_INSERT_COLUMNS as readonly string[]).includes(key))).toBe(true);
  });

  it("düzenlemeye tip dışından status/done_by sızsa bile gövdeye girmez", async () => {
    const { data, calls } = load();
    const patch = {
      title: "t",
      note: null,
      category: "other",
      location_name: null,
      latitude: null,
      longitude: null,
      status: "done",
      done_by: "x",
    } as unknown as WishlistItemPatch;
    await data.updateWishlistItem(1, "u", patch);
    expect(Object.keys(calls.update!).sort()).toEqual([...data.WISHLIST_UPDATE_COLUMNS].sort());
  });
});

describe("wishlistMock sunucu kurallarını taklit eder", () => {
  jest.doMock("@/lib/supabase", () => ({ supabase: {} }));
  const ME = "me";
  const PARTNER = "partner";
  const base = (id: number, overrides: Partial<WishlistItem> = {}): WishlistItem => ({
    id,
    couple_id: 1,
    created_by: ME,
    title: `M${id}`,
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
  });
  const loadMock = () => {
    jest.resetModules();
    return require("../wishlistMock").wishlistMock as typeof import("../wishlistMock").wishlistMock;
  };
  const errorOf = async (promise: Promise<unknown>) => promise.then(() => null, (error) => error);

  it("ücretsizde 15 açık maddede ekleme P0022 (WISHLIST_LIMIT) verir; Premium'da geçer", async () => {
    const mock = loadMock();
    mock.seed(Array.from({ length: 15 }, (_, i) => base(i + 1)));
    const error = await errorOf(mock.add({ coupleId: 1, userId: ME, title: "16", category: "other" }));
    expect(error).toMatchObject({ code: "P0022", message: "WISHLIST_LIMIT" });

    mock.seed(Array.from({ length: 15 }, (_, i) => base(i + 1)), { premium: true });
    expect(await errorOf(mock.add({ coupleId: 1, userId: ME, title: "16", category: "other" }))).toBeNull();
  });

  it("sınır doluyken 'yaptık'ı geri almak P0022 verir, madde yapılanlarda kalır", async () => {
    const mock = loadMock();
    mock.seed([
      ...Array.from({ length: 15 }, (_, i) => base(i + 1)),
      base(99, { status: "done", done_at: "2026-02-01T00:00:00.000Z", done_by: PARTNER }),
    ]);
    expect(await errorOf(mock.setDone(99, ME, false))).toMatchObject({ code: "P0022" });
    expect(mock.snapshot().find((row) => row.id === 99)!.status).toBe("done");
  });

  it("yalnızca ekleyen düzenler ve siler; partnere WISHLIST_WRITE_DENIED", async () => {
    const mock = loadMock();
    mock.seed([base(1)]);
    expect(await errorOf(mock.update(1, PARTNER, { title: "x" }))).toMatchObject({ message: "WISHLIST_WRITE_DENIED" });
    expect(await errorOf(mock.remove(1, PARTNER))).toMatchObject({ message: "WISHLIST_WRITE_DENIED" });
    expect(mock.snapshot()).toHaveLength(1);
    await mock.update(1, ME, { title: "yeni" });
    expect(mock.snapshot()[0].title).toBe("yeni");
    await mock.remove(1, ME);
    expect(mock.snapshot()).toHaveLength(0);
  });

  it("zaten yapılmış maddeye tekrar 'yaptık' ilk tarihi ve kişiyi korur", async () => {
    const mock = loadMock();
    mock.seed([base(1, { status: "done", done_at: "2026-02-01T00:00:00.000Z", done_by: PARTNER })]);
    await mock.setDone(1, ME, true);
    expect(mock.snapshot()[0]).toMatchObject({ done_at: "2026-02-01T00:00:00.000Z", done_by: PARTNER });
  });

  it("görünmeyen maddeye RPC 42501 verir", async () => {
    const mock = loadMock();
    mock.seed([]);
    expect(await errorOf(mock.setWant(5, ME, true))).toMatchObject({ code: "42501" });
  });
});
