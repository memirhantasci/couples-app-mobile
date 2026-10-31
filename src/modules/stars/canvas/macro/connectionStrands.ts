/**
 * The bond between two connected stars: a silk-like ribbon of ultra-thin strands.
 *
 *  • Geometry – a bundle of hairline strands waves together in one gentle S between the two stars
 *    (the S repeats when a bond is very long). The strands meet at both stars and open up between
 *    them; each strand's wave is shifted a little against its neighbours, so the bundle is tight at
 *    the crests of the S and wide where it crosses, like a twisting ribbon of silk.
 *  • Colour – ice-blue and cyan through violet to pink and back to ice-blue, along the bond
 *    (three slightly different gradients, so the strands are not all the same shade). Each strand
 *    is 30–60 % opaque; a very faint glow of soft lights sits under the bundle.
 *  • Stardust – a handful of tiny glowing specks drift slowly along the strands, from our star
 *    toward the other one.
 *  • Motion – the S slides and breathes slowly, and a faint ripple runs along every strand.
 *
 * Drawn only with calls the sky renderer already uses on the UI thread (lines, circles, one canvas
 * transform and gradient shaders made once), so a frame allocates nothing native. The canvas is laid
 * along the bond (x = 0 at our star, x = 1 at the other one, y = sideways offset ÷ length), which lets
 * one unit-length gradient colour every strand. Pure worklets with no React Native imports (types
 * only): the same code runs in Node tests with a fake canvas.
 */

import type { SkCanvas, SkPaint, SkShader } from '@shopify/react-native-skia';
import { smoothstep } from './starStyle';

/** Hairlines in one bundle. */
export const STRAND_COUNT = 13;
/** Specks of stardust per bond. */
export const DUST_COUNT = 12;

/**
 * Gradient along the bond, from our star (0) to the other star (1): ice-blue → cyan → violet → pink →
 * ice-blue. Three variants lean cool / balanced / warm; strand j uses variant j % 3. The strands are
 * fainter right at the stars, where all of them lie almost on top of each other and would add up to a
 * bright white stem.
 */
export const STRAND_GRADIENT_POSITIONS = [0, 0.1, 0.24, 0.5, 0.76, 0.9, 1] as const;
export const STRAND_GRADIENT_ALPHAS = [0.3, 1, 1, 1, 1, 1, 0.3] as const;
export const STRAND_GRADIENT_COLORS = [
  ['#BAE6FD', '#A5F0FD', '#67E8F9', '#A78BFA', '#F0ABFC', '#C7D2FE', '#A5D8FF'],
  ['#CFFAFE', '#A5E9FF', '#7DD3FC', '#93A8FF', '#C4B5FD', '#D3E4FF', '#BAE6FD'],
  ['#BAE6FD', '#9DCBFF', '#8FB8FF', '#C4A1FF', '#F9A8D4', '#E4D4FF', '#D6ECFF'],
] as const;
/** Stardust and star glints: a cold white. */
export const STRAND_TINT = '#E6F6FF';

/** The S has one wave over a bond up to this long; longer bonds repeat it. */
const MAX_WAVELENGTH_PX = 640;
/** Wave height as a share of the wavelength, with limits (px). */
const AMPLITUDE_RATIO = 0.075;
const MIN_AMPLITUDE_PX = 4;
const MAX_AMPLITUDE_PX = 56;
/** How far each strand's wave is shifted against its neighbours (radians at the widest strand). */
const TWIST = 0.62;
/** A little sideways spread that keeps the bundle from collapsing at the crests. */
const MIN_SPREAD_PX = 0.8;
const MAX_SPREAD_PX = 2.5;
/** The strands meet at the stars over this distance (px), or a fifth of a short bond. */
const MAX_TAPER_PX = 110;
const TAPER_RATIO = 0.22;
/**
 * Straight pieces of a strand are at most this long in the middle (px); shorter where the wave is
 * tighter (short bonds) so a piece never strays more than about 0.35 px from the curve. Near the stars,
 * where the strands bend most, they are about 2.5 times shorter again (see gridU).
 */
