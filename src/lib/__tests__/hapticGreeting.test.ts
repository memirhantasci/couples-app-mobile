/// <reference types="jest" />
// Oturum durumu (selam verilen sekmeler, ana sayfa kararı) her testte sıfırlansın diye require ile yeniden yüklenir
/* eslint-disable @typescript-eslint/no-require-imports */

const mockHapticTap = jest.fn(() => Promise.resolve());
const mockGetItem = jest.fn<Promise<string | null>, [string]>(() => Promise.resolve("1"));
const mockSetItem = jest.fn(() => Promise.resolve());
const mockWaitForBird = jest.fn<Promise<boolean>, [number]>(() => Promise.resolve(false));

jest.mock("@/lib/soundEffects", () => ({ hapticTap: () => mockHapticTap() }));
jest.mock("@/lib/safeStorage", () => ({
  safeStorage: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (...args: unknown[]) => (mockSetItem as (...a: unknown[]) => Promise<void>)(...args),
  },
}));
jest.mock("@/lib/letterArrival", () => ({
  waitForFirstArrivalCheck: (ms: number) => mockWaitForBird(ms),
}));

type GreetingModule = typeof import("../hapticGreeting");
let greeting: GreetingModule;

/** Bekleyen söz zincirlerinin (depo okuma, kuş kontrolü) bitmesini bekler. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.resetModules();
  mockHapticTap.mockClear();
  mockGetItem.mockReset().mockResolvedValue("1");
  mockSetItem.mockClear();
  mockWaitForBird.mockReset().mockResolvedValue(false);
  greeting = require("../hapticGreeting") as GreetingModule;
});

describe("hapticGreeting: sekme selamı", () => {
  it("bir sekme ilk açıldığında tek titreşim verir, sonraki geçişlerde vermez", () => {
    greeting.greetTab("letters");
    expect(mockHapticTap).toHaveBeenCalledTimes(1);

    greeting.greetTab("letters");
    greeting.greetTab("letters");
    expect(mockHapticTap).toHaveBeenCalledTimes(1);
  });

  it("her sekme kendi selamını alır", () => {
    greeting.greetTab("letters");
    greeting.greetTab("calendar");
    greeting.greetTab("map");
    expect(mockHapticTap).toHaveBeenCalledTimes(3);

    greeting.greetTab("letters");
    greeting.greetTab("calendar");
    expect(mockHapticTap).toHaveBeenCalledTimes(3);
  });
});

describe("hapticGreeting: ana sayfa", () => {
  it("normal soğuk açılışta kuş yoksa selam verir, sonra susar", async () => {
    greeting.greetTab("home");
    await flush();
    expect(mockHapticTap).toHaveBeenCalledTimes(1);

    greeting.greetTab("home");
    await flush();
    expect(mockHapticTap).toHaveBeenCalledTimes(1);
  });

  it("ilk kurulumda sessizdir ve bayrağı yazar; kuş sonucunu beklemez", async () => {
    mockGetItem.mockResolvedValue(null);

    greeting.greetTab("home");
    await flush();
    expect(mockHapticTap).not.toHaveBeenCalled();
    expect(mockSetItem).toHaveBeenCalledWith("@haptic_home_hello_seen_v1", "1");
    expect(mockWaitForBird).not.toHaveBeenCalled();
  });

  it("ilk kurulumda ana sayfaya aynı oturumdaki dönüşlerde de sessiz kalır", async () => {
    mockGetItem.mockResolvedValue(null);

    greeting.greetTab("home");
    await flush();
    greeting.greetTab("home");
    await flush();
    expect(mockHapticTap).not.toHaveBeenCalled();
    expect(mockSetItem).toHaveBeenCalledTimes(1);
  });

  it("mektup kuşu uçacaksa o oturumda ana sayfa selamı verilmez", async () => {
    mockWaitForBird.mockResolvedValue(true);

    greeting.greetTab("home");
    await flush();
    greeting.greetTab("home");
    await flush();
    expect(mockHapticTap).not.toHaveBeenCalled();
  });

  it("kuş kontrolü beklenirken diğer sekmelerin selamı engellenmez", async () => {
    mockWaitForBird.mockReturnValue(new Promise(() => {}));

    greeting.greetTab("home");
    greeting.greetTab("letters");
    await flush();
    expect(mockHapticTap).toHaveBeenCalledTimes(1);
  });

  it("selam verilmeden sekmeden ayrılınca iptal olur, ana sayfaya dönünce verilir", async () => {
    let resolveBird: (bird: boolean) => void = () => {};
    mockWaitForBird.mockReturnValue(new Promise<boolean>((resolve) => (resolveBird = resolve)));

    const cancel = greeting.greetTab("home");
    cancel();
    resolveBird(false);
    await flush();
    expect(mockHapticTap).not.toHaveBeenCalled();

    greeting.greetTab("home");
    await flush();
    expect(mockHapticTap).toHaveBeenCalledTimes(1);
  });
});
