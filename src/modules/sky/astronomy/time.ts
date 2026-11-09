import { normalizeDegrees } from "./angles";

export const J2000_JD = 2451545.0;
const UNIX_EPOCH_JD = 2440587.5;
const MS_PER_DAY = 86400000;

/**
 * UTC anı (ms) → Julian günü (Gregoryen takvim).
 * UTC, UT1 yerine kullanılır (fark < 0,9 sn ≈ 0,004°).
 * Ay ve Güneş için de TT yerine UT kullanılır: ΔT 1900-2100'de en çok ~200 sn, Ay'da ~0,03° eder, kabul edilen hatanın çok altında.
 */
export function julianDateFromUtcMs(utcMs: number): number {
  return utcMs / MS_PER_DAY + UNIX_EPOCH_JD;
}

/** J2000.0'dan beri Julian yüzyılı. */
export function julianCenturies(julianDate: number): number {
  return (julianDate - J2000_JD) / 36525;
}

/** Greenwich ortalama yıldız zamanı, derece (IAU 1982, Meeus 12.4). */
export function greenwichMeanSiderealTimeDeg(julianDate: number): number {
  const t = julianCenturies(julianDate);
  return normalizeDegrees(
    280.46061837 + 360.98564736629 * (julianDate - J2000_JD) + 0.000387933 * t * t - (t * t * t) / 38710000
  );
}

/** Yerel yıldız zamanı, derece. Boylam DOĞU +. */
export function localSiderealTimeDeg(julianDate: number, longitudeEastDeg: number): number {
  return normalizeDegrees(greenwichMeanSiderealTimeDeg(julianDate) + longitudeEastDeg);
}
