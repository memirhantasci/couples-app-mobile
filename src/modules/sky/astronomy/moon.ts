import { clampUnit, DEG_TO_RAD, normalizeDegrees, RAD_TO_DEG } from "./angles";
import { eclipticToEquatorial, meanObliquityDeg } from "./coordinates";
import type { EquatorialPosition } from "./precession";
import { sunPosition } from "./sun";
import { julianCenturies } from "./time";
import type { MoonPhaseName } from "./types";

const KM_PER_AU = 149597870.7;
const EARTH_RADIUS_KM = 6378.14;

// Meeus Tablo 47.A'nın baş terimleri: D, M, M', F, Σl (1e-6°), Σr (1e-3 km)
const LONGITUDE_DISTANCE_TERMS: readonly (readonly [number, number, number, number, number, number])[] = [
  [0, 0, 1, 0, 6288774, -20905355],
  [2, 0, -1, 0, 1274027, -3699111],
  [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925],
  [0, 1, 0, 0, -185116, 48888],
  [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158],
  [2, -1, -1, 0, 57066, -152138],
  [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586],
  [0, 1, -1, 0, -40923, -129620],
  [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755],
  [2, 0, 0, -2, 15327, 10321],
  [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661],
  [4, 0, -1, 0, 10675, -34782],
  [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636],
  [2, 1, -1, 0, -7888, 24208],
  [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379],
  [1, 1, 0, 0, 4987, -16675],
  [2, -1, 1, 0, 4036, -12831],
];

// Meeus Tablo 47.B'nin baş terimleri: D, M, M', F, Σb (1e-6°)
const LATITUDE_TERMS: readonly (readonly [number, number, number, number, number])[] = [
  [0, 0, 0, 1, 5128122],
  [0, 0, 1, 1, 280602],
  [0, 0, 1, -1, 277693],
  [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413],
  [2, 0, -1, -1, 46271],
  [2, 0, 0, 1, 32573],
  [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266],
  [0, 0, 2, -1, 8822],
  [2, -1, 0, -1, 8216],
  [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200],
  [2, 1, 0, -1, -3359],
];

export interface MoonEclipticPosition {
  longitude: number;
  latitude: number;
  distanceKm: number;
  /** Ekvatoral yatay paralaks, derece */
  parallaxDeg: number;
}

export interface MoonPhase {
  illumination: number;
  phaseName: MoonPhaseName;
  waxing: boolean;
  /** Ay boylamı − Güneş boylamı, [0, 360) */
  elongationDeg: number;
}

/** Yermerkezli konum (Meeus 47, baş terimler; tam seriye göre hata ~0,03°, gereken ~1°). Nütasyon yok sayılır. */
export function moonEcliptic(julianDate: number): MoonEclipticPosition {
  const t = julianCenturies(julianDate);
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;

  const meanLongitude = 218.3164477 + 481267.88123421 * t - 0.0015786 * t2 + t3 / 538841 - t4 / 65194000;
  const elongation = (297.8501921 + 445267.1114034 * t - 0.0018819 * t2 + t3 / 545868 - t4 / 113065000) * DEG_TO_RAD;
  const sunAnomaly = (357.5291092 + 35999.0502909 * t - 0.0001536 * t2 + t3 / 24490000) * DEG_TO_RAD;
  const moonAnomaly = (134.9633964 + 477198.8675055 * t + 0.0087414 * t2 + t3 / 69699 - t4 / 14712000) * DEG_TO_RAD;
  const argLatitude = (93.272095 + 483202.0175233 * t - 0.0036539 * t2 - t3 / 3526000 + t4 / 863310000) * DEG_TO_RAD;
  const a1 = (119.75 + 131.849 * t) * DEG_TO_RAD;
  const a2 = (53.09 + 479264.29 * t) * DEG_TO_RAD;
  const a3 = (313.45 + 481266.484 * t) * DEG_TO_RAD;
  const eccentricityFactor = 1 - 0.002516 * t - 0.0000074 * t2;
  const lPrime = meanLongitude * DEG_TO_RAD;

  // Güneş anomalisi içeren terimler Dünya yörüngesinin dış merkezliğiyle ölçeklenir (E^|M|)
  const eFactor = (m: number) => (m === 0 ? 1 : Math.abs(m) === 1 ? eccentricityFactor : eccentricityFactor * eccentricityFactor);

  let sumL = 3958 * Math.sin(a1) + 1962 * Math.sin(lPrime - argLatitude) + 318 * Math.sin(a2);
  let sumR = 0;
  for (const [d, m, mp, f, l, r] of LONGITUDE_DISTANCE_TERMS) {
    const arg = d * elongation + m * sunAnomaly + mp * moonAnomaly + f * argLatitude;
    const e = eFactor(m);
    sumL += l * e * Math.sin(arg);
    sumR += r * e * Math.cos(arg);
  }

  let sumB =
    -2235 * Math.sin(lPrime) +
    382 * Math.sin(a3) +
    175 * Math.sin(a1 - argLatitude) +
    175 * Math.sin(a1 + argLatitude) +
    127 * Math.sin(lPrime - moonAnomaly) -
    115 * Math.sin(lPrime + moonAnomaly);
  for (const [d, m, mp, f, b] of LATITUDE_TERMS) {
    sumB += b * eFactor(m) * Math.sin(d * elongation + m * sunAnomaly + mp * moonAnomaly + f * argLatitude);
  }

  const distanceKm = 385000.56 + sumR / 1000;
  return {
    longitude: normalizeDegrees(meanLongitude + sumL / 1e6),
    latitude: sumB / 1e6,
    distanceKm,
    parallaxDeg: Math.asin(EARTH_RADIUS_KM / distanceKm) * RAD_TO_DEG,
  };
}

