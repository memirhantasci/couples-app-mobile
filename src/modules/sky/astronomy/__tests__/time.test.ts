/// <reference types="jest" />
import { normalizeDegrees } from "../angles";
import { greenwichMeanSiderealTimeDeg, julianDateFromUtcMs, localSiderealTimeDeg } from "../time";

describe("Julian günü", () => {
  it("J2000 anı 2451545.0'dır", () => {
    expect(julianDateFromUtcMs(Date.UTC(2000, 0, 1, 12))).toBe(2451545.0);
  });

  it("Meeus 7.a ve 7.b örnekleriyle aynıdır", () => {
    expect(julianDateFromUtcMs(Date.UTC(1987, 0, 27))).toBe(2446822.5);
    expect(julianDateFromUtcMs(Date.UTC(1957, 9, 4, 19, 26, 24))).toBeCloseTo(2436116.31, 6);
    expect(julianDateFromUtcMs(Date.UTC(1900, 0, 1))).toBe(2415020.5);
  });
});

describe("yıldız zamanı", () => {
  it("J2000'de GMST = 280.46061837° (18.697374558 saat)", () => {
    const gmst = greenwichMeanSiderealTimeDeg(2451545.0);
    expect(Math.abs(gmst - 280.46061837)).toBeLessThan(1e-6);
    expect(Math.abs(gmst / 15 - 18.697374558)).toBeLessThan(1e-6);
  });

  it("Meeus 12.a ve 12.b örnekleriyle aynıdır", () => {
    // 1987-04-10 00:00 UT → 13s 10d 46.3668sn
    const expectedA = (13 + 10 / 60 + 46.3668 / 3600) * 15;
    expect(Math.abs(greenwichMeanSiderealTimeDeg(julianDateFromUtcMs(Date.UTC(1987, 3, 10))) - expectedA)).toBeLessThan(1e-5);
    // 1987-04-10 19:21:00 UT → 8s 34d 57.0896sn
    const expectedB = (8 + 34 / 60 + 57.0896 / 3600) * 15;
    expect(Math.abs(greenwichMeanSiderealTimeDeg(julianDateFromUtcMs(Date.UTC(1987, 3, 10, 19, 21))) - expectedB)).toBeLessThan(1e-5);
  });

  it("LST = GMST + doğu boylam, [0,360) içinde", () => {
    const jd = 2451545.0;
    expect(localSiderealTimeDeg(jd, 90)).toBeCloseTo(10.46061837, 6);
    expect(localSiderealTimeDeg(jd, -90)).toBeCloseTo(190.46061837, 6);
  });

  it("açı normalleştirme sınırları", () => {
    expect(normalizeDegrees(360)).toBe(0);
    expect(normalizeDegrees(-1e-15)).toBeLessThan(360);
    expect(normalizeDegrees(-90)).toBe(270);
    expect(normalizeDegrees(725)).toBe(5);
  });
});
