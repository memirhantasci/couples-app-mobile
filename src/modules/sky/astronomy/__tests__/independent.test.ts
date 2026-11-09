/// <reference types="jest" />
import * as Astronomy from "astronomy-engine";

import { SKY_STARS } from "../../data/skyStars.data";
import { computeSky, findStarPosition } from "../computeSky";
import { greenwichMeanSiderealTimeDeg, julianDateFromUtcMs } from "../time";
import type { SkyRequest } from "../types";

// Bağımsız kaynak: astronomy-engine (MIT, VSOP87/NOVAS tabanlı, yalnızca testte)

const LIMITS = { star: 0.1, moon: 1.5, sun: 0.3, illumination: 0.02, gmst: 0.01 };
const STARS = { Sirius: 32349, Betelgeuse: 27989, Vega: 91262, Polaris: 11767 };

const CASES: (SkyRequest & { label: string })[] = [
  { label: "İstanbul 1985", latitude: 41.0082, longitude: 28.9784, date: "1985-06-15", time: "23:30", timeZone: "Europe/Istanbul" },
  { label: "İstanbul 2025", latitude: 41.0082, longitude: 28.9784, date: "2025-02-14", time: "22:00", timeZone: "Europe/Istanbul" },
  { label: "Sidney 2025", latitude: -33.8688, longitude: 151.2093, date: "2025-01-15", time: "21:00", timeZone: "Australia/Sydney" },
  { label: "Santiago 1985", latitude: -33.45, longitude: -70.67, date: "1985-12-01", time: "23:00", timeZone: "America/Santiago" },
  { label: "New York 1999", latitude: 40.7128, longitude: -74.006, date: "1999-12-31", time: "23:59", timeZone: "America/New_York" },
  { label: "Reykjavik 2010", latitude: 64.13, longitude: -21.9, date: "2010-03-21", time: "03:00", timeZone: "Atlantic/Reykjavik" },
  { label: "Quito 1950", latitude: -0.18, longitude: -78.47, date: "1950-08-10", time: "20:00", timeZone: "UTC" },
  { label: "Cape Town 1905", latitude: -33.92, longitude: 18.42, date: "1905-04-02", time: "22:00", timeZone: "UTC" },
  { label: "Tokyo 2095", latitude: 35.68, longitude: 139.65, date: "2095-11-20", time: "01:15", timeZone: "UTC" },
];

function angleDifference(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function horizonOf(body: Astronomy.Body, date: Date, request: SkyRequest) {
  const observer = new Astronomy.Observer(request.latitude, request.longitude, 0);
  const equator = Astronomy.Equator(body, date, observer, true, true);
  return Astronomy.Horizon(date, observer, equator.ra, equator.dec);
}

const worst = { starAlt: 0, starAz: 0, moonAlt: 0, moonAz: 0, sunAlt: 0, illumination: 0, gmst: 0 };

afterAll(() => {
  if (process.env.SKY_REPORT) console.log(`En büyük sapmalar: ${JSON.stringify(worst)}`);
});

describe("astronomy-engine ile karşılaştırma", () => {
  describe.each(CASES)("$label", (request) => {
    const result = computeSky(request);
    const date = new Date(result.utcIso);

    it.each(Object.entries(STARS))("%s alt/az farkı < 0.1°", (_name, hip) => {
      const row = SKY_STARS.find((star) => star[0] === hip)!;
      Astronomy.DefineStar(Astronomy.Body.Star1, row[1] / 15, row[2], 1000);
      const reference = horizonOf(Astronomy.Body.Star1, date, request);
      const ours = findStarPosition(hip, request)!;
      const altDiff = Math.abs(ours.altitude - reference.altitude);
      const azDiff = angleDifference(ours.azimuth, reference.azimuth);
      worst.starAlt = Math.max(worst.starAlt, altDiff);
      worst.starAz = Math.max(worst.starAz, azDiff);
      expect(altDiff).toBeLessThan(LIMITS.star);
      expect(azDiff).toBeLessThan(LIMITS.star);
    });

    it("Ay, Güneş, aydınlanma ve GMST", () => {
      const moon = horizonOf(Astronomy.Body.Moon, date, request);
      const sun = horizonOf(Astronomy.Body.Sun, date, request);
      const illumination = Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction;
      const gastDeg = Astronomy.SiderealTime(date) * 15;

      const diffs = {
        moonAlt: Math.abs(result.moon.altitude - moon.altitude),
        moonAz: angleDifference(result.moon.azimuth, moon.azimuth),
        sunAlt: Math.abs(result.sun.altitude - sun.altitude),
        illumination: Math.abs(result.moon.illumination - illumination),
        gmst: angleDifference(greenwichMeanSiderealTimeDeg(julianDateFromUtcMs(date.getTime())), gastDeg),
      };
      for (const key of Object.keys(diffs) as (keyof typeof diffs)[]) worst[key] = Math.max(worst[key], diffs[key]);

      expect(diffs.moonAlt).toBeLessThan(LIMITS.moon);
      expect(diffs.moonAz).toBeLessThan(LIMITS.moon);
      expect(diffs.sunAlt).toBeLessThan(LIMITS.sun);
      expect(diffs.illumination).toBeLessThan(LIMITS.illumination);
      expect(diffs.gmst).toBeLessThan(LIMITS.gmst);
    });
  });

  it("1900-2100 taraması: Ay, Güneş, aydınlanma", () => {
    const stepDays = 613.37; // Ay ve Güneş evreleriyle eşlenik olmayan adım
    const start = Date.UTC(1900, 0, 2, 6);
    const end = Date.UTC(2100, 11, 30);
    let samples = 0;
    for (let ms = start, i = 0; ms < end; ms += stepDays * 86400000, i++) {
      const date = new Date(ms);
      const request: SkyRequest = {
        latitude: -70 + ((i * 37) % 140),
        longitude: -180 + ((i * 53) % 360),
        date: date.toISOString().slice(0, 10),
        time: date.toISOString().slice(11, 16),
        timeZone: "UTC",
      };
      const result = computeSky(request);
      const instant = new Date(result.utcIso);
      const moon = horizonOf(Astronomy.Body.Moon, instant, request);
      const sun = horizonOf(Astronomy.Body.Sun, instant, request);
      const illumination = Astronomy.Illumination(Astronomy.Body.Moon, instant).phase_fraction;

      const moonAlt = Math.abs(result.moon.altitude - moon.altitude);
      const sunAlt = Math.abs(result.sun.altitude - sun.altitude);
      const illuminationDiff = Math.abs(result.moon.illumination - illumination);
      worst.moonAlt = Math.max(worst.moonAlt, moonAlt);
      worst.sunAlt = Math.max(worst.sunAlt, sunAlt);
      worst.illumination = Math.max(worst.illumination, illuminationDiff);

      expect(moonAlt).toBeLessThan(LIMITS.moon);
      // Tepe noktasına yakın azimut anlamsızlaşır
      if (Math.abs(moon.altitude) < 75) {
        const moonAz = angleDifference(result.moon.azimuth, moon.azimuth);
        worst.moonAz = Math.max(worst.moonAz, moonAz);
        expect(moonAz).toBeLessThan(LIMITS.moon);
      }
      expect(sunAlt).toBeLessThan(LIMITS.sun);
      expect(illuminationDiff).toBeLessThan(LIMITS.illumination);
      samples++;
    }
    expect(samples).toBeGreaterThan(100);
  });
});
