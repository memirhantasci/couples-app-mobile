import type { SkShader } from '@shopify/react-native-skia';
import { Easing, withTiming, type SharedValue } from 'react-native-reanimated';
import type { ViewportStarItem } from '../../types/star.types';
import { isSkiaAvailable, Skia } from '../skiaBridge';
import { normalizeRa } from './skyProjection';
import { starBaseRadius, starCoreAlpha, starLight, UNCLAIMED_STAR_BRIGHTNESS } from './starStyle';

/**
 * Star data prepared on the JS thread for per-frame drawing on the UI thread.
 *
 * Stars are drawn every frame at their exact size for the current zoom, so
 * zooming never swaps pre-recorded pictures (no size jumps, no cross-fades).
 * The JS thread only rebuilds this when star data changes. Visible stars
 * stay few at any zoom because the magnitude limit tightens as the view
 * widens; magnitude never changes how a star looks (see starStyle).
 */

export const STAR_FADE_MS = 260;
/** Stars are grouped in cells of this size so a frame can skip off-screen ones. */
const CELL_DEGREES = 30;

export interface StarRender {
  /** Normalised to [0, 360). */
  readonly ra: number;
  readonly dec: number;
  readonly magnitude: number;
  /** Radius in pixels before the zoom bonus. */
  readonly radius: number;
  readonly alpha: number;
  /** Light the star is drawn with (see starLight): the same baseline for every unclaimed star. */
  readonly luminosity: number;
  readonly claimed: boolean;
  readonly isMine?: boolean;
  readonly resonance: boolean;
  /** Index into `StarField.palette`. */
  readonly color: number;
  /** Date.now() when the star first appeared; 0 = no fade. */
  readonly bornAt: number;
}

export interface StarCell {
  readonly minRa: number;
  readonly maxRa: number;
  readonly minDec: number;
  readonly maxDec: number;
  readonly stars: readonly StarRender[];
}

export interface StarField {
  readonly cells: readonly StarCell[];
  /** Opaque RGB colours (alpha is set per circle while drawing). */
  readonly palette: readonly Float32Array[];
  /** Soft glow of each palette colour (see glowShader); empty without Skia. */
  readonly glows: readonly SkShader[];
}

export const EMPTY_STAR_FIELD: StarField = { cells: [], palette: [], glows: [] };

// ─── Colours ───────────────────────────────────────────────────────────────

// Worklets: called per frame on the UI thread as well as when building on the JS thread.
// No module-level cache — a captured Map would be a separate copy per runtime.
function rgbOf(hex: string): readonly [number, number, number] {
  'worklet';
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return clean.length >= 6 && !Number.isNaN(r + g + b) ? [r / 255, g / 255, b / 255] : [1, 1, 1];
}

/** Skia colour from a hex string and alpha. */
export function colorOf(hex: string, alpha: number): Float32Array {
  'worklet';
  const [r, g, b] = rgbOf(hex);
  return Float32Array.of(r, g, b, Math.max(0, Math.min(1, alpha)));
}

/** Gaussian-like falloff of a glow, from its centre (0) to its edge (1). */
const GLOW_STOPS = [0, 0.25, 0.5, 0.75, 1];
const GLOW_ALPHAS = [1, 0.7, 0.32, 0.1, 0];

/**
 * A unit-radius glow in a colour, drawn scaled to each star's reach. It fades
 * smoothly to nothing; stacked flat discs left hard edges that read as rings.
 */
export function glowShader(hex: string): SkShader {
  return Skia.Shader.MakeRadialGradient(
    Skia.Point(0, 0),
    1,
    GLOW_ALPHAS.map((alpha) => colorOf(hex, alpha)),
    GLOW_STOPS,
    0,
  );
}

// ─── Builder ───────────────────────────────────────────────────────────────

function cellKey(ra: number, dec: number) {
  const raIndex = Math.min(11, Math.floor(ra / CELL_DEGREES));
  const decIndex = Math.floor((Math.max(-90, Math.min(89.9999, dec)) + 90) / CELL_DEGREES);
  return raIndex * 6 + decIndex;
}

