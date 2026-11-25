/// <reference types="jest" />
import { computeLoveScore } from "../loveScore";

const mockRpc = jest.fn();
const mockFrom = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

jest.mock("@/lib/safeStorage", () => ({
  safeStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

function makeEmptyQuery(data: unknown[] = []) {
  const chain: Record<string, jest.Mock> = {};
  const resolveVal = Promise.resolve({ data, error: null });
  for (const m of ["select", "eq", "in", "lte", "gte", "or", "order", "limit", "maybeSingle"]) {
    chain[m] = jest.fn(() => chain);
  }
  (chain as unknown as PromiseLike<unknown>).then = resolveVal.then.bind(resolveVal);
  return chain;
}

describe("computeLoveScore — ortak liste (wishlist) entegrasyonu", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockImplementation((table: string) => {
      if (table === "medicines") return makeEmptyQuery([]);
      return makeEmptyQuery([]);
    });
  });

  function mockServerActivity(overrides: Record<string, number | boolean> = {}) {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "get_couple_period_activity") {
        return Promise.resolve({ data: { has_recent: false, has_this_month: false }, error: null });
      }
      if (fn === "get_couple_love_activity") {
        return Promise.resolve({
          data: {
            mood_authors_today: 0,
            daily_authors_today: 0,
            calendar_authors_recent: 0,
            completed_meetings_recent: 0,
            letter_senders_recent: 0,
            photo_recent_7d: 0,
            photo_recent_30d: 0,
            wishlist_add_authors_recent: 0,
            wishlist_done_recent: 0,
            paired: true,
            ...overrides,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
  }

  it("ücretsiz çiftlerde temel payda 115'tir (wishlist dahil) ve sıfır aktivitede taban 50 döner", async () => {
    mockServerActivity();
    const res = await computeLoveScore(101, "u1", "u2", false);
    expect(res.score).toBe(50);
    expect(res.breakdown.maxEarnablePoints).toBe(115);
    expect(res.breakdown.wishlist).toBe(0);
  });

  it("son 14 günde tek taraf fikir eklediyse wishlist 8 puan verir", async () => {
    mockServerActivity({ wishlist_add_authors_recent: 1, wishlist_done_recent: 0 });
    const res = await computeLoveScore(102, "u1", "u2", false);
    expect(res.breakdown.wishlist).toBe(8);
    expect(res.breakdown.earnedPoints).toBe(8);
    expect(res.score).toBe(50 + Math.round((8 / 115) * 50));
  });

  it("son 14 günde her iki taraf fikir eklediyse wishlist 12 puan verir", async () => {
    mockServerActivity({ wishlist_add_authors_recent: 2, wishlist_done_recent: 0 });
    const res = await computeLoveScore(103, "u1", "u2", false);
    expect(res.breakdown.wishlist).toBe(12);
    expect(res.breakdown.earnedPoints).toBe(12);
  });

  it("son 30 günde tamamlanan madde varsa wishlist tam 15 puan verir (fikir sayısından bağımsız)", async () => {
    mockServerActivity({ wishlist_add_authors_recent: 0, wishlist_done_recent: 1 });
    const res = await computeLoveScore(104, "u1", "u2", false);
    expect(res.breakdown.wishlist).toBe(15);
    expect(res.breakdown.earnedPoints).toBe(15);
  });

  it("tüm temel aktiviteler + wishlist tamamsa ücretsiz çift 100 puana ulaşır", async () => {
    mockServerActivity({
      mood_authors_today: 2,
      daily_authors_today: 2,
      calendar_authors_recent: 2,
      completed_meetings_recent: 1,
      letter_senders_recent: 2,
      wishlist_done_recent: 2,
    });
    const res = await computeLoveScore(105, "u1", "u2", false);
    expect(res.breakdown.maxEarnablePoints).toBe(115);
    expect(res.breakdown.earnedPoints).toBe(115);
    expect(res.score).toBe(100);
  });

  it("sunucu RPC hata verirse canlı satır yedeğinde ortak liste yine hesaplanır", async () => {
    const nowIso = new Date().toISOString();
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "get_couple_period_activity") {
        return Promise.resolve({ data: { has_recent: false, has_this_month: false }, error: null });
      }
      if (fn === "get_couple_love_activity") {
        return Promise.resolve({ data: null, error: { message: "rpc missing" } });
      }
      if (fn === "get_couple_note_activity") {
        return Promise.resolve({ data: { daily_authors_today: 0, calendar_authors_recent: 0 }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "couple_wishlist_items") {
        return makeEmptyQuery([
          { created_by: "u1", created_at: nowIso, status: "open", done_at: null },
          { created_by: "u2", created_at: nowIso, status: "done", done_at: nowIso },
        ]);
      }
      return makeEmptyQuery([]);
    });

    const res = await computeLoveScore(106, "u1", "u2", false);
    expect(res.breakdown.wishlist).toBe(15);
  });
});
