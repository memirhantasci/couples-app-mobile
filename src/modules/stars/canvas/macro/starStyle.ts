/**
 * Star sizing and brightness shared by picture recording (JS thread) and the
 * per-frame overlay (UI thread). Values are unchanged from the previous
 * renderer so stars keep their look.
 */

const STAR_BASE_RADIUS_PX: Readonly<Record<string, number>> = {
  O: 3.5, B: 3.2, A: 3.0, F: 2.8, G: 2.6, K: 2.4, M: 2.2,
};
const FALLBACK_STAR_RADIUS = 2.4;

/** Screen radius in pixels of a star drawn at `zoom`. */
export function magnitudeToRadius(magnitude: number, spectralType: string | null | undefined, zoom: number): number {
  'worklet';
  const baseClass = (spectralType || 'G').charAt(0).toUpperCase();
  const baseRadius = STAR_BASE_RADIUS_PX[baseClass] ?? FALLBACK_STAR_RADIUS;
  const magScale = Math.max(0.6, Math.min(3.2, 1 + (3 - magnitude) * 0.25));
  const zoomBonus = Math.min(5.5, 1 + (zoom - 1) * 0.18);
  return baseRadius * magScale * zoomBonus;
}

export function magnitudeToAlpha(magnitude: number, luminosity: number): number {
  'worklet';
  const normalized = Math.max(0, Math.min(1, 1 - (magnitude + 2) / 11));
  return 0.45 + normalized * 0.55 * luminosity;
}

/** Furthest a star's glow or halo reaches from its centre, in pixels at its band zoom. */
export const MAX_STAR_EXTENT_PX = 140;

export function smoothstep(edge0: number, edge1: number, value: number): number {
  'worklet';
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
