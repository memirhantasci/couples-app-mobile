/**
 * Star sizing, brightness and visibility, shared by the per-frame renderer
 * (UI thread) and hit-testing (JS thread). Sizes match the previous
 * renderer; everything is continuous in zoom so nothing pops while zooming.
 */

const STAR_BASE_RADIUS_PX: Readonly<Record<string, number>> = {
  O: 3.5, B: 3.2, A: 3.0, F: 2.8, G: 2.6, K: 2.4, M: 2.2,
};
const FALLBACK_STAR_RADIUS = 2.4;

export function smoothstep(edge0: number, edge1: number, value: number): number {
  'worklet';
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Zoom-independent part of a star's radius, in pixels. */
export function starBaseRadius(magnitude: number, spectralType: string | null | undefined): number {
  'worklet';
  const baseClass = (spectralType || 'G').charAt(0).toUpperCase();
  const baseRadius = STAR_BASE_RADIUS_PX[baseClass] ?? FALLBACK_STAR_RADIUS;
  return baseRadius * Math.max(0.6, Math.min(3.2, 1 + (3 - magnitude) * 0.25));
}

/** How much every star grows with zoom (same curve as before, capped at 5.5×). */
export function starZoomBonus(zoom: number): number {
  'worklet';
  return Math.min(5.5, 1 + (zoom - 1) * 0.18);
}

/** Screen radius in pixels of a star drawn at `zoom`. */
export function magnitudeToRadius(magnitude: number, spectralType: string | null | undefined, zoom: number): number {
  'worklet';
  return starBaseRadius(magnitude, spectralType) * starZoomBonus(zoom);
}

/**
 * Core opacity of a star. Unclaimed stars keep their natural catalog
 * brightness; a claimed star's opacity follows its couple's activity
 * brightness (0.10 → 0.37, 1.00 → 1.00), whatever its magnitude.
 */
export function starCoreAlpha(magnitude: number, claimed: boolean, brightness: number): number {
  'worklet';
  if (claimed) return 0.3 + 0.7 * Math.max(0, Math.min(1, brightness));
  const normalized = Math.max(0, Math.min(1, 1 - (magnitude + 2) / 11));
  return 0.45 + normalized * 0.55;
}

/**
 * Faintest unclaimed magnitude shown at a zoom. It rises smoothly through the
 * RPC's limits (3.8 below zoom 1.5, 5.8 below 4, then 9.0) as the matching
 * tile level loads, so faint stars fade in while zooming instead of popping.
 */
export function visibleMagnitudeLimit(zoom: number): number {
  'worklet';
  const logZoom = Math.log(zoom);
  const toMedium = smoothstep(Math.log(1.5), Math.log(2.6), logZoom);
  const toHigh = smoothstep(Math.log(4), Math.log(7), logZoom);
  return 3.8 + 2.0 * toMedium + 3.2 * toHigh;
}

/** Brightest magnitude a star still twinkles at; past it, light is too steady to flicker. */
const TWINKLE_MAGNITUDE_LIMIT = 4.0;
/** How much a twinkling star's brightness swings, as a fraction of its base opacity. */
const TWINKLE_DEPTH = 0.22;

/**
 * Brightness multiplier (centred on 1) for a star's "breathing" twinkle.
 * The phase and speed are derived from its own position, so stars never
 * pulse in lockstep; stars at/above the magnitude limit never twinkle.
 */
export function twinkleFactor(magnitude: number, ra: number, dec: number, animSeconds: number): number {
  'worklet';
  if (magnitude >= TWINKLE_MAGNITUDE_LIMIT) return 1;
  const seed = ra * 12.9898 + dec * 78.233;
  const phase = seed - Math.floor(seed / (2 * Math.PI)) * (2 * Math.PI);
  const speed = 0.7 + (seed - Math.floor(seed)) * 0.9;
  return 1 + TWINKLE_DEPTH * Math.sin(animSeconds * speed + phase);
}

/** Magnitudes over which a star fades out past the visible limit. */
const MAGNITUDE_FADE = 0.35;

/** 0…1 visibility of a star at a zoom; claimed stars always show. */
export function starVisibility(magnitude: number, claimed: boolean, zoom: number): number {
  'worklet';
  if (claimed) return 1;
  return Math.max(0, Math.min(1, (visibleMagnitudeLimit(zoom) + MAGNITUDE_FADE - magnitude) / MAGNITUDE_FADE));
}
