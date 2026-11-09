import { DEG_TO_RAD } from "./angles";

export interface ProjectedPoint {
  x: number;
  y: number;
}

/**
 * Azimutal eşit-uzaklıklı izdüşüm, tepe noktası merkezde: r = (90 − yükseklik) / 90, ufuk r = 1.
 * Ekran koordinatı, y AŞAĞI. Gökyüzüne bakarken: kuzey üstte, DOĞU SOLDA (x = −r·sin az).
 */
export function projectHorizontal(altitudeDeg: number, azimuthDeg: number): ProjectedPoint {
  const r = (90 - altitudeDeg) / 90;
  const az = azimuthDeg * DEG_TO_RAD;
  return { x: -r * Math.sin(az), y: -r * Math.cos(az) };
}
