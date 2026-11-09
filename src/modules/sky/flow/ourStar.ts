import { directionKey, findStarPosition, type SkyDirectionKey, type SkyRequest, type SkyStarPosition, type SkyTwilight } from "../astronomy";
import { SKY_STAR_NAMES } from "../data/skyStarNames.data";
import { SKY_STARS } from "../data/skyStars.data";

/** Yıldız adı posterde sınırlı alana yazılır; kullanıcı verisidir. */
export const MAX_STAR_LABEL = 18;

/**
 * Uygulamadaki kadir ile gerçek kadir arasındaki en büyük fark. Eski tohum yıldızlarının HIP kodları çoğunlukla
 * gerçek yıldızla uyuşmaz; o kodun gerçek yıldızını "yıldızınız" diye göstermek yanlış iddia olur. Konum kimlik
 * ölçütü değildir (Gökkubbe'de ≥1° aralık için bilerek kaydırılmıştır), kadir ise kaydırılmaz. 0,15, aynı yıldızın
 * kataloglar arası ufak kadir farkını kabul eder, başka bir yıldızı kabul etmez.
 */
export const MAX_MAGNITUDE_DIFFERENCE = 0.15;

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

let magnitudeByHip: Map<number, number> | null = null;

function catalogMagnitude(hip: number): number | undefined {
  if (!magnitudeByHip) magnitudeByHip = new Map(SKY_STARS.map((row) => [row[0], row[3]]));
  return magnitudeByHip.get(hip);
}

/** Kadir eksik, geçersiz ya da katalogdakinden farklıysa false (güvenli taraf: cümle çıkmaz). */
export function magnitudesAgree(appMagnitude: unknown, realMagnitude: number | undefined): boolean {
  if (realMagnitude === undefined) return false;
  const value = typeof appMagnitude === "number" ? appMagnitude : typeof appMagnitude === "string" && appMagnitude.trim() ? Number(appMagnitude) : NaN;
  return Number.isFinite(value) && Math.abs(value - realMagnitude) <= MAX_MAGNITUDE_DIFFERENCE + 1e-9;
}

/**
 * O gece çiftin yıldızı. Katalogda bulunmayan (sanal, Güneş sistemi, 5,5 kadirden sönük) ya da kadiri
 * gerçek yıldızla uyuşmayan yıldızda null.
 * Aydınlık saatte ayrı cümle kullanılır: gökte olmak görünür olmak değildir.
 */
export function describeOurStar(
  star: { catalog_code?: unknown; custom_name?: unknown; magnitude?: unknown } | null | undefined,
  request: SkyRequest,
  twilight: SkyTwilight,
  find: (hip: number, request: SkyRequest) => SkyStarPosition | null = findStarPosition
): OurStar | null {
  const hip = parseHipCode(star?.catalog_code);
  if (hip === null || !magnitudesAgree(star?.magnitude, catalogMagnitude(hip))) return null;
  const position = find(hip, request);
  if (!position) return null;

  const daylight = twilight !== "night";
  const sentence = {
    key: (position.aboveHorizon ? (daylight ? "aboveDaylight" : "above") : daylight ? "belowDaylight" : "below") as OurStarSentenceKey,
    // Ufkun hemen üstündeki yıldız "0° üstünde" yazılmasın
    degrees: Math.max(1, Math.round(Math.abs(position.altitude))),
    direction: directionKey(position.azimuth),
  };
  if (!position.aboveHorizon) return { highlight: null, sentence };
  return { highlight: { hip, label: cleanStarLabel(star?.custom_name) ?? cleanStarLabel(SKY_STAR_NAMES[hip]) }, sentence };
}
