/// <reference types="jest" />
import {
  DEFAULT_CYCLE_LENGTH,
  PERIOD_DURATION_DAYS,
  estimateCycleLength,
  getPeriodDays,
  getPeriodStarts,
} from "../periodCycle";

jest.mock("@react-native-async-storage/async-storage", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

describe("getPeriodStarts", () => {
  it("tarihleri sıralar ve her regl için yalnızca ilk günü başlangıç sayar", () => {
    // Eski sürümde ardışık günler tek tek kaydediliyordu
    expect(getPeriodStarts(["2026-03-02", "2026-03-01", "2026-03-03", "2026-03-30", "2026-03-31"])).toEqual([
      "2026-03-01",
      "2026-03-30",
    ]);
  });

  it("boş listede boş döner", () => {
    expect(getPeriodStarts([])).toEqual([]);
  });

  it("16 gün ve üzeri aralığı yeni başlangıç sayar", () => {
    expect(getPeriodStarts(["2026-03-01", "2026-03-17"])).toEqual(["2026-03-01", "2026-03-17"]);
    expect(getPeriodStarts(["2026-03-01", "2026-03-16"])).toEqual(["2026-03-01"]);
  });
});

describe("estimateCycleLength", () => {
  it("tek kayıtta ya da kayıt yokken 28 gün varsayar", () => {
    expect(estimateCycleLength([])).toBe(DEFAULT_CYCLE_LENGTH);
    expect(estimateCycleLength(["2026-03-01"])).toBe(DEFAULT_CYCLE_LENGTH);
  });

  it("uygun aralıkların ortalamasını alır", () => {
    // 30 ve 32 gün → 31
    expect(estimateCycleLength(["2026-01-01", "2026-01-31", "2026-03-04"])).toBe(31);
  });

  it("21-35 gün dışındaki aralıkları (atlanmış kayıt) yok sayar", () => {
    // 60 gün atlanmış kayıttan doğar, 28 günlük aralık kalır
    expect(estimateCycleLength(["2026-01-01", "2026-03-02", "2026-03-30"])).toBe(28);
    // Hiç uygun aralık yoksa varsayılan
    expect(estimateCycleLength(["2026-01-01", "2026-03-02"])).toBe(DEFAULT_CYCLE_LENGTH);
  });

  it("yalnızca son altı aralığa bakar", () => {
    const starts = ["2026-01-01"];
    // 8 aralık: ilk ikisi 21 gün, sonraki altısı 35 gün
    const gaps = [21, 21, 35, 35, 35, 35, 35, 35];
    let current = new Date("2026-01-01T00:00:00Z");
    for (const gap of gaps) {
      current = new Date(current.getTime() + gap * 24 * 3600 * 1000);
      starts.push(current.toISOString().substring(0, 10));
    }
    expect(estimateCycleLength(starts)).toBe(35);
  });
});

describe("getPeriodDays", () => {
  it("başlangıç dahil süreç boyunca gün listesi döner", () => {
    const days = getPeriodDays("2026-02-26");
    expect(days).toHaveLength(PERIOD_DURATION_DAYS);
    expect(days).toEqual(["2026-02-26", "2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
  });
});
