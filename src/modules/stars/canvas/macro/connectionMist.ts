/**
 * The bond between two connected stars: a soft, curved band of mist.
 *
 * It replaces the old flowing dashed line with a ball running along it. The mist is made of
 * overlapping soft glows ("puffs") laid along a gentle arc between the two stars:
 *   • haze  – very large, faint puffs: a cloud around the bond;
 *   • body  – medium puffs that give the band its substance;
 *   • two wisps – thin threads of smoke that wander further to either side and weave across
 *     the body and each other, so the band looks like vapour rather than a tube;
 *   • every layer drifts sideways with its own slow, out-of-step waves, so nothing is a straight,
 *     rigid line;
 *   • a slow swell of brightness travels from our star to the other one (no particle);
 *   • the colour runs from pale gold at our star through rose to lavender at the other star.
 * Puffs sit on a grid fixed to the bond, so zooming or panning slides them smoothly and only the
 * visible part of a long bond is drawn.
 *
 * Pure worklets with no React Native imports (types only), so the same code runs on the UI
 * thread and in Node tests with a fake canvas.
 */

import type { SkCanvas, SkPaint, SkShader } from '@shopify/react-native-skia';
import { smoothstep } from './starStyle';

/** Mist colours from our star (index 0) to the connected star (last): gold, rose, pink, orchid, lavender. */
export const MIST_COLORS = ['#FDE68A', '#FDA4AF', '#F472B6', '#C084FC', '#A5B4FC'] as const;

/**
 * Falloff of one puff from its centre (0) to its edge (1). Flatter in the middle than a star's glow:
 * a sharp centre makes every puff read as a bead instead of blending into vapour.
 */
export const MIST_FALLOFF_STOPS = [0, 0.3, 0.6, 0.85, 1] as const;
export const MIST_FALLOFF_ALPHAS = [0.62, 0.5, 0.24, 0.07, 0] as const;

/** Distance between puffs along the bond, in pixels. */
const HAZE_SPACING_PX = 26;
const BODY_SPACING_PX = 13;
const WISP_SPACING_PX = 14;
/** Short bonds still get at least this many puffs per layer. */
const MIN_PUFFS = 8;
/** The arc bows away from the straight line by this share of the bond's length, up to the cap. */
const BOW_RATIO = 0.17;
const MAX_BOW_PX = 120;
/** Peak opacity of one puff (they overlap and add up). */
const HAZE_ALPHA = 0.075;
const BODY_ALPHA = 0.09;
const WISP_ALPHA = 0.085;
const END_BLOOM_ALPHA = 0.4;

/** The parts of a canvas the mist draws with (a fake in tests). */
export type MistCanvas = Pick<SkCanvas, 'save' | 'restore' | 'translate' | 'scale' | 'drawCircle'>;
export type MistPaint = SkPaint;

export interface MistView {
  readonly width: number;
  readonly height: number;
}

/** A soft round glow centred on x/y that fades out at `reach` pixels. */
function puff(
  canvas: MistCanvas,
  paint: MistPaint,
  shader: SkShader,
  x: number,
  y: number,
  reach: number,
  alpha: number,
) {
  'worklet';
  if (alpha <= 0.004 || reach <= 0) return;
  paint.setShader(shader);
  paint.setAlphaf(Math.min(1, alpha));
  canvas.save();
  canvas.translate(x, y);
  canvas.scale(reach, reach);
  canvas.drawCircle(0, 0, 1, paint);
  canvas.restore();
}

/**
 * One layer of puffs along the arc P0 → C → P2 between parameters ta…tb.
 * `drift` is the sideways wander in pixels, `speed` how fast it wanders.
 */
