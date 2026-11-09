/// <reference types="jest" />
import { SKY_CONSTELLATIONS } from "../../data/skyConstellationLines.data";
import { computeSky, findStarPosition, SkyInputError, type SkyInputErrorCode, type SkyRequest } from "../index";

const ISTANBUL: SkyRequest = { latitude: 41.0082, longitude: 28.9784, date: "2025-02-14", time: "22:00" };

describe("computeSky uçtan uca", () => {
  const result = computeSky(ISTANBUL);

  it("ufkun üstündeki yıldız sayısı makuldür", () => {
    expect(result.stars.length).toBeGreaterThanOrEqual(1200);
    expect(result.stars.length).toBeLessThanOrEqual(1700);
  });

  it("zaman alanları doğrudur", () => {
    expect(result.utcIso).toBe("2025-02-14T19:00:00.000Z");
    expect(result.timeZone).toBe("Europe/Istanbul");
    expect(result.timeZoneSource).toBe("lookup");
    expect(result.utcOffsetMinutes).toBe(180);
    expect(result.timeAmbiguity).toBeNull();
    expect(result.julianDate).toBeCloseTo(2460721.291667, 5);
    expect(result.localSiderealTimeDeg).toBeGreaterThanOrEqual(0);
    expect(result.localSiderealTimeDeg).toBeLessThan(360);
  });

  it("tüm yıldızlar birim dairede ve ufkun üstündedir", () => {
    for (const star of result.stars) {
      expect(star.altitude).toBeGreaterThan(0);
      expect(star.azimuth).toBeGreaterThanOrEqual(0);
      expect(star.azimuth).toBeLessThan(360);
      expect(star.x * star.x + star.y * star.y).toBeLessThanOrEqual(1);
    }
  });

  it("kenarlar yalnızca iki ucu üstte olanlardır ve hepsi çıktıdadır", () => {
    const visible = new Set(result.stars.map((star) => star.hip));
    let expected = 0;
    for (const c of SKY_CONSTELLATIONS) for (const [a, b] of c.segments) if (visible.has(a) && visible.has(b)) expected++;
    expect(result.segments).toHaveLength(expected);
    expect(expected).toBeGreaterThan(0);
    expect(expected).toBeLessThan(674);

    const positions = new Set(result.stars.map((star) => `${star.x},${star.y}`));
    for (const segment of result.segments) {
      expect(positions.has(`${segment.x1},${segment.y1}`)).toBe(true);
      expect(positions.has(`${segment.x2},${segment.y2}`)).toBe(true);
      expect(segment.x1 * segment.x1 + segment.y1 * segment.y1).toBeLessThanOrEqual(1);
      expect(segment.x2 * segment.x2 + segment.y2 * segment.y2).toBeLessThanOrEqual(1);
    }
  });

  it("aynı girdi aynı çıktıyı verir", () => {
    expect(computeSky(ISTANBUL)).toEqual(result);
  });

  it("Ay alanları tutarlıdır", () => {
    const { moon } = result;
    expect(moon.illumination).toBeGreaterThanOrEqual(0);
    expect(moon.illumination).toBeLessThanOrEqual(1);
    expect(moon.aboveHorizon).toBe(moon.altitude > 0);
    expect(Math.hypot(moon.x, moon.y)).toBeCloseTo((90 - moon.altitude) / 90, 9);
  });

  it("öğlen gündüz, gece yarısı gecedir", () => {
    expect(computeSky({ ...ISTANBUL, date: "2025-06-21", time: "13:00" }).sun.twilight).toBe("day");
    expect(computeSky({ ...ISTANBUL, date: "2025-06-22", time: "01:00" }).sun.twilight).toBe("night");
  });

  it("aralık sınırları kabul edilir", () => {
    expect(computeSky({ ...ISTANBUL, date: "1900-01-01", time: "00:00" }).stars.length).toBeGreaterThan(0);
    expect(computeSky({ ...ISTANBUL, date: "2100-12-31", time: "23:59" }).stars.length).toBeGreaterThan(0);
    expect(computeSky({ ...ISTANBUL, date: "2024-02-29" }).stars.length).toBeGreaterThan(0);
  });
});

