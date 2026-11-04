/// <reference types="jest" />
// İlk kontrol sonucu modül düzeyinde tutulur: her testte sıfırlansın diye require ile yeniden yüklenir
/* eslint-disable @typescript-eslint/no-require-imports */

jest.mock("@/lib/supabase", () => ({ supabase: {} }));
jest.mock("@/lib/safeStorage", () => ({
  safeStorage: { getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) },
}));

type ArrivalModule = typeof import("../letterArrival");
let arrival: ArrivalModule;

beforeEach(() => {
  jest.useFakeTimers();
  jest.resetModules();
  arrival = require("../letterArrival") as ArrivalModule;
});

afterEach(() => {
  jest.useRealTimers();
});

describe("letterArrival: ilk kontrol sonucu", () => {
  it("sonuç bildirilince bekleyenler onunla çözülür", async () => {
    const first = arrival.waitForFirstArrivalCheck(4000);
    const second = arrival.waitForFirstArrivalCheck(4000);

    arrival.reportFirstArrivalCheck(true);
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
  });

  it("sonuç zaten bildirilmişse beklemeden döner", async () => {
    arrival.reportFirstArrivalCheck(false);
    await expect(arrival.waitForFirstArrivalCheck(4000)).resolves.toBe(false);
  });

  it("yalnızca ilk bildirim sayılır", async () => {
    arrival.reportFirstArrivalCheck(false);
    arrival.reportFirstArrivalCheck(true);
    await expect(arrival.waitForFirstArrivalCheck(4000)).resolves.toBe(false);
  });

  it("kontrol hiç çalışmazsa süre dolunca kuş yok sayılır", async () => {
    const pending = arrival.waitForFirstArrivalCheck(4000);
    jest.advanceTimersByTime(4000);
    await expect(pending).resolves.toBe(false);
  });

  it("süre dolduktan sonra gelen sonuç eski bekleyeni etkilemez, sonrakiler onu görür", async () => {
    const pending = arrival.waitForFirstArrivalCheck(1000);
    jest.advanceTimersByTime(1000);
    await expect(pending).resolves.toBe(false);

    arrival.reportFirstArrivalCheck(true);
    await expect(arrival.waitForFirstArrivalCheck(1000)).resolves.toBe(true);
  });
});
