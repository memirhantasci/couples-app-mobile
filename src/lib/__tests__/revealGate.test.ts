/// <reference types="jest" />
// Oturum durumu (ekranların ilk çizimi, ana sayfa bayrağı) her testte sıfırlansın diye require ile yeniden yüklenir
/* eslint-disable @typescript-eslint/no-require-imports */

const mockGetItem = jest.fn<Promise<string | null>, [string]>(() => Promise.resolve("1"));
const mockSetItem = jest.fn<Promise<void>, [string, string]>(() => Promise.resolve());
const mockBird = jest.fn<boolean | null, []>(() => null);

jest.mock("@/lib/safeStorage", () => ({
  safeStorage: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));
jest.mock("@/lib/letterArrival", () => ({ getFirstArrivalBird: () => mockBird() }));

type GateModule = typeof import("../revealGate");
let gate: GateModule;

/** Açılıştaki bayrak okumasının (söz) bitmesini bekler. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

async function load(): Promise<void> {
  jest.resetModules();
  gate = require("../revealGate") as GateModule;
  await flush();
}

beforeEach(async () => {
  mockGetItem.mockReset().mockResolvedValue("1");
  mockSetItem.mockClear();
  mockBird.mockReset().mockReturnValue(null);
  await load();
});

describe("revealGate: ekran başına tek giriş", () => {
  it("ekranın ilk kartı ve kısa süre içindeki kardeş kartlar oynar", () => {
    expect(gate.shouldReveal("letters", 1000)).toBe(true);
    expect(gate.shouldReveal("letters", 1100)).toBe(true);
    expect(gate.shouldReveal("letters", 1600)).toBe(true);
  });

  it("sonradan çizilen kartlar (sekme geçişi, yenileme, kaydırma) oynamaz", () => {
    expect(gate.shouldReveal("letters", 1000)).toBe(true);
    // Kısa süre geçti: mektuplarda Tümü / Gelen / Giden geçişi
    expect(gate.shouldReveal("letters", 5000)).toBe(false);
    expect(gate.shouldReveal("letters", 60_000)).toBe(false);
  });

  it("her ekran kendi ilk girişini alır", () => {
    expect(gate.shouldReveal("letters", 1000)).toBe(true);
    expect(gate.shouldReveal("medicine", 5000)).toBe(true);
    expect(gate.shouldReveal("medicine", 9000)).toBe(false);
    expect(gate.shouldReveal("memories", 9500)).toBe(true);
  });
});

describe("revealGate: ana sayfa", () => {
  it("bu cihazda daha önce açıldıysa ilk girişte oynar", () => {
    expect(gate.shouldReveal("home", 1000)).toBe(true);
    expect(gate.shouldReveal("home", 1100)).toBe(true);
    expect(gate.shouldReveal("home", 9000)).toBe(false);
  });

  it("ilk kurulumda oynamaz ve bayrağı yazar; sonraki açılış oynar", async () => {
    mockGetItem.mockResolvedValue(null);
    await load();

    expect(gate.shouldReveal("home", 1000)).toBe(false);
    expect(gate.shouldReveal("home", 1100)).toBe(false);
    expect(mockSetItem).toHaveBeenCalledWith("@home_reveal_seen_v1", "1");

    // Sonraki soğuk açılış: bayrak artık yazılı
    mockGetItem.mockResolvedValue("1");
    await load();
    expect(gate.shouldReveal("home", 1000)).toBe(true);
  });

  it("mektup kuşu uçacaksa oynamaz", () => {
    mockBird.mockReturnValue(true);
    expect(gate.shouldReveal("home", 1000)).toBe(false);
    expect(gate.shouldReveal("home", 1100)).toBe(false);
  });

  it("kuş yoksa ya da henüz bilinmiyorsa oynar", async () => {
    mockBird.mockReturnValue(false);
    expect(gate.shouldReveal("home", 1000)).toBe(true);

    mockBird.mockReturnValue(null);
    await load();
    expect(gate.shouldReveal("home", 1000)).toBe(true);
  });

  it("bayrak okunamazsa ilk kurulum sayılmaz", async () => {
    mockGetItem.mockRejectedValue(new Error("storage"));
    await load();
    expect(gate.shouldReveal("home", 1000)).toBe(true);
  });

  it("diğer ekranlar kuştan ve ilk kurulumdan etkilenmez", async () => {
    mockGetItem.mockResolvedValue(null);
    mockBird.mockReturnValue(true);
    await load();
    expect(gate.shouldReveal("letters", 1000)).toBe(true);
    expect(gate.shouldReveal("profile", 1000)).toBe(true);
  });
});