const MAX_SEGMENT_PX = 24;
const MIN_SEGMENT_PX = 6;
const MAX_SAGITTA_PX = 0.35;
/** Strand opacity range and stroke width range. */
const MIN_ALPHA = 0.34;
const ALPHA_RANGE = 0.24;
const MIN_WIDTH_PX = 0.5;
const WIDTH_RANGE_PX = 0.35;
/** The faint glow under the bundle: soft round lights along its middle, this far apart (px). */
const GLOW_SPACING_PX = 34;
const GLOW_ALPHA = 0.05;
/** Dust: size and drift speed (share of the bond per second). */
const DUST_MIN_SPEED = 0.012;
const DUST_SPEED_RANGE = 0.02;
const TAU = 6.2831853;

/** The parts of a canvas the strands draw with (a fake in tests). */
export type StrandCanvas = Pick<
  SkCanvas,
  'save' | 'restore' | 'translate' | 'rotate' | 'scale' | 'drawLine' | 'drawCircle'
>;

/** Everything drawn with, made once (see createStarPaints). */
export interface StrandResources {
  /** Strand stroke, gradient shader set per strand. */
  readonly line: SkPaint;
  /** Solid-colour stroke for the star glints. */
  readonly spark: SkPaint;
  /** Fill whose shader is the soft glow: dust halos and glints. */
  readonly glow: SkPaint;
  /** Solid-colour fill: dust cores. */
  readonly core: SkPaint;
  /** Unit-length gradients along x (one per STRAND_GRADIENT_COLORS entry). */
  readonly gradients: readonly SkShader[];
  /** Unit-radius soft glow. */
  readonly glowShader: SkShader;
}

export interface StrandView {
  readonly width: number;
  readonly height: number;
}

