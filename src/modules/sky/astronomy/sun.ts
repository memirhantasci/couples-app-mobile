import { DEG_TO_RAD, normalizeDegrees } from "./angles";
import { eclipticToEquatorial, meanObliquityDeg } from "./coordinates";
import type { EquatorialPosition } from "./precession";
import { julianCenturies } from "./time";
import type { SkyTwilight } from "./types";

export interface SunPosition extends EquatorialPosition {
  /** Görünür tutulum boylamı, derece */
  longitude: number;
  /** Dünya-Güneş uzaklığı, AB */
  distanceAu: number;
}

/** Güneş'in tarihin ekvatorundaki görünür konumu (Meeus 25, düşük duyarlık: ~0,01°). */
export function sunPosition(julianDate: number): SunPosition {
  const t = julianCenturies(julianDate);
  const meanLongitude = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
  const anomalyDeg = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
  const eccentricity = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;
  const m = anomalyDeg * DEG_TO_RAD;
  const center =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(m) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * m) +
    0.000289 * Math.sin(3 * m);
  const trueAnomaly = (anomalyDeg + center) * DEG_TO_RAD;
  const distanceAu = (1.000001018 * (1 - eccentricity * eccentricity)) / (1 + eccentricity * Math.cos(trueAnomaly));
  const omega = (125.04 - 1934.136 * t) * DEG_TO_RAD;
  const longitude = normalizeDegrees(meanLongitude + center - 0.00569 - 0.00478 * Math.sin(omega));
  const obliquity = meanObliquityDeg(t) + 0.00256 * Math.cos(omega);
  return { ...eclipticToEquatorial(longitude, 0, obliquity), longitude, distanceAu };
}

/** Eşikler: gün > −0,833° (gün doğumu tanımı), sivil > −6°, deniz > −12°, astronomik > −18°, aksi gece. */
export function twilightFromAltitude(altitudeDeg: number): SkyTwilight {
  if (altitudeDeg > -0.833) return "day";
  if (altitudeDeg > -6) return "civil";
  if (altitudeDeg > -12) return "nautical";
  if (altitudeDeg > -18) return "astronomical";
  return "night";
}
