import { clampUnit, DEG_TO_RAD, normalizeDegrees, RAD_TO_DEG } from "./angles";
import { julianCenturies } from "./time";

export interface EquatorialPosition {
  /** Sağ açıklık, derece */
  ra: number;
  /** Dik açıklık, derece */
  dec: number;
}

export interface PrecessionAngles {
  sinTheta: number;
  cosTheta: number;
  zetaDeg: number;
  zDeg: number;
}

/** J2000.0'dan verilen tarihe presesyon açıları (Meeus 21.3, başlangıç devri J2000 olduğu için T = 0). */
export function precessionAngles(julianDate: number): PrecessionAngles {
  const t = julianCenturies(julianDate);
  const t2 = t * t;
  const t3 = t2 * t;
  const zetaArcsec = 2306.2181 * t + 0.30188 * t2 + 0.017998 * t3;
  const zArcsec = 2306.2181 * t + 1.09468 * t2 + 0.018203 * t3;
  const thetaArcsec = 2004.3109 * t - 0.42665 * t2 - 0.041833 * t3;
  const thetaRad = (thetaArcsec / 3600) * DEG_TO_RAD;
  return {
    sinTheta: Math.sin(thetaRad),
    cosTheta: Math.cos(thetaRad),
    zetaDeg: zetaArcsec / 3600,
    zDeg: zArcsec / 3600,
  };
}

/**
 * J2000 konumunu tarihin ortalama ekvatoruna getirir (Meeus 21.4, titiz dönüşüm).
 * Açılar yıldız başına yeniden hesaplanmasın diye ayrı verilir.
 * Öz hareket uygulanmaz (veride yok): 1900-2100 aralığında en hızlı parlak yıldızlarda bile açı dakikaları
 * düzeyindedir, poster ölçeğinde görünmez. Nütasyon ve sapınç da (her biri ≲ 0,006°) yok sayılır.
 */
export function applyPrecession(raDeg: number, decDeg: number, angles: PrecessionAngles): EquatorialPosition {
  const raPlusZeta = (raDeg + angles.zetaDeg) * DEG_TO_RAD;
  const decRad = decDeg * DEG_TO_RAD;
  const cosDec = Math.cos(decRad);
  const sinDec = Math.sin(decRad);
  const cosRa = Math.cos(raPlusZeta);
  const a = cosDec * Math.sin(raPlusZeta);
  const b = angles.cosTheta * cosDec * cosRa - angles.sinTheta * sinDec;
  const c = angles.sinTheta * cosDec * cosRa + angles.cosTheta * sinDec;
  return {
    ra: normalizeDegrees(Math.atan2(a, b) * RAD_TO_DEG + angles.zDeg),
    dec: Math.asin(clampUnit(c)) * RAD_TO_DEG,
  };
}

export function precessFromJ2000(raDeg: number, decDeg: number, julianDate: number): EquatorialPosition {
  return applyPrecession(raDeg, decDeg, precessionAngles(julianDate));
}