export function moonEquatorial(position: MoonEclipticPosition, julianDate: number): EquatorialPosition {
  return eclipticToEquatorial(position.longitude, position.latitude, meanObliquityDeg(julianCenturies(julianDate)));
}

/**
 * Yermerkezli yükseklikten gözlemciye göre yüksekliğe geçişteki paralaks farkı (derece).
 * Küresel Dünya için kesin: tan p = sin π · cos h / (1 − sin π · sin h). Ufukta ~1°, tepe noktasında 0.
 * Küresel modelde azimut değişmez; basıklığın etkisi 0,1°'nin altındadır.
 */
export function lunarParallaxInAltitude(geocentricAltitudeDeg: number, parallaxDeg: number): number {
  const sinParallax = Math.sin(parallaxDeg * DEG_TO_RAD);
  const altitude = geocentricAltitudeDeg * DEG_TO_RAD;
  return Math.atan2(sinParallax * Math.cos(altitude), 1 - sinParallax * Math.sin(altitude)) * RAD_TO_DEG;
}

/**
 * Evre adı, Ay−Güneş boylam farkından. Asıl dört evre ±6° (ortalama ±0,5 gün, yani yaklaşık bir takvim günü) dar pencere alır;
 * aradaki geniş dilimler hilal ve şişkin evrelerdir. Sınırın alt ucu sonraki evreye aittir.
 */
export function moonPhaseName(elongationDeg: number): MoonPhaseName {
  const e = normalizeDegrees(elongationDeg);
  if (e < 6 || e >= 354) return "new";
  if (e < 84) return "waxingCrescent";
  if (e < 96) return "firstQuarter";
  if (e < 174) return "waxingGibbous";
  if (e < 186) return "full";
  if (e < 264) return "waningGibbous";
  if (e < 276) return "lastQuarter";
  return "waningCrescent";
}

/** Aydınlanma kesri (Meeus 48.2-48.4) ve evre. Yermerkezli hesap: gözlemci konumunun etkisi ihmal edilebilir. */
export function moonPhase(julianDate: number, position: MoonEclipticPosition = moonEcliptic(julianDate)): MoonPhase {
  const sun = sunPosition(julianDate);
  const elongationDeg = normalizeDegrees(position.longitude - sun.longitude);
  const cosPsi = clampUnit(
    Math.cos(position.latitude * DEG_TO_RAD) * Math.cos((position.longitude - sun.longitude) * DEG_TO_RAD)
  );
  const psi = Math.acos(cosPsi);
  const sunKm = sun.distanceAu * KM_PER_AU;
  const phaseAngle = Math.atan2(sunKm * Math.sin(psi), position.distanceKm - sunKm * cosPsi);
  return {
    illumination: (1 + Math.cos(phaseAngle)) / 2,
    phaseName: moonPhaseName(elongationDeg),
    waxing: elongationDeg < 180,
    elongationDeg,
  };
}
