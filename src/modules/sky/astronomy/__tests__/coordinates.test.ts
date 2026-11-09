/// <reference types="jest" />
import { DEG_TO_RAD, RAD_TO_DEG } from "../angles";
import { findStarPosition } from "../computeSky";
import { directionKey, eclipticToEquatorial, horizontalFromHourAngle } from "../coordinates";

const LATITUDES = [-66, -33.87, -5, 0, 12, 41, 64.1];
const DECLINATIONS = [-60, -16.7, 0, 7.4, 38.8, 60];

describe("alt/az analitik değişmezleri", () => {
  it("meridyen geçişinde yükseklik = 90 − |enlem − dec|", () => {
    for (const lat of LATITUDES) {
      for (const dec of DECLINATIONS) {
        expect(Math.abs(horizontalFromHourAngle(0, dec, lat).altitude - (90 - Math.abs(lat - dec)))).toBeLessThan(0.01);
      }
    }
  });

  it("dec = enlem ve saat açısı 0 ise yıldız tepe noktasındadır", () => {
    for (const lat of LATITUDES) expect(horizontalFromHourAngle(0, lat, lat).altitude).toBeCloseTo(90, 4); // asin, 1 yakınında ~1e-6° kaybeder
  });

  it("doğuş saat açısında yükseklik ≈ 0, yıldız doğu yarısındadır", () => {
    for (const lat of [-33.87, 12, 41]) {
      for (const dec of [-16.7, 7.4, 38.8]) {
        const cosH = -Math.tan(lat * DEG_TO_RAD) * Math.tan(dec * DEG_TO_RAD);
        if (Math.abs(cosH) >= 1) continue;
        const rising = horizontalFromHourAngle(-Math.acos(cosH) * RAD_TO_DEG, dec, lat);
        expect(Math.abs(rising.altitude)).toBeLessThan(1e-6);
        expect(rising.azimuth).toBeGreaterThan(0);
        expect(rising.azimuth).toBeLessThan(180);
      }
    }
  });

  it("batıdaki yıldızın azimutu > 180°, doğudakinin < 180°", () => {
    for (const lat of LATITUDES) {
      for (const dec of DECLINATIONS) {
        if (Math.abs(lat) === Math.abs(dec)) continue;
        expect(horizontalFromHourAngle(45, dec, lat).azimuth).toBeGreaterThan(180);
        expect(horizontalFromHourAngle(-45, dec, lat).azimuth).toBeLessThan(180);
      }
    }
  });

  it("azimut kuzeyden doğuya ölçülür", () => {
    // Ekvatordaki gözlemci, dec = 0, saat açısı −90° → tam doğu ufku
    const east = horizontalFromHourAngle(-90, 0, 0);
    expect(east.azimuth).toBeCloseTo(90, 6);
    expect(east.altitude).toBeCloseTo(0, 6);
    expect(horizontalFromHourAngle(90, 0, 0).azimuth).toBeCloseTo(270, 6);
    // Kuzey yarım kürede, meridyende, tepe noktasının kuzeyindeki yıldız az=0; güneyindeki az=180
    expect(horizontalFromHourAngle(0, 60, 41).azimuth).toBeCloseTo(0, 6);
    expect(horizontalFromHourAngle(0, -10, 41).azimuth).toBeCloseTo(180, 6);
  });

  it.each([
    [41.0082, 28.9784, "2025-02-14", "22:00"],
    [64.13, -21.9, "1985-06-15", "03:00"],
    [12, 77.6, "2010-09-01", "12:00"],
  ])("Kutup Yıldızı enlem %d: yükseklik ≈ enlem, azimut ≈ kuzey", (latitude, longitude, date, time) => {
    const polaris = findStarPosition(11767, { latitude, longitude, date, time })!;
    expect(Math.abs(polaris.altitude - latitude)).toBeLessThanOrEqual(1);
    const fromNorth = Math.min(polaris.azimuth, 360 - polaris.azimuth);
    expect(fromNorth).toBeLessThan(3);
  });

  it("tutulum → ekvator: Meeus 13.a (Pollux)", () => {
    const { ra, dec } = eclipticToEquatorial(113.21563, 6.68417, 23.4392911);
    expect(ra).toBeCloseTo(116.328942, 3);
    expect(dec).toBeCloseTo(28.026183, 3);
  });
});

describe("directionKey", () => {
  it.each([
    [0, "N"],
    [22.4, "N"],
    [22.5, "NE"],
    [45, "NE"],
    [90, "E"],
    [135, "SE"],
    [180, "S"],
    [225, "SW"],
    [270, "W"],
    [315, "NW"],
    [337.4, "NW"],
    [337.5, "N"],
    [359.9, "N"],
    [-45, "NW"],
    [405, "NE"],
  ])("%d° → %s", (azimuth, key) => {
    expect(directionKey(azimuth)).toBe(key);
  });

  it("sonlu olmayan açıyı reddeder", () => {
    expect(() => directionKey(NaN)).toThrow(RangeError);
  });
});
