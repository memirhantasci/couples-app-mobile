import { projectHorizontal } from "../astronomy/projection";

/** SkyChart'ın viewBox'ı: çizim gerçek boydan bağımsızdır (hikâye kartı ve baskı aynı oranda çıkar). */
export const CHART_VIEWBOX = 1000;
export const CHART_CENTER = CHART_VIEWBOX / 2;
/** Dış bant (yön harfleri) ufuk çemberinin dışında, kutunun içindedir. */
export const CHART_BAND = 46;
export const CHART_HORIZON_RADIUS = CHART_CENTER - CHART_BAND;

/** Motorun birim daire koordinatı → viewBox koordinatı (motor sözleşmesi: cx + x·R, cy + y·R). */
export function toChartCoordinate(unit: number): number {
  return CHART_CENTER + unit * CHART_HORIZON_RADIUS;
}

export type ChartDirection = "N" | "E" | "S" | "W";

export interface DirectionMarker {
  direction: ChartDirection;
  /** viewBox koordinatı, harfin merkezi */
  x: number;
  y: number;
}

const DIRECTION_AZIMUTHS: readonly (readonly [ChartDirection, number])[] = [
  ["N", 0],
  ["E", 90],
  ["S", 180],
  ["W", 270],
];

/** Yön harfleri motorun izdüşümünden türetilir: yıldızlarla aynı yönde olmaları garanti (doğu SOLDA). */
export function directionMarkers(): DirectionMarker[] {
  const markerRadius = (CHART_HORIZON_RADIUS + CHART_BAND / 2) / CHART_HORIZON_RADIUS;
  return DIRECTION_AZIMUTHS.map(([direction, azimuth]) => {
    const point = projectHorizontal(0, azimuth);
    return { direction, x: toChartCoordinate(point.x * markerRadius), y: toChartCoordinate(point.y * markerRadius) };
  });
}