describe("findStarPosition", () => {
  it("computeSky ile aynı konumu verir", () => {
    const sky = computeSky(ISTANBUL);
    const visible = sky.stars[100];
    const position = findStarPosition(visible.hip, ISTANBUL)!;
    expect(position.altitude).toBe(visible.altitude);
    expect(position.azimuth).toBe(visible.azimuth);
    expect(position.aboveHorizon).toBe(true);
  });

  it("ufkun altındaki yıldızı da döner", () => {
    // Güney Haçı'nın parlak yıldızı (Acrux) İstanbul'dan hiç görünmez
    const acrux = findStarPosition(60718, ISTANBUL)!;
    expect(acrux.aboveHorizon).toBe(false);
    expect(acrux.altitude).toBeLessThan(0);
  });

  it("katalogda olmayan HIP için null", () => {
    expect(findStarPosition(999999999, ISTANBUL)).toBeNull();
    expect(findStarPosition(-1, ISTANBUL)).toBeNull();
    expect(findStarPosition(1.5, ISTANBUL)).toBeNull();
  });

  it("geçersiz istekte hata verir", () => {
    expect(() => findStarPosition(32349, { ...ISTANBUL, date: "yok" })).toThrow(SkyInputError);
  });
});

describe("hata yolları", () => {
  it.each<[string, Partial<SkyRequest>, SkyInputErrorCode]>([
    ["biçimsiz tarih", { date: "14.02.2025" }, "INVALID_DATE"],
    ["kısa tarih", { date: "2025-2-14" }, "INVALID_DATE"],
    ["ay 13", { date: "2025-13-01" }, "INVALID_DATE"],
    ["ay 0", { date: "2025-00-01" }, "INVALID_DATE"],
    ["30 Şubat", { date: "2025-02-30" }, "INVALID_DATE"],
    ["artık olmayan 29 Şubat", { date: "2025-02-29" }, "INVALID_DATE"],
    ["1900 artık yıl değil", { date: "1900-02-29" }, "INVALID_DATE"],
    ["ISO zamanlı tarih", { date: "2025-02-14T00:00" }, "INVALID_DATE"],
    ["boş tarih", { date: "" }, "INVALID_DATE"],
    ["biçimsiz saat", { time: "22.00" }, "INVALID_TIME"],
    ["saat 24", { time: "24:00" }, "INVALID_TIME"],
    ["dakika 60", { time: "22:60" }, "INVALID_TIME"],
    ["tek haneli saat", { time: "9:00" }, "INVALID_TIME"],
    ["saniyeli saat", { time: "22:00:00" }, "INVALID_TIME"],
    ["enlem 91", { latitude: 91 }, "INVALID_LOCATION"],
    ["enlem -91", { latitude: -91 }, "INVALID_LOCATION"],
    ["boylam 181", { longitude: 181 }, "INVALID_LOCATION"],
    ["boylam -181", { longitude: -181 }, "INVALID_LOCATION"],
    ["enlem NaN", { latitude: NaN }, "INVALID_LOCATION"],
    ["boylam sonsuz", { longitude: Infinity }, "INVALID_LOCATION"],
    ["enlem metin", { latitude: "41" as unknown as number }, "INVALID_LOCATION"],
    ["1899", { date: "1899-12-31" }, "OUT_OF_RANGE"],
    ["2101", { date: "2101-01-01" }, "OUT_OF_RANGE"],
  ])("%s", (_label, patch, code) => {
    let caught: unknown;
    try {
      computeSky({ ...ISTANBUL, ...patch });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SkyInputError);
    expect((caught as SkyInputError).code).toBe(code);
  });
});
