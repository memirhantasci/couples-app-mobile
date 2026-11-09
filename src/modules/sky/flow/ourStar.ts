import { directionKey, findStarPosition, type SkyDirectionKey, type SkyRequest, type SkyStarPosition, type SkyTwilight } from "../astronomy";
import { SKY_STAR_NAMES } from "../data/skyStarNames.data";
import { SKY_STARS } from "../data/skyStars.data";
import { skyDarkness } from "./flowLogic";

/** Yıldız adı posterde sınırlı alana yazılır; kullanıcı verisidir. */
export const MAX_STAR_LABEL = 18;

/**
 * Uygulamadaki kadir ile gerçek kadir arasındaki en büyük fark. Eski tohum yıldızlarının HIP kodları çoğunlukla
 * gerçek yıldızla uyuşmaz; o kodun gerçek yıldızını "yıldızınız" diye göstermek yanlış iddia olur. 0,15, aynı
 * yıldızın kataloglar arası ufak kadir farkını kabul eder, başka bir yıldızı kabul etmez.
 */
export const MAX_MAGNITUDE_DIFFERENCE = 0.15;

/**
 * Uygulamadaki konum ile gerçek konum arasındaki en büyük açısal fark; kadir kapısının geçirdiği yanlış kodları eler.
 * Migration verisinden seçildi (kadiri uyuşan 1694 yıldız): HYG genişlemesinin 1500'ü 0,001°'den yakın; eski tohumda
 * sıkışmasın diye kaydırılanların en uzağı 0,96° (Wezen). Sonrası kaydırma değildir: 1,14°'den 73°'ye 37 yıldızda
 * kod başka bir yıldızın (ör. Markab ile Scheat takas) ya da deklinasyon yanlış. 1°, Gökkubbe'nin asgari aralığıdır.
 */
export const MAX_ANGULAR_SEPARATION_DEG = 1;

export type OurStarSentenceKey = "above" | "aboveDaylight" | "below" | "belowDaylight";

export interface OurStar {
  /** Yalnızca ufkun üstündeyse dolu: posterdeki altın halka */
  highlight: { hip: number; label?: string } | null;
  sentence: { key: OurStarSentenceKey; degrees: number; direction: SkyDirectionKey };
}

/** Yalnızca gerçek katalog kodu: 'HIP-<pozitif tam sayı>'. 'SOL-*', 'VIRT-*' ve diğerleri null. */
export function parseHipCode(code: unknown): number | null {
  if (typeof code !== "string") return null;
  const match = /^HIP-([1-9]\d{0,6})$/.exec(code);
  return match ? Number(match[1]) : null;
}

/** Kullanıcı verisini tek satırlık, sınırlı bir etikete indirger; boşsa undefined. */
export function cleanStarLabel(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const compact = raw.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (!compact) return undefined;
  const chars = Array.from(compact);
  return chars.length > MAX_STAR_LABEL ? `${chars.slice(0, MAX_STAR_LABEL - 1).join("").trimEnd()}…` : compact;
}

let catalogRowByHip: Map<number, (typeof SKY_STARS)[number]> | null = null;

function catalogRow(hip: number): (typeof SKY_STARS)[number] | undefined {
  if (!catalogRowByHip) catalogRowByHip = new Map(SKY_STARS.map((row) => [row[0], row]));
  return catalogRowByHip.get(hip);
}

/** Sunucudan sayı ya da NUMERIC metni gelebilir. Eksik/boş değer 0 sayılmaz: NaN döner. */
function toNumber(value: unknown): number {
  return typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
}

/** Kadir eksik, geçersiz ya da katalogdakinden farklıysa false (güvenli taraf: cümle çıkmaz). */
export function magnitudesAgree(appMagnitude: unknown, realMagnitude: number | undefined): boolean {
  if (realMagnitude === undefined) return false;
  const value = toNumber(appMagnitude);
  return Number.isFinite(value) && Math.abs(value - realMagnitude) <= MAX_MAGNITUDE_DIFFERENCE + 1e-9;
}

/** İki gök konumu arasındaki açı, derece (haversine: küçük açılarda da kararlı). */
export function angularSeparationDeg(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const rad = Math.PI / 180;
  const a = Math.sin(((dec1 - dec2) * rad) / 2) ** 2 + Math.cos(dec1 * rad) * Math.cos(dec2 * rad) * Math.sin(((ra1 - ra2) * rad) / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(a)))) / rad;
}

/** Konum eksik, geçersiz ya da gerçek konumdan uzaksa false (güvenli taraf: cümle çıkmaz). */
export function positionsAgree(appRa: unknown, appDec: unknown, real: { ra: number; dec: number } | undefined): boolean {
  if (!real) return false;
  const ra = toNumber(appRa);
  const dec = toNumber(appDec);
  if (!Number.isFinite(ra) || !Number.isFinite(dec)) return false;
  return angularSeparationDeg(ra, dec, real.ra, real.dec) <= MAX_ANGULAR_SEPARATION_DEG;
}

/**
 * O gece çiftin yıldızı. Katalogda bulunmayan (sanal, Güneş sistemi, 5,5 kadirden sönük) ya da kadiri veya konumu
 * gerçek yıldızla uyuşmayan yıldızda null.
 * Gökyüzü yeterince kararmamışsa ayrı cümle kullanılır: gökte olmak görünür olmak değildir.
 */
export function describeOurStar(
  star: { catalog_code?: unknown; custom_name?: unknown; magnitude?: unknown; ra?: unknown; dec?: unknown } | null | undefined,
  request: SkyRequest,
  twilight: SkyTwilight,
  find: (hip: number, request: SkyRequest) => SkyStarPosition | null = findStarPosition
): OurStar | null {
  const hip = parseHipCode(star?.catalog_code);
  if (hip === null) return null;
  const row = catalogRow(hip);
  if (!row || !magnitudesAgree(star?.magnitude, row[3]) || !positionsAgree(star?.ra, star?.dec, { ra: row[1], dec: row[2] })) return null;
  const position = find(hip, request);
  if (!position) return null;

  const daylight = skyDarkness(twilight) !== "dark";
  const sentence = {
    key: (position.aboveHorizon ? (daylight ? "aboveDaylight" : "above") : daylight ? "belowDaylight" : "below") as OurStarSentenceKey,
    // Ufkun hemen üstündeki yıldız "0° üstünde" yazılmasın
    degrees: Math.max(1, Math.round(Math.abs(position.altitude))),
    direction: directionKey(position.azimuth),
  };
  if (!position.aboveHorizon) return { highlight: null, sentence };
  return { highlight: { hip, label: cleanStarLabel(star?.custom_name) ?? cleanStarLabel(SKY_STAR_NAMES[hip]) }, sentence };
}
