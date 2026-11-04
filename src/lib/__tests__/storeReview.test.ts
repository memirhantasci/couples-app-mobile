/// <reference types="jest" />
// Modül düzeyindeki durum (yüklenen native modül, eşzamanlı çağrı bayrağı) her testte sıfırlansın diye
// require ile yeniden yüklenir
/* eslint-disable @typescript-eslint/no-require-imports */
import { AppState } from "react-native";

const DAY_MS = 24 * 60 * 60 * 1000;

const mockStore = new Map<string, string>();
const mockStoreReview = {
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  requestReview: jest.fn(() => Promise.resolve()),
};

jest.mock("@/lib/safeStorage", () => ({
  safeStorage: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStore.set(key, value);
      return Promise.resolve();
    }),
  },
}));
jest.mock("expo-store-review", () => mockStoreReview);

type StoreReviewLib = typeof import("../storeReview");

function loadFresh(): StoreReviewLib {
  let lib!: StoreReviewLib;
  jest.isolateModules(() => {
    lib = require("../storeReview");
  });
  return lib;
}

/** Gecikmeyi (kutlama sahnesinin oturması) bekletmeden isteği tamamlar */
async function request(lib: StoreReviewLib, moment: Parameters<StoreReviewLib["requestReviewAtMoment"]>[0]) {
  const pending = lib.requestReviewAtMoment(moment);
  await jest.advanceTimersByTimeAsync(5000);
  return pending;
}

/** AppState.currentState düz bir özelliktir; testte doğrudan atanır */
function setAppState(state: "active" | "background") {
  Object.defineProperty(AppState, "currentState", { value: state, configurable: true, writable: true });
}

describe("canRequestReview", () => {
  const { canRequestReview } = loadFresh();
  const now = Date.UTC(2026, 10, 4);

  it("kayıt yoksa serbesttir", () => {
    expect(canRequestReview(null, now)).toBe(true);
  });

  it("90 günden önce engeller, 90. günde serbest bırakır", () => {
    expect(canRequestReview(now - 89 * DAY_MS, now)).toBe(false);
    expect(canRequestReview(now - 90 * DAY_MS, now)).toBe(true);
    expect(canRequestReview(now - 400 * DAY_MS, now)).toBe(true);
  });

  it("bozuk ya da gelecekteki kaydı (saat geri alındı) yok sayar", () => {
    expect(canRequestReview(Number.NaN, now)).toBe(true);
    expect(canRequestReview(now + 10 * DAY_MS, now)).toBe(true);
  });
});

describe("requestReviewAtMoment", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockStore.clear();
    mockStoreReview.isAvailableAsync.mockClear().mockImplementation(() => Promise.resolve(true));
    mockStoreReview.requestReview.mockClear().mockImplementation(() => Promise.resolve());
    setAppState("active");
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("ilk uygun anda istek gönderir ve zamanı kaydeder", async () => {
    const lib = loadFresh();
    expect(await request(lib, "star_claimed")).toBe(true);
    expect(mockStoreReview.requestReview).toHaveBeenCalledTimes(1);
    expect(Number(mockStore.get("@store_review_last_requested_at"))).toBeGreaterThan(0);
  });

  it("90 gün dolmadan ikinci kez istemez", async () => {
    const lib = loadFresh();
    expect(await request(lib, "anniversary")).toBe(true);
    expect(await request(lib, "letter_first_open")).toBe(false);
    expect(mockStoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it("90 gün sonra yeniden isteyebilir", async () => {
    mockStore.set("@store_review_last_requested_at", String(Date.now() - 91 * DAY_MS));
    const lib = loadFresh();
    expect(await request(lib, "anniversary")).toBe(true);
    expect(mockStoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it("cihaz desteklemiyorsa istemez ve hakkı harcamaz", async () => {
    mockStoreReview.isAvailableAsync.mockImplementation(() => Promise.resolve(false));
    const lib = loadFresh();
    expect(await request(lib, "star_claimed")).toBe(false);
    expect(mockStoreReview.requestReview).not.toHaveBeenCalled();
    expect(mockStore.has("@store_review_last_requested_at")).toBe(false);
  });

  it("gecikme sırasında uygulama arka plana geçtiyse istemez ve hakkı harcamaz", async () => {
    setAppState("background");
    const lib = loadFresh();
    expect(await request(lib, "star_claimed")).toBe(false);
    expect(mockStoreReview.requestReview).not.toHaveBeenCalled();
    expect(mockStore.has("@store_review_last_requested_at")).toBe(false);
  });

  it("aynı anda gelen ikinci çağrı yok sayılır", async () => {
    const lib = loadFresh();
    const first = lib.requestReviewAtMoment("star_claimed");
    const second = lib.requestReviewAtMoment("anniversary");
    await jest.advanceTimersByTimeAsync(5000);
    expect(await first).toBe(true);
    expect(await second).toBe(false);
    expect(mockStoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it("native istek hata verirse fırlatmaz", async () => {
    mockStoreReview.requestReview.mockImplementation(() => Promise.reject(new Error("ERR_STORE_REVIEW_FAILED")));
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const lib = loadFresh();
    await expect(request(lib, "star_claimed")).resolves.toBe(false);
  });
});
