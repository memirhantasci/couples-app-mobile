/**
 * Star sizing, brightness and visibility, shared by the per-frame renderer
 * (UI thread) and hit-testing (JS thread). Everything is continuous in zoom
 * so nothing pops while zooming.
 *
 * A star's look never follows its catalog magnitude: unclaimed stars all
 * shine with the same low, steady light, and a claimed star only grows
 * brighter as its couple's activity feeds it. Magnitude is used solely to
 * decide which stars are loaded/shown at a zoom (level of detail).
 */

/**
 * Light of every unclaimed star: the server's brightness for a score of 0
 * (`calculate_star_brightness(0)`), so a freshly claimed star looks exactly
 * like an unclaimed one until its couple's activity lights it up.
 */
export const UNCLAIMED_STAR_BRIGHTNESS = 0.2;
/** Radius in pixels, before the zoom bonus, of a star at the baseline light. */
const BASE_STAR_RADIUS_PX = 2.2;
/** How much a fully lit star (brightness 1.0) grows over the baseline radius. */
const FULL_LIGHT_GROWTH = 0.8;

export function smoothstep(edge0: number, edge1: number, value: number): number {
  'worklet';
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Light (0.20…1.00) a star is drawn with. Unclaimed stars always get the
 * baseline; claimed stars never drop below it, so no unclaimed star ever
 * outshines a claimed one.
 */
export function starLight(claimed: boolean, brightness: number): number {
  'worklet';
  if (!claimed) return UNCLAIMED_STAR_BRIGHTNESS;
  return Math.max(UNCLAIMED_STAR_BRIGHTNESS, Math.min(1, brightness));
}

/** 0 at the baseline light → 1 at full light: how much activity has lit a star. */
export function starActivity(light: number): number {
  'worklet';
  return Math.max(0, Math.min(1, (light - UNCLAIMED_STAR_BRIGHTNESS) / (1 - UNCLAIMED_STAR_BRIGHTNESS)));
}

/** Zoom-independent part of a star's radius, in pixels. */
export function starBaseRadius(light: number): number {
  'worklet';
  return BASE_STAR_RADIUS_PX * (1 + FULL_LIGHT_GROWTH * starActivity(light));
}

/** How much every star grows with zoom (same curve as before, capped at 5.5×). */
export function starZoomBonus(zoom: number): number {
  'worklet';
  return Math.min(5.5, 1 + (zoom - 1) * 0.18);
}

/** Screen radius in pixels of a star drawn at `zoom`. */
export function starRadius(light: number, zoom: number): number {
  'worklet';
  return starBaseRadius(light) * starZoomBonus(zoom);
}

/** Largest base radius any star can have (a fully lit one), in pixels. */
export const MAX_STAR_BASE_RADIUS_PX = BASE_STAR_RADIUS_PX * (1 + FULL_LIGHT_GROWTH);

/** Core opacity of a star: 0.44 at the baseline light, 1.00 at full light. */
export function starCoreAlpha(light: number): number {
  'worklet';
  return 0.3 + 0.7 * light;
}

/**
 * Faintest unclaimed magnitude shown at a zoom. It rises smoothly through the
 * RPC's limits (3.8 below zoom 1.5, 5.8 below 4, then 9.0) as the matching
 * tile level loads, so more stars fade in while zooming instead of popping.
 */
export function visibleMagnitudeLimit(zoom: number): number {
  'worklet';
  const logZoom = Math.log(zoom);
  const toMedium = smoothstep(Math.log(1.5), Math.log(2.6), logZoom);
  const toHigh = smoothstep(Math.log(4), Math.log(7), logZoom);
  return 3.8 + 2.0 * toMedium + 3.2 * toHigh;
}

/** How much a fully lit star's brightness swings, as a fraction of its base opacity. */
const TWINKLE_DEPTH = 0.22;

/**
 * Brightness multiplier (centred on 1) for a star's "breathing" twinkle.
 * Only activity makes a star twinkle: unclaimed and unlit stars stay steady,
 * and the swing deepens with the couple's light. The phase and speed are
 * derived from its own position, so stars never pulse in lockstep.
 */
export function twinkleFactor(light: number, ra: number, dec: number, animSeconds: number): number {
  'worklet';
  const depth = TWINKLE_DEPTH * starActivity(light);
  if (depth <= 0) return 1;
  const seed = ra * 12.9898 + dec * 78.233;
  const phase = seed - Math.floor(seed / (2 * Math.PI)) * (2 * Math.PI);
  const speed = 0.7 + (seed - Math.floor(seed)) * 0.9;
  return 1 + depth * Math.sin(animSeconds * speed + phase);
}

/** Magnitudes over which a star fades out past the visible limit. */
export const MAGNITUDE_FADE = 0.35;

/** 0…1 visibility of a star at a zoom; claimed stars always show. */
export function starVisibility(magnitude: number, claimed: boolean, zoom: number): number {
  'worklet';
  if (claimed) return 1;
  return Math.max(0, Math.min(1, (visibleMagnitudeLimit(zoom) + MAGNITUDE_FADE - magnitude) / MAGNITUDE_FADE));
}
