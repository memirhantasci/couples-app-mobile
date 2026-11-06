/**
 * Star sizing, brightness and visibility, shared by the per-frame renderer
 * (UI thread) and hit-testing (JS thread). Everything is continuous in zoom
 * so nothing pops while zooming.
 *
 * A star's look never follows its catalog magnitude: unclaimed stars all
 * shine with the same low, steady light, and a claimed star only grows
 * brighter as its couple's activity feeds it. Magnitude is used solely to
 * decide which stars are shown at a zoom (level of detail, visibleMagnitudeLimit).
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
 * Level of detail: faintest unclaimed magnitude shown at a zoom, as knots
 * (zoom, magnitude) interpolated in log(zoom) so the reveal feels even while
 * pinching. Measured on the live catalog (2026-11-06, ~2,020 unclaimed stars):
 * mag ≤ 4.1 ≈ 560 stars (the brightest guide stars, widest view),
 * ≤ 4.6 ≈ 990, ≤ 5.2 ≈ 1,900, ≤ 5.8 = every real star; virtual stars
 * (≤ 6.5) and everything else are in by zoom 2.5. Claimed stars ignore this
 * (starVisibility), so a couple's own and partner's star always show.
 */
export const MAGNITUDE_LIMIT_KNOTS: readonly (readonly [number, number])[] = [
  [0.2, 4.1],
  [0.5, 4.6],
  [1.0, 5.2],
  [1.5, 5.8],
  [2.5, 9.0],
];

export function visibleMagnitudeLimit(zoom: number): number {
  'worklet';
  const knots = MAGNITUDE_LIMIT_KNOTS;
  if (zoom <= knots[0][0]) return knots[0][1];
  for (let i = 1; i < knots.length; i += 1) {
    const [z1, m1] = knots[i];
    if (zoom <= z1) {
      const [z0, m0] = knots[i - 1];
      const t = Math.log(zoom / z0) / Math.log(z1 / z0);
      return m0 + (m1 - m0) * t;
    }
  }
  return knots[knots.length - 1][1];
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
export const MAGNITUDE_FADE = 0.4;

/** 0…1 visibility of a star at a zoom; claimed stars always show. */
export function starVisibility(magnitude: number, claimed: boolean, zoom: number): number {
  'worklet';
  if (claimed) return 1;
  return Math.max(0, Math.min(1, (visibleMagnitudeLimit(zoom) + MAGNITUDE_FADE - magnitude) / MAGNITUDE_FADE));
}
