import { directionKey, findStarPosition, type SkyDirectionKey, type SkyRequest, type SkyStarPosition, type SkyTwilight } from "../astronomy";
import { SKY_STAR_NAMES } from "../data/skyStarNames.data";

/** Yıldız adı posterde sınırlı alana yazılır; kullanıcı verisidir. */
export const MAX_STAR_LABEL = 18;

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

/**
 * O gece çiftin yıldızı. Katalogda bulunmayan yıldızda (sanal, Güneş sistemi, 5,5 kadirden sönük) null.
 * Aydınlık saatte ayrı cümle kullanılır: gökte olmak görünür olmak değildir.
 */
export function describeOurStar(
  star: { catalog_code?: unknown; custom_name?: unknown } | null | undefined,
  request: SkyRequest,
  twilight: SkyTwilight,
  find: (hip: number, request: SkyRequest) => SkyStarPosition | null = findStarPosition
): OurStar | null {
  const hip = parseHipCode(star?.catalog_code);
  if (hip === null) return null;
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
