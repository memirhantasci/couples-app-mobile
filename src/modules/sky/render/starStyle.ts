import type { SkyProjectedSegment, SkyProjectedStar } from "../astronomy/types";
import { toChartCoordinate } from "./chartGeometry";

const NEUTRAL_STAR_COLOR = "#FFFFFF";

// B−V → renk çapaları: mavi-beyazdan turuncuya. Kırmızı kanal artar, mavi kanal azalır.
const BV_ANCHORS: readonly (readonly [number, number, number, number])[] = [
  [-0.4, 0x9d, 0xb8, 0xff],
  [0.0, 0xcf, 0xdd, 0xff],
  [0.4, 0xff, 0xf6, 0xea],
  [0.8, 0xff, 0xe6, 0xb8],
  [1.2, 0xff, 0xcf, 0x8e],
  [2.0, 0xff, 0x9f, 0x5e],
];

function toHex(channel: number): string {
  return Math.round(channel).toString(16).padStart(2, "0").toUpperCase();
}

/** B−V renk indeksinden yıldız rengi; yok ya da geçersizse nötr beyaz. Uçlarda sıkıştırılır. */
export function starColorFromBV(bv: number | null): string {
  if (bv === null || !Number.isFinite(bv)) return NEUTRAL_STAR_COLOR;
  const first = BV_ANCHORS[0];
  const last = BV_ANCHORS[BV_ANCHORS.length - 1];
  const value = Math.min(last[0], Math.max(first[0], bv));
  let index = 0;
  while (index < BV_ANCHORS.length - 2 && value > BV_ANCHORS[index + 1][0]) index++;
  const a = BV_ANCHORS[index];
  const b = BV_ANCHORS[index + 1];
  const t = (value - a[0]) / (b[0] - a[0]);
  return `#${toHex(a[1] + (b[1] - a[1]) * t)}${toHex(a[2] + (b[2] - a[2]) * t)}${toHex(a[3] + (b[3] - a[3]) * t)}`;
}

export type StarTone = "cool" | "neutral" | "warm";

// Tek Path tek renk taşır: renk, yıldız başına değil üç tona indirgenerek verilir
const TONE_COLORS: Record<StarTone, string> = {
  cool: starColorFromBV(-0.1),
  neutral: NEUTRAL_STAR_COLOR,
  warm: starColorFromBV(1.3),
};

export function starToneFromBV(bv: number | null): StarTone {
  if (bv === null || !Number.isFinite(bv)) return "neutral";
  if (bv < 0.3) return "cool";
  return bv < 0.9 ? "neutral" : "warm";
}

export interface MagnitudeBucket {
  /** Bu kovaya giren en sönük kadir (dahil) */
  maxMag: number;
  /** Yarıçap, viewBox birimi (1000'lik kutu; hikâye kartında 1 birim ≈ 0,8 piksel) */
  radius: number;
  opacity: number;
  /** Halo yarıçap çarpanı ve opaklığı; halosuz kovada null */
  halo: { scale: number; opacity: number } | null;
  /** Sönük yıldızlarda ton ayrımı 2-3 pikselde görünmez: tek Path yeter */
  tinted: boolean;
}

export const MAGNITUDE_BUCKETS: readonly MagnitudeBucket[] = [
  { maxMag: 0.5, radius: 8.5, opacity: 1, halo: { scale: 2.8, opacity: 0.2 }, tinted: true },
  { maxMag: 1.5, radius: 6.4, opacity: 1, halo: { scale: 2.6, opacity: 0.16 }, tinted: true },
  { maxMag: 2.5, radius: 4.8, opacity: 0.95, halo: { scale: 2.4, opacity: 0.1 }, tinted: true },
  { maxMag: 3.5, radius: 3.5, opacity: 0.85, halo: null, tinted: true },
  { maxMag: 4.5, radius: 2.5, opacity: 0.7, halo: null, tinted: false },
  { maxMag: Infinity, radius: 1.7, opacity: 0.55, halo: null, tinted: false },
];

export function magnitudeBucketIndex(mag: number): number {
  const index = MAGNITUDE_BUCKETS.findIndex((bucket) => mag <= bucket.maxMag);
  return index === -1 ? MAGNITUDE_BUCKETS.length - 1 : index;
}

export interface StarBatch {
  key: string;
  d: string;
  fill: string;
  opacity: number;
}

const fmt = (value: number) => value.toFixed(1);

function circleSubpath(x: number, y: number, r: number): string {
  return `M ${fmt(x - r)} ${fmt(y)} a ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(2 * r)} 0 a ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-2 * r)} 0 Z`;
}

/** Yıldızları kova × ton başına tek Path'e toplar. Sıra: halolar, sonra sönükten parlağa (parlak üstte). */
export function buildStarBatches(stars: readonly SkyProjectedStar[]): StarBatch[] {
  const parts = new Map<string, string[]>();
  const halos = new Map<number, string[]>();
  const push = <K,>(map: Map<K, string[]>, key: K, value: string) => {
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
  };

  for (const star of stars) {
    const bucketIndex = magnitudeBucketIndex(star.mag);
    const bucket = MAGNITUDE_BUCKETS[bucketIndex];
    const x = toChartCoordinate(star.x);
    const y = toChartCoordinate(star.y);
    const tone: StarTone = bucket.tinted ? starToneFromBV(star.ci) : "neutral";
    push(parts, `${bucketIndex}:${tone}`, circleSubpath(x, y, bucket.radius));
    if (bucket.halo) push(halos, bucketIndex, circleSubpath(x, y, bucket.radius * bucket.halo.scale));
  }

  const batches: StarBatch[] = [];
  for (let index = 0; index < MAGNITUDE_BUCKETS.length; index++) {
    const list = halos.get(index);
    const halo = MAGNITUDE_BUCKETS[index].halo;
    if (list && halo) batches.push({ key: `halo:${index}`, d: list.join(" "), fill: "#FFF4DC", opacity: halo.opacity });
  }
  for (let index = MAGNITUDE_BUCKETS.length - 1; index >= 0; index--) {
    for (const tone of ["cool", "neutral", "warm"] as const) {
      const list = parts.get(`${index}:${tone}`);
      if (list) batches.push({ key: `star:${index}:${tone}`, d: list.join(" "), fill: TONE_COLORS[tone], opacity: MAGNITUDE_BUCKETS[index].opacity });
    }
  }
  return batches;
}

/** Tüm takımyıldızı kenarları tek Path. */
export function buildSegmentsPath(segments: readonly SkyProjectedSegment[]): string {
  return segments
    .map((segment) => `M ${fmt(toChartCoordinate(segment.x1))} ${fmt(toChartCoordinate(segment.y1))} L ${fmt(toChartCoordinate(segment.x2))} ${fmt(toChartCoordinate(segment.y2))}`)
    .join(" ");
}