export interface StarFieldStats {
  stars: number;
  lastBuildMs: number;
}

/**
 * Turns streamed stars into a StarField and publishes it. Stars that were
 * not present before fade in; stars already on screen are untouched.
 */
export class StarFieldBuilder {
  private readonly field: SharedValue<StarField>;
  private readonly fadeClock: SharedValue<number>;
  private bornAt = new Map<number, number>();
  private stars: readonly ViewportStarItem[] = [];
  /** Glow shaders are native objects: one per colour, kept across rebuilds. */
  private readonly glowByHex = new Map<string, SkShader>();
  readonly stats: StarFieldStats = { stars: 0, lastBuildMs: 0 };

  constructor(field: SharedValue<StarField>, fadeClock: SharedValue<number>) {
    this.field = field;
    this.fadeClock = fadeClock;
  }

  private glowFor(hex: string): SkShader {
    let shader = this.glowByHex.get(hex);
    if (!shader) {
      shader = glowShader(hex);
      this.glowByHex.set(hex, shader);
    }
    return shader;
  }

  setStars(stars: readonly ViewportStarItem[]) {
    if (stars === this.stars) return;
    this.stars = stars;
    const startedAt = performance.now();
    const now = Date.now();
    const palette: Float32Array[] = [];
    const glows: SkShader[] = [];
    const paletteIndex = new Map<string, number>();
    const cells = new Map<number, StarRender[]>();
    const nextBornAt = new Map<number, number>();
    let fading = false;

    for (const star of stars) {
      // The user's star shines with authentic astronomical brightness and color alongside other stars.
      const hex = star.base_color || '#FFFFFF';
      let color = paletteIndex.get(hex);
      if (color === undefined) {
        color = palette.length;
        palette.push(colorOf(hex, 1));
        if (isSkiaAvailable) glows.push(this.glowFor(hex));
        paletteIndex.set(hex, color);
      }

      const previous = this.bornAt.get(star.catalog_id);
      let bornAt = previous === undefined ? now : previous;
      if (bornAt !== 0 && now - bornAt >= STAR_FADE_MS) bornAt = 0;
      if (bornAt !== 0) fading = true;
      nextBornAt.set(star.catalog_id, bornAt);

      const ra = normalizeRa(star.ra);
      const luminosity = starLight(star.is_claimed, star.luminosity_level ?? UNCLAIMED_STAR_BRIGHTNESS);
      const render: StarRender = {
        ra,
        dec: star.dec,
        magnitude: star.magnitude,
        radius: starBaseRadius(luminosity),
        alpha: starCoreAlpha(luminosity),
        luminosity,
        claimed: star.is_claimed,
        isMine: Boolean(star.is_mine),
        resonance: star.resonance_active,
        color,
        bornAt,
      };
      const key = cellKey(ra, star.dec);
      const cell = cells.get(key);
      if (cell) cell.push(render);
      else cells.set(key, [render]);
    }
    this.bornAt = nextBornAt;

    const published: StarCell[] = [];
    for (const [key, cellStars] of cells) {
      const raIndex = Math.floor(key / 6);
      const decIndex = key % 6;
      published.push({
        minRa: raIndex * CELL_DEGREES,
        maxRa: (raIndex + 1) * CELL_DEGREES,
        minDec: decIndex * CELL_DEGREES - 90,
        maxDec: (decIndex + 1) * CELL_DEGREES - 90,
        stars: cellStars,
      });
    }

    this.field.set({ cells: published, palette, glows });
    if (fading) {
      // One shared clock drives every fade; it only ticks while stars fade in.
      this.fadeClock.set(now);
      this.fadeClock.set(withTiming(now + STAR_FADE_MS, { duration: STAR_FADE_MS, easing: Easing.linear }));
    }
    this.stats.stars = nextBornAt.size;
    this.stats.lastBuildMs = performance.now() - startedAt;
  }
}