function mistLayer(
  canvas: MistCanvas,
  paint: MistPaint,
  shaders: readonly SkShader[],
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  x2: number,
  y2: number,
  nx: number,
  ny: number,
  len: number,
  ta: number,
  tb: number,
  seed: number,
  animSeconds: number,
  spacingPx: number,
  reach: number,
  alpha: number,
  drift: number,
  speed: number,
) {
  'worklet';
  const step = Math.min(spacingPx / len, 1 / MIN_PUFFS);
  // Fewer, denser puffs on very short bonds would glow too bright: keep the total light steady
  const density = Math.min(1.2, Math.max(0.35, (step * len) / spacingPx));
  const colorCount = shaders.length;
  const first = Math.ceil(ta / step);
  const last = Math.floor(tb / step);

  for (let k = first; k <= last; k++) {
    const t = k * step;
    const u = 1 - t;
    const bx = u * u * x1 + 2 * u * t * cx + t * t * x2;
    const by = u * u * y1 + 2 * u * t * cy + t * t * y2;
    // 0 at both stars → 1 mid-way: the mist is calm near the stars and wanders most between them
    const mid = Math.sin(Math.PI * t);
    // Smooth waves along the bond (about 1.5 and 3 wavelengths) that slowly travel, plus a faint per-puff
    // wobble so the band is not a clean sine
    const wander =
      Math.sin(t * 9 + animSeconds * speed + seed * 40) * 0.55 +
      Math.sin(t * 19 - animSeconds * speed * 0.6 + seed * 17) * 0.33 +
      Math.sin(k * 2.1 + animSeconds * speed * 1.3 + seed * 5) * 0.12;
    const offset = wander * drift * (0.2 + 0.8 * mid);
    // A slow swell of light travelling from our star to the other one
    const swell = 0.72 + 0.28 * Math.cos((t * 1.4 - animSeconds * 0.1 + seed) * 6.2832);
    const endFade = 0.3 + 0.7 * smoothstep(0, 0.16, Math.min(t, 1 - t));
    const breathe = 0.8 + 0.2 * Math.sin(k * 2.3 + seed * 9 + animSeconds * 0.4);
    const colorIndex = Math.min(colorCount - 1, Math.floor(t * colorCount));

    puff(
      canvas,
      paint,
      shaders[colorIndex],
      bx + nx * offset,
      by + ny * offset,
      reach * breathe * (0.7 + 0.3 * mid),
      alpha * swell * endFade * density,
    );
  }
}

/**
 * Draws the mist between two screen points. `seed` (0…1, fixed per bond) picks which way the arc
 * bows and offsets the wave phases, so several bonds never move in lockstep.
 */
export function drawConnectionMist(
  canvas: MistCanvas,
  paint: MistPaint,
  shaders: readonly SkShader[],
  view: MistView,
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
  if (len < 4) return;
  const nx = -dy / len;
  const ny = dx / len;

  // The arc bows to one side and sways a little over time
  const side = seed < 0.5 ? -1 : 1;
  const sway = 1 + 0.14 * Math.sin(animSeconds * 0.35 + seed * 6.2832);
  const bow = side * Math.min(len * BOW_RATIO, MAX_BOW_PX) * sway;
  const cx = (x1 + x2) / 2 + nx * bow;
  const cy = (y1 + y2) / 2 + ny * bow;

  // Visible part of the bond (Liang–Barsky on the chord, with room for the arc and the puffs)
  const margin = MAX_BOW_PX + 90;
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

  // Band width grows with the bond's length, but stays modest
  const widthPx = 6 + Math.min(len, 500) * 0.03;

  mistLayer(
    canvas, paint, shaders, x1, y1, cx, cy, x2, y2, nx, ny, len, ta, tb, seed, animSeconds,
    HAZE_SPACING_PX, widthPx * 3.4, HAZE_ALPHA, widthPx * 0.9, 0.35,
  );
  mistLayer(
    canvas, paint, shaders, x1, y1, cx, cy, x2, y2, nx, ny, len, ta, tb, seed + 0.31, animSeconds,
    BODY_SPACING_PX, widthPx * 1.85, BODY_ALPHA, widthPx * 0.6, 0.5,
  );
  mistLayer(
    canvas, paint, shaders, x1, y1, cx, cy, x2, y2, nx, ny, len, ta, tb, seed + 0.57, animSeconds,
    WISP_SPACING_PX, widthPx * 1.4, WISP_ALPHA, widthPx * 1.5, 0.55,
  );
  mistLayer(
    canvas, paint, shaders, x1, y1, cx, cy, x2, y2, nx, ny, len, ta, tb, seed + 0.83, animSeconds,
    WISP_SPACING_PX, widthPx * 1.3, WISP_ALPHA * 0.9, widthPx * 1.7, 0.4,
  );

  // A soft bloom where the mist meets each star; the other star's pulses slowly
  const pulse = 0.8 + 0.2 * Math.sin(animSeconds * 0.9 + seed * 6.2832);
  const lastShader = shaders[shaders.length - 1];
  if (x1 >= -60 && x1 <= view.width + 60 && y1 >= -60 && y1 <= view.height + 60) {
    puff(canvas, paint, shaders[0], x1, y1, widthPx * 2.6, END_BLOOM_ALPHA * 0.7);
  }
  if (x2 >= -60 && x2 <= view.width + 60 && y2 >= -60 && y2 <= view.height + 60) {
    puff(canvas, paint, lastShader, x2, y2, widthPx * 3, END_BLOOM_ALPHA * pulse);
  }
}