/** Deterministic 0…1 hash of a number: strands and specks differ, but identically on every frame. */
function hash01(x: number): number {
  'worklet';
  const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * How far the bundle has opened at `fromStar` pixels from the nearest star: 0 at the star, 1 from `taper`
 * on. It starts fast (the strands fan out of the star at once, instead of lying on top of each other
 * as a bright stem) and settles smoothly into the full wave.
 */
function openness(fromStar: number, taper: number): number {
  'worklet';
  const x = Math.min(1, fromStar / taper);
  return x <= 0 ? 0 : 1 - (1 - x) * (1 - x);
}

/**
 * Sideways offset (px) of strand `index` at fraction `u` of the bond. `c` is the strand's place in the
 * bundle, −1…1. Zero at both stars, so every strand ends exactly on them.
 */
function strandOffset(
  c: number,
  index: number,
  u: number,
  len: number,
  wavelength: number,
  amplitude: number,
  taper: number,
  twist: number,
  slide: number,
  spread: number,
  animSeconds: number,
): number {
  'worklet';
  const open = openness(Math.min(u, 1 - u) * len, taper);
  if (open <= 0) return 0;
  const waves = (u * len) / wavelength;
  // Each strand's own wave is a hair taller / shorter and shifted by its place in the bundle
  const height = amplitude * (1 + 0.03 * Math.sin(index * 2.3 + 1.7));
  const wave = height * Math.sin(TAU * waves + slide + c * twist * open);
  const ripple = amplitude * 0.045 * Math.sin(TAU * waves * 1.9 - animSeconds * 0.7 + index * 0.8);
  return open * (wave + ripple + c * spread);
}

/** A soft round glow centred on x/y that fades out at `reach` pixels. */
function glowAt(
  canvas: StrandCanvas,
  res: StrandResources,
  x: number,
  y: number,
  reach: number,
  alpha: number,
) {
  'worklet';
  if (alpha <= 0.004 || reach <= 0) return;
  res.glow.setShader(res.glowShader);
  res.glow.setAlphaf(Math.min(1, alpha));
  canvas.save();
  canvas.translate(x, y);
  canvas.scale(reach, reach);
  canvas.drawCircle(0, 0, 1, res.glow);
  canvas.restore();
}

/**
 * Where the 0…1 grid position `s` falls along the bond: evenly spread in the middle, closer together
 * near both stars (about 0.5 : 1.3 in density), where the strands bend the most.
 */
function gridU(s: number): number {
  'worklet';
  return 0.5 * s + 0.25 * (1 - Math.cos(Math.PI * s));
}

/** Draws one strand between fractions ta…tb of the bond, in the bond's own coordinates. */
function drawStrand(
  canvas: StrandCanvas,
  paint: SkPaint,
  c: number,
  index: number,
  ta: number,
  tb: number,
  pieces: number,
  len: number,
  wavelength: number,
  amplitude: number,
  taper: number,
  twist: number,
  slide: number,
  spread: number,
  animSeconds: number,
) {
  'worklet';
  let pu = ta;
  let pv = strandOffset(c, index, pu, len, wavelength, amplitude, taper, twist, slide, spread, animSeconds);
  for (let k = 1; k < pieces; k++) {
    const u = gridU(k / pieces);
    if (u <= ta) continue;
    if (u >= tb) break;
    const v = strandOffset(c, index, u, len, wavelength, amplitude, taper, twist, slide, spread, animSeconds);
    canvas.drawLine(pu, pv / len, u, v / len, paint);
    pu = u;
    pv = v;
  }
  const endV = strandOffset(c, index, tb, len, wavelength, amplitude, taper, twist, slide, spread, animSeconds);
  canvas.drawLine(pu, pv / len, tb, endV / len, paint);
}

/**
 * Draws the ribbon between two screen points. `seed` (0…1, fixed per bond) picks which way the S
 * leans and offsets the slow motions, so several bonds never move in lockstep.
 */
export function drawConnectionStrands(
  canvas: StrandCanvas,
  res: StrandResources,
  view: StrandView,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed: number,
  animSeconds: number,
) {
  'worklet';
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 6) return;

  // Shape of the S
  const wavelength = Math.min(len, MAX_WAVELENGTH_PX);
  const lean = seed < 0.5 ? -1 : 1;
  const amplitude =
    lean * Math.min(MAX_AMPLITUDE_PX, Math.max(MIN_AMPLITUDE_PX, wavelength * AMPLITUDE_RATIO));
  const taper = Math.min(len * TAPER_RATIO, MAX_TAPER_PX);
  const spread = Math.min(MAX_SPREAD_PX, Math.max(MIN_SPREAD_PX, len * 0.004));
  // Slow motions: the twist breathes and the crests slide a little to and fro
  const twist = TWIST * (1 + 0.1 * Math.sin(animSeconds * 0.33 + seed * 9));
  const slide = 0.3 * Math.sin(animSeconds * 0.21 + seed * TAU);

  // Visible part of the bond (Liang–Barsky on the chord, with room for the S and the specks)
  const margin = MAX_AMPLITUDE_PX + MAX_SPREAD_PX + 70;
  const minX = -margin;
  const maxX = view.width + margin;
  const minY = -margin;
  const maxY = view.height + margin;
  let ta = 0;
  let tb = 1;
  if (dx === 0) {
    if (x1 < minX || x1 > maxX) return;
  } else {
    let a = (minX - x1) / dx;
    let b = (maxX - x1) / dx;
    if (a > b) {
      const swap = a;
      a = b;
      b = swap;
    }
    ta = Math.max(ta, a);
    tb = Math.min(tb, b);
  }
  if (dy === 0) {
    if (y1 < minY || y1 > maxY) return;
  } else {
    let a = (minY - y1) / dy;
    let b = (maxY - y1) / dy;
    if (a > b) {
      const swap = a;
      a = b;
      b = swap;
    }
    ta = Math.max(ta, a);
    tb = Math.min(tb, b);
  }
  if (ta >= tb) return;

  // Pieces over the whole bond: the grid is fixed to the bond, so panning never shifts the vertices
  const curvature = Math.abs(amplitude) * (TAU / wavelength) * (TAU / wavelength);
  const segment = Math.min(
    MAX_SEGMENT_PX,
    Math.max(MIN_SEGMENT_PX, Math.sqrt((8 * MAX_SAGITTA_PX) / Math.max(curvature, 1e-6))),
  );
  const pieces = Math.min(400, Math.max(8, Math.ceil((1.29 * len) / segment)));
  const half = (STRAND_COUNT - 1) / 2;
  const gradientCount = res.gradients.length;

  // ── The ribbon, in the bond's own coordinates ──
  canvas.save();
  canvas.translate(x1, y1);
  canvas.rotate((Math.atan2(dy, dx) * 180) / Math.PI, 0, 0);
  canvas.scale(len, len);

  for (let j = 0; j < STRAND_COUNT; j++) {
    const c = (j - half) / half;
    const breathe = 0.92 + 0.08 * Math.sin(animSeconds * 0.5 + j * 0.9 + seed * 6);
    res.line.setShader(res.gradients[j % gradientCount]);
    res.line.setStrokeWidth((MIN_WIDTH_PX + WIDTH_RANGE_PX * hash01(j * 3.1 + 1)) / len);
    res.line.setAlphaf((MIN_ALPHA + ALPHA_RANGE * hash01(j * 5.7 + 2)) * breathe);
    drawStrand(canvas, res.line, c, j, ta, tb, pieces, len, wavelength, amplitude, taper, twist, slide, spread, animSeconds);
  }
  canvas.restore();

  const ca = dx / len;
  const sa = dy / len;

  // ── A very faint glow under the bundle: soft round lights along its middle (no edges to show) ──
  const glowStep = GLOW_SPACING_PX / len;
  for (let k = Math.ceil(ta / glowStep); k <= Math.floor(tb / glowStep); k++) {
    const u = k * glowStep;
    const open = openness(Math.min(u, 1 - u) * len, taper);
    if (open <= 0) continue;
    const v = strandOffset(0, 50, u, len, wavelength, amplitude, taper, twist, slide, spread, animSeconds);
    glowAt(
      canvas,
      res,
      x1 + u * len * ca - v * sa,
      y1 + u * len * sa + v * ca,
      18 + 0.4 * Math.abs(amplitude) * open,
      GLOW_ALPHA * open,
    );
  }

  // ── Stardust drifting along the strands, from our star toward the other ──
  for (let i = 0; i < DUST_COUNT; i++) {
    const h = hash01(i * 7.3 + seed * 31);
    const speed = DUST_MIN_SPEED + DUST_SPEED_RANGE * hash01(i * 2.9 + 5);
    const p = (((i + h) / DUST_COUNT + speed * animSeconds) % 1 + 1) % 1;
    if (p < ta || p > tb) continue;
    const strand = Math.floor(hash01(i * 4.1 + 9) * STRAND_COUNT);
    const open = openness(Math.min(p, 1 - p) * len, taper);
    const v =
      strandOffset((strand - half) / half, strand, p, len, wavelength, amplitude, taper, twist, slide, spread, animSeconds) +
      (hash01(i * 6.1 + 3) - 0.5) * 9 * open;
    const x = x1 + p * len * ca - v * sa;
    const y = y1 + p * len * sa + v * ca;
    // Fades in out of our star and out into the other one, and twinkles
    const fade = smoothstep(0, 0.1, p) * smoothstep(0, 0.1, 1 - p);
    const twinkle = 0.65 + 0.35 * Math.sin(animSeconds * (1.1 + 1.5 * h) + i * 2.1);
    const size = 0.6 + 0.7 * hash01(i * 8.3 + 4);
    glowAt(canvas, res, x, y, 3 + size * 2.4, 0.3 * fade * twinkle);
    res.core.setAlphaf(0.9 * fade * twinkle);
    canvas.drawCircle(x, y, size, res.core);
  }

  // ── A glint on each star; the other star's pulses slowly ──
  const pulse = 0.8 + 0.2 * Math.sin(animSeconds * 0.9 + seed * TAU);
  if (x1 >= -40 && x1 <= view.width + 40 && y1 >= -40 && y1 <= view.height + 40) {
    glowAt(canvas, res, x1, y1, 14, 0.3);
  }
  if (x2 >= -40 && x2 <= view.width + 40 && y2 >= -40 && y2 <= view.height + 40) {
    glowAt(canvas, res, x2, y2, 20, 0.45 * pulse);
    const spark = 4 + 2.5 * pulse;
    res.spark.setAlphaf(0.55 * pulse);
    canvas.drawLine(x2 - spark, y2, x2 + spark, y2, res.spark);
    canvas.drawLine(x2, y2 - spark, x2, y2 + spark, res.spark);
  }
}
