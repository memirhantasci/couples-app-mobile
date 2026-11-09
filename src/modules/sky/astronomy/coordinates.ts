import { clampUnit, DEG_TO_RAD, normalizeDegrees, RAD_TO_DEG } from "./angles";
import type { EquatorialPosition } from "./precession";
import type { SkyDirectionKey, SkyHorizontalPosition } from "./types";

const DIRECTION_KEYS: readonly SkyDirectionKey[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/**
 * Saat açısı + dik açıklık → yükseklik ve azimut.
 * Azimut KUZEYDEN DOĞUYA ölçülür (N=0, E=90; Meeus'un güneyden ölçümü değil).
 * Atmosferik kırılma uygulanmaz: poster geometrik gökyüzünü gösterir (fark yalnızca ufka yakın, ≲ 0,6°).
 */
export function horizontalFromHourAngle(hourAngleDeg: number, decDeg: number, latitudeDeg: number): SkyHorizontalPosition {
  const h = hourAngleDeg * DEG_TO_RAD;
  const dec = decDeg * DEG_TO_RAD;
  const lat = latitudeDeg * DEG_TO_RAD;
  const sinDec = Math.sin(dec);
  const cosDec = Math.cos(dec);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const cosH = Math.cos(h);
  return {
    altitude: Math.asin(clampUnit(sinLat * sinDec + cosLat * cosDec * cosH)) * RAD_TO_DEG,
    azimuth: normalizeDegrees(Math.atan2(-cosDec * Math.sin(h), sinDec * cosLat - cosDec * sinLat * cosH) * RAD_TO_DEG),
  };
}

export function equatorialToHorizontal(
  raDeg: number,
  decDeg: number,
  latitudeDeg: number,
  localSiderealDeg: number
): SkyHorizontalPosition {
  return horizontalFromHourAngle(localSiderealDeg - raDeg, decDeg, latitudeDeg);
}

/** Tutulumun ortalama eğimi, derece (Meeus 22.2). */
export function meanObliquityDeg(julianCenturiesFromJ2000: number): number {
  const t = julianCenturiesFromJ2000;
  return 23 + 26 / 60 + (21.448 - 46.815 * t - 0.00059 * t * t + 0.001813 * t * t * t) / 3600;
}

/** Tutulum koordinatları → tarihin ekvatoru (Meeus 13.3, 13.4). */
export function eclipticToEquatorial(longitudeDeg: number, latitudeDeg: number, obliquityDeg: number): EquatorialPosition {
  const lon = longitudeDeg * DEG_TO_RAD;
  const lat = latitudeDeg * DEG_TO_RAD;
  const eps = obliquityDeg * DEG_TO_RAD;
  const sinLon = Math.sin(lon);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinEps = Math.sin(eps);
  const cosEps = Math.cos(eps);
  return {
    ra: normalizeDegrees(Math.atan2(sinLon * cosLat * cosEps - sinLat * sinEps, Math.cos(lon) * cosLat) * RAD_TO_DEG),
    dec: Math.asin(clampUnit(sinLat * cosEps + cosLat * sinEps * sinLon)) * RAD_TO_DEG,
  };
}

/** Azimuttan 8 yönlü i18n anahtarı (her yön ±22,5°). */
export function directionKey(azimuthDeg: number): SkyDirectionKey {
  if (!Number.isFinite(azimuthDeg)) throw new RangeError("azimuth must be finite");
  return DIRECTION_KEYS[Math.floor((normalizeDegrees(azimuthDeg) + 22.5) / 45) % 8];
}
