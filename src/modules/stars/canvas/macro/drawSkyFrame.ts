import type {
  SkCanvas,
  SkHostRect,
  SkPaint,
  SkPathEffect,
  SkPicture,
  SkPictureRecorder,
  SkShader,
} from '@shopify/react-native-skia';
import { Skia } from '../skiaBridge';
import {
  activeMeteorsInView,
  meteorHead,
  meteorSegment,
  type CaughtMeteor,
  type MeteorEvent,
  type MeteorSegment,
} from './meteorSchedule';
import type { SkyOverlay } from './skyOverlay';
import { pxPerDegree, shortestRaDelta, type SkyCamera } from './skyProjection';
import { colorOf, STAR_FADE_MS, type StarField, type StarRender } from './starField';
import {
  MAGNITUDE_FADE,
  MAX_STAR_BASE_RADIUS_PX,
  smoothstep,
  starActivity,
  starRadius,
  starZoomBonus,
  twinkleFactor,
  visibleMagnitudeLimit,
} from './starStyle';

/** Shooting-star input of a frame: the wall clock and the last caught meteor. */
export interface MeteorFrame {
  /** Wall-clock (epoch) time of the frame, in milliseconds. */
  readonly nowMs: number;
  readonly caught: CaughtMeteor | null;
}

/**
 * Per-frame drawing, run on the UI thread. Stars are drawn at their exact
 * size for the current zoom; markers and labels are pre-recorded pictures
 * that are only positioned. Off-screen cells, stars and labels are culled.
 */

/** Sector names show below this zoom and fade out towards it. */
const SECTOR_LABEL_FADE = [1.7, 2.0] as const;
/** Claimed-star name pills fade in across this zoom range. */
const CLAIMED_LABEL_FADE = [3.6, 4.0] as const;
/** Medium-zoom glows blend in across this zoom range (was a hard switch at 1.5). */
const GLOW_BLEND = [1.3, 1.7] as const;
/** Close-zoom halos and hot centres blend in across this range (was a hard switch at 4). */
const DETAIL_BLEND = [3.6, 4.4] as const;
/** Furthest a star's glow or halo reaches past its radius, in pixels. */
const STAR_REACH_PX = 24;
/** Connection lines: 4 px dashes with 6 px gaps, flowing away from our star. */
const CONNECTION_DASH = [4, 6];
const CONNECTION_DASH_PERIOD_PX = 10;
const CONNECTION_FLOW_PX_PER_SEC = 24;
/** Meteor streak tints: icy for ordinary meteors, warm for fireballs. */
const METEOR_TINT = '#CFE6FF';
const FIREBALL_TINT = '#FFE2B3';

/**
 * Every Skia object a frame draws with, made once per canvas and reused every
 * frame (UI thread only), so recording a frame creates nothing native but its
 * canvas and picture. Frames are recorded 60-120 times a second, and native
 * objects weigh on the garbage collector beyond their size: a shader or a
 * picture recorder reports 1 MB to it.
 */
export interface StarPaints {
  readonly fill: SkPaint;
  readonly stroke: SkPaint;
  readonly white: Float32Array;
  readonly gold: Float32Array;
  readonly purple: Float32Array;
  readonly paleGold: Float32Array;
  /** Opacity of a fading group of labels (see beginAlphaLayer). */
  readonly layer: SkPaint;
  /** Dashed line from our star to each connected star. */
  readonly connectionLine: SkPaint;
  /**
   * The dash pattern at every offset the flow can take: react-native-skia
   * hands Skia the offset as a whole number of pixels.
   */
  readonly connectionDashes: readonly SkPathEffect[];
  /** Bright particle travelling along each connection line. */
  readonly connectionParticle: SkPaint;
  /** Soft, blurred halo along a meteor's streak. */
  readonly meteorGlow: SkPaint;
  /** Thin bright core of a meteor's streak. */
  readonly meteorCore: SkPaint;
  /** Head glow and the catch burst (fill), blurred. */
  readonly meteorHalo: SkPaint;
  /** Expanding rings of the catch burst. */
  readonly meteorRing: SkPaint;
  /** Streak gradients along the unit x axis (see streakShader). */
  readonly meteorGlowShader: SkShader;
  readonly fireballGlowShader: SkShader;
  readonly meteorCoreShader: SkShader;
  readonly meteorTint: Float32Array;
  readonly fireballTint: Float32Array;
  /** Rewritten for each orbit ring drawn. */
  readonly orbitRect: SkHostRect;
  /** Every frame is recorded with this recorder, within these bounds. */
  readonly recorder: SkPictureRecorder;
  readonly frameBounds: SkHostRect;
}

/**
 * A meteor streak's gradient, laid along the unit x axis from the tail (0, 0)
 * to the head (1, 0); drawMeteorStreak maps that segment onto each streak and
 * scales the gradient's alpha with the paint's.
 */
function streakShader(hex: string, alphas: readonly number[], positions: readonly number[]) {
  return Skia.Shader.MakeLinearGradient(
    Skia.Point(0, 0),
    Skia.Point(1, 0),
    alphas.map((alpha) => colorOf(hex, alpha)),
    [...positions],
    0,
  );
}

export function createStarPaints(): StarPaints {
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  const stroke = Skia.Paint();
  stroke.setAntiAlias(true);
  stroke.setStyle(1);
  stroke.setStrokeWidth(1.25);
  const paleGold = colorOf('#FDE68A', 1);

  const connectionLine = Skia.Paint();
  connectionLine.setAntiAlias(true);
  connectionLine.setStyle(1);
  connectionLine.setStrokeWidth(1.6);
  connectionLine.setColor(colorOf('#FBBF24', 0.55));
  const connectionDashes: SkPathEffect[] = [];
  for (let offset = 0; offset < CONNECTION_DASH_PERIOD_PX; offset++) {
    connectionDashes.push(Skia.PathEffect.MakeDash(CONNECTION_DASH, -offset));
  }
  const connectionParticle = Skia.Paint();
  connectionParticle.setAntiAlias(true);
  connectionParticle.setColor(paleGold);

  const meteorGlow = Skia.Paint();
  meteorGlow.setAntiAlias(true);
  meteorGlow.setStyle(1);
  meteorGlow.setStrokeCap(1); // round
  meteorGlow.setMaskFilter(Skia.MaskFilter.MakeBlur(0, 3.5, false));
  const meteorCore = Skia.Paint();
  meteorCore.setAntiAlias(true);
  meteorCore.setStyle(1);
  meteorCore.setStrokeCap(1);
  const meteorHalo = Skia.Paint();
  meteorHalo.setAntiAlias(true);
  meteorHalo.setMaskFilter(Skia.MaskFilter.MakeBlur(0, 4, false));
  const meteorRing = Skia.Paint();
  meteorRing.setAntiAlias(true);
  meteorRing.setStyle(1);

  return {
    fill,
    stroke,
    white: colorOf('#FFFFFF', 1),
    gold: colorOf('#F59E0B', 1),
    purple: colorOf('#A855F7', 1),
    paleGold,
    layer: Skia.Paint(),
    connectionLine,
    connectionDashes,
    connectionParticle,
    meteorGlow,
    meteorCore,
    meteorHalo,
    meteorRing,
    meteorGlowShader: streakShader(METEOR_TINT, [0, 0.55], [0, 1]),
    fireballGlowShader: streakShader(FIREBALL_TINT, [0, 0.55], [0, 1]),
    meteorCoreShader: streakShader('#FFFFFF', [0, 0.55, 1], [0, 0.7, 1]),
    meteorTint: colorOf(METEOR_TINT, 1),
    fireballTint: colorOf(FIREBALL_TINT, 1),
    orbitRect: Skia.XYWHRect(0, 0, 0, 0),
    recorder: Skia.PictureRecorder(),
    frameBounds: Skia.XYWHRect(0, 0, 0, 0),
  };
}

interface FrameView {
  readonly camera: SkyCamera;
  readonly scale: number;
  readonly width: number;
  readonly height: number;
}

function screenX(view: FrameView, ra: number): number {
  'worklet';
  return view.width / 2 + shortestRaDelta(view.camera.ra, ra) * view.scale;
}

function screenY(view: FrameView, dec: number): number {
  'worklet';
  return view.height / 2 - (dec - view.camera.dec) * view.scale;
}

function isOnScreen(view: FrameView, x: number, y: number, margin: number): boolean {
  'worklet';
  return x >= -margin && x <= view.width + margin && y >= -margin && y <= view.height + margin;
}

function drawAt(canvas: SkCanvas, picture: SkPicture, x: number, y: number, scale = 1) {
  'worklet';
  canvas.save();
  canvas.translate(x, y);
  if (scale !== 1) canvas.scale(scale, scale);
  canvas.drawPicture(picture);
  canvas.restore();
}

function beginAlphaLayer(canvas: SkCanvas, paints: StarPaints, alpha: number) {
  'worklet';
  // The recording canvas copies the paint, so the next layer can reuse it.
  paints.layer.setAlphaf(alpha);
  canvas.saveLayer(paints.layer);
}

// ─── Stars ─────────────────────────────────────────────────────────────────

function mix(from: number, to: number, amount: number): number {
  'worklet';
  return from + (to - from) * amount;
}

/** Per-frame star style weights, shared by every star of a frame. */
interface StarFrameStyle {
  readonly zoomBonus: number;
  readonly magnitudeLimit: number;
  /** 0 far out → 1 from medium zoom: soft glows around the core. */
  readonly glow: number;
  /** 0 → 1 close in: halo, aura and white-hot centre. */
  readonly detail: number;
}

/**
 * One star at screen position x/y. The look follows the previous renderer's
 * low/medium/high styles, but blends them with zoom instead of switching.
 */
function drawStar(
  canvas: SkCanvas,
  paints: StarPaints,
  rgb: Float32Array,
  star: StarRender,
  x: number,
  y: number,
  opacity: number,
  style: StarFrameStyle,
) {
  'worklet';
  const { fill, stroke } = paints;
  const r = star.radius * style.zoomBonus;
  const detail = style.detail;
  // A claimed star glows as strongly as its couple is active at every zoom, so
  // lively stars stand out even in the overview. Unclaimed stars share one
  // faint baseline glow that fades in from medium zoom; close in, the halo
  // below takes over.
  const glow = star.luminosity * (star.claimed ? 1 : style.glow * 0.6) * (1 - detail);
  fill.setColor(rgb);

  if (detail > 0.01 && star.claimed && !star.resonance) {
    fill.setAlphaf(0.4 * star.luminosity * detail * opacity);
    canvas.drawCircle(x, y, r + 14, fill);
  }
  if (glow > 0.01) {
    const outerHaloR = star.claimed ? r * 2.5 : r * 1.4;
    const innerHaloR = star.claimed ? r * 1.6 : r * 1.2;
    fill.setAlphaf((star.claimed ? 0.25 : 0.12) * glow * opacity);
    canvas.drawCircle(x, y, outerHaloR, fill);
    fill.setAlphaf((star.claimed ? 0.45 : 0.25) * glow * opacity);
    canvas.drawCircle(x, y, innerHaloR, fill);
  }
  if (detail > 0.01) {
    const detailHaloR = star.claimed ? r * 2.2 : r * 1.3;
    fill.setAlphaf(star.alpha * (star.claimed ? 0.45 : 0.18) * detail * opacity);
    canvas.drawCircle(x, y, detailHaloR, fill);
  }
  // Far out, resonating stars show only their rings (as before).
  const core = star.resonance ? style.glow : 1;
  if (core > 0.01) {
    fill.setAlphaf(star.alpha * core * opacity);
    canvas.drawCircle(x, y, r, fill);
  }
  // Only activity heats a star's centre white; unclaimed stars have none.
  const heat = starActivity(star.luminosity);
  if (detail > 0.01 && heat > 0.01) {
    fill.setColor(paints.white);
    fill.setAlphaf(Math.min(1, star.alpha * 1.2) * heat * detail * opacity);
    canvas.drawCircle(x, y, Math.max(1, r * 0.35), fill);
  }
  if (star.resonance) {
    stroke.setColor(paints.gold);
    stroke.setAlphaf(mix(0.9, 0.5 * star.luminosity, detail) * opacity);
    canvas.drawCircle(x, y, mix(mix(r * 1.9, r * 2.2, style.glow), r + 20, detail), stroke);
    stroke.setColor(paints.purple);
    stroke.setAlphaf(mix(mix(0.9, 0.8, style.glow), 0.6 * star.luminosity, detail) * opacity);
    canvas.drawCircle(x, y, mix(mix(r * 1.35, r * 1.75, style.glow), r + 10, detail), stroke);
  }
}

function drawStars(
  canvas: SkCanvas,
  view: FrameView,
  field: StarField,
  clock: number,
  animSeconds: number,
  paints: StarPaints,
) {
  'worklet';
  const { camera, scale, width, height } = view;
  const zoom = camera.zoom;
  const style: StarFrameStyle = {
    zoomBonus: starZoomBonus(zoom),
    magnitudeLimit: visibleMagnitudeLimit(zoom),
    glow: smoothstep(GLOW_BLEND[0], GLOW_BLEND[1], zoom),
    detail: smoothstep(DETAIL_BLEND[0], DETAIL_BLEND[1], zoom),
  };
  const halfWidthDeg = width / 2 / scale;
  const halfHeightDeg = height / 2 / scale;
  // Largest star radius (a fully lit one) plus its reach.
  const marginDeg = (MAX_STAR_BASE_RADIUS_PX * style.zoomBonus * 2.5 + STAR_REACH_PX) / scale;

  for (const cell of field.cells) {
    if (cell.minDec - marginDeg > camera.dec + halfHeightDeg) continue;
    if (cell.maxDec + marginDeg < camera.dec - halfHeightDeg) continue;
    const cellHalfWidth = (cell.maxRa - cell.minRa) / 2;
    const cellOffset = Math.abs(shortestRaDelta(camera.ra, cell.minRa + cellHalfWidth));
    if (cellOffset - cellHalfWidth - marginDeg > halfWidthDeg) continue;

    for (const star of cell.stars) {
      const visibility = star.claimed
        ? 1
        : Math.min(1, (style.magnitudeLimit + MAGNITUDE_FADE - star.magnitude) / MAGNITUDE_FADE);
      if (visibility <= 0.01) continue;
      const fade = star.bornAt > 0 ? Math.max(0, Math.min(1, (clock - star.bornAt) / STAR_FADE_MS)) : 1;
      const twinkle = twinkleFactor(star.luminosity, star.ra, star.dec, animSeconds);
      const opacity = visibility * fade * twinkle;
      if (opacity <= 0.01) continue;

      const x = width / 2 + shortestRaDelta(camera.ra, star.ra) * scale;
      const y = height / 2 - (star.dec - camera.dec) * scale;
      const reach = star.radius * style.zoomBonus * 2.5 + STAR_REACH_PX;
      if (x < -reach || x > width + reach || y < -reach || y > height + reach) continue;
      drawStar(canvas, paints, field.palette[star.color], star, x, y, opacity, style);
    }
  }
}

// ─── Overlay ───────────────────────────────────────────────────────────────

function drawMilkyWay(canvas: SkCanvas, view: FrameView, overlay: SkyOverlay) {
  'worklet';
  for (const band of overlay.milkyWay) {
    const radius = band.radiusDeg * view.scale;
    const x = screenX(view, band.ra);
    const y = screenY(view, band.dec);
    if (!isOnScreen(view, x, y, radius)) continue;
    drawAt(canvas, band.picture, x, y, radius);
  }
}

function drawNebulae(canvas: SkCanvas, view: FrameView, overlay: SkyOverlay) {
  'worklet';
  for (const nebula of overlay.nebulae) {
    const radius = nebula.radiusDeg * view.scale;
    const x = screenX(view, nebula.ra);
    const y = screenY(view, nebula.dec);
    if (!isOnScreen(view, x, y, radius)) continue;
    drawAt(canvas, nebula.picture, x, y, radius);
  }
}

function drawSectorLabels(canvas: SkCanvas, view: FrameView, overlay: SkyOverlay, paints: StarPaints) {
  'worklet';
  const alpha = 1 - smoothstep(SECTOR_LABEL_FADE[0], SECTOR_LABEL_FADE[1], view.camera.zoom);
  if (alpha <= 0.002 || overlay.sectorLabels.length === 0) return;
  if (alpha < 0.998) beginAlphaLayer(canvas, paints, alpha);
  for (const label of overlay.sectorLabels) {
    const x = screenX(view, label.ra);
    const y = screenY(view, label.dec);
    if (!isOnScreen(view, x, y, 80)) continue;
    drawAt(canvas, label.picture, x, y + 12);
  }
  if (alpha < 0.998) canvas.restore();
}

/** Segments follow the shortest arc, so lines crossing RA 0° never tear. */
function drawConstellations(canvas: SkCanvas, view: FrameView, overlay: SkyOverlay) {
  'worklet';
  const segments = overlay.constellations;
  const { width, height, scale } = view;
  for (let index = 0; index + 3 < segments.length; index += 4) {
    const x1 = screenX(view, segments[index]);
    const y1 = screenY(view, segments[index + 1]);
    const x2 = x1 + shortestRaDelta(segments[index], segments[index + 2]) * scale;
    const y2 = y1 - (segments[index + 3] - segments[index + 1]) * scale;
    if ((x1 < 0 && x2 < 0) || (x1 > width && x2 > width) || (y1 < 0 && y2 < 0) || (y1 > height && y2 > height)) continue;
    canvas.drawLine(x1, y1, x2, y2, overlay.constellationPaint);
  }
}

/** Deterministic 0…1 offset from a world point, so lines don't pulse in lockstep. */
function connectionPhase(ra: number, dec: number): number {
  'worklet';
  const seed = ra * 12.9898 + dec * 78.233;
  return seed - Math.floor(seed);
}

/** Flowing dashed stroke plus a travelling bright particle, for a "living" bond. */
function drawConnectionLines(
  canvas: SkCanvas,
  view: FrameView,
  overlay: SkyOverlay,
  paints: StarPaints,
  animSeconds: number,
) {
  'worklet';
  const hero = overlay.hero;
  if (!hero || overlay.connections.length === 0) return;
  const { width, height, scale } = view;
  const x1 = screenX(view, hero.ra);
  const y1 = screenY(view, hero.dec);

  const { connectionLine: flowPaint, connectionParticle: particle } = paints;
  const dashOffset = Math.floor((animSeconds * CONNECTION_FLOW_PX_PER_SEC) % CONNECTION_DASH_PERIOD_PX);
  flowPaint.setPathEffect(paints.connectionDashes[dashOffset]);

  for (const connection of overlay.connections) {
    const x2 = x1 + shortestRaDelta(hero.ra, connection.ra) * scale;
    const y2 = y1 - (connection.dec - hero.dec) * scale;
    if ((x1 < 0 && x2 < 0) || (x1 > width && x2 > width) || (y1 < 0 && y2 < 0) || (y1 > height && y2 > height)) continue;
    canvas.drawLine(x1, y1, x2, y2, flowPaint);
    if (isOnScreen(view, x2, y2, 40)) drawAt(canvas, overlay.connectionNode, x2, y2);

    const t = (animSeconds * 0.35 + connectionPhase(connection.ra, connection.dec)) % 1;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    if (!isOnScreen(view, px, py, 12)) continue;
    particle.setAlphaf(0.35);
    canvas.drawCircle(px, py, 6, particle);
    particle.setAlphaf(0.9);
    canvas.drawCircle(px, py, 2.4, particle);
  }
}

// ─── Shooting stars ────────────────────────────────────────────────────────

/** Length of the burst drawn where a meteor was caught. */
export const METEOR_CATCH_BURST_MS = 900;

/** Stroke width of a meteor's core at a zoom: thin far out, a little bolder up close. */
function meteorWidth(event: MeteorEvent, zoom: number): number {
  'worklet';
  return Math.min(1.7, Math.max(0.9, 0.85 + 0.12 * zoom)) * (event.fireball ? 1.5 : 1);
}

/** A meteor's streak: blurred tinted halo, bright tapering core and a glowing head. */
function drawMeteorStreak(
  canvas: SkCanvas,
  paints: StarPaints,
  segment: MeteorSegment,
  event: MeteorEvent,
  zoom: number,
  alphaScale: number,
) {
  'worklet';
  const alpha = segment.alpha * alphaScale;
  if (alpha <= 0.01) return;
  const { headX, headY, tailX, tailY } = segment;
  const width = meteorWidth(event, zoom);

  // Right after launch the streak has no length yet; only the head shows.
  const length = Math.hypot(headX - tailX, headY - tailY);
  if (length > 0.5) {
    // The canvas lays the gradients' unit segment over tail → head. Its scale
    // is uniform, so the round caps stay round; widths are divided by it to
    // stay in pixels, and the blur ignores the canvas matrix.
    canvas.save();
    canvas.translate(tailX, tailY);
    canvas.rotate((Math.atan2(headY - tailY, headX - tailX) * 180) / Math.PI, 0, 0);
    canvas.scale(length, length);
    paints.meteorGlow.setShader(event.fireball ? paints.fireballGlowShader : paints.meteorGlowShader);
    paints.meteorGlow.setAlphaf(alpha);
    paints.meteorGlow.setStrokeWidth((width * 4) / length);
    canvas.drawLine(0, 0, 1, 0, paints.meteorGlow);
    paints.meteorCore.setShader(paints.meteorCoreShader);
    paints.meteorCore.setAlphaf(alpha);
    paints.meteorCore.setStrokeWidth((width * 1.4) / length);
    canvas.drawLine(0, 0, 1, 0, paints.meteorCore);
    canvas.restore();
  }

  paints.meteorHalo.setColor(event.fireball ? paints.fireballTint : paints.meteorTint);
  paints.meteorHalo.setAlphaf(alpha * (event.fireball ? 0.6 : 0.45));
  canvas.drawCircle(headX, headY, width * (event.fireball ? 6.5 : 4), paints.meteorHalo);
  paints.fill.setColor(paints.white);
  paints.fill.setAlphaf(alpha);
  canvas.drawCircle(headX, headY, width * 1.25, paints.fill);
}

/**
 * Meteors in flight now, each placed among the stars (world space), plus the
 * burst of a just-caught one: its streak freezes and fades while a glint and
 * two rings open where its head was.
 */
function drawMeteors(canvas: SkCanvas, view: FrameView, paints: StarPaints, meteors: MeteorFrame) {
  'worklet';
  const { camera, width, height } = view;
  const { nowMs, caught } = meteors;
  if (nowMs <= 0) return;

  for (const event of activeMeteorsInView(nowMs, camera, width, height)) {
    if (caught && caught.event.id === event.id) continue;
    const segment = meteorSegment(event, nowMs, camera, width, height);
    if (segment) drawMeteorStreak(canvas, paints, segment, event, camera.zoom, 1);
  }

  if (!caught) return;
  const elapsed = nowMs - caught.atMs;
  if (elapsed < 0 || elapsed > METEOR_CATCH_BURST_MS) return;
  const t = elapsed / METEOR_CATCH_BURST_MS;

  const frozen = meteorSegment(caught.event, caught.atMs, camera, width, height);
  if (frozen) drawMeteorStreak(canvas, paints, frozen, caught.event, camera.zoom, 1 - smoothstep(0, 0.3, t));

  const head = meteorHead(caught.event, caught.atMs);
  const x = screenX(view, head.ra);
  const y = screenY(view, head.dec);
  if (!isOnScreen(view, x, y, 80)) return;
  const fade = 1 - t;
  const open = 1 - fade * fade * fade;

  paints.meteorHalo.setColor(paints.paleGold);
  paints.meteorHalo.setAlphaf(0.55 * fade);
  canvas.drawCircle(x, y, 10 + open * 26, paints.meteorHalo);

  // Four-point glint
  const glint = 6 + 16 * (1 - Math.abs(1 - 2 * Math.min(1, t * 2)));
  paints.meteorCore.setShader(null);
  paints.meteorCore.setColor(paints.white);
  paints.meteorCore.setAlphaf(0.9 * fade);
  paints.meteorCore.setStrokeWidth(1.4);
  canvas.drawLine(x - glint, y, x + glint, y, paints.meteorCore);
  canvas.drawLine(x, y - glint, x, y + glint, paints.meteorCore);

  paints.meteorRing.setColor(paints.paleGold);
  paints.meteorRing.setAlphaf(0.85 * fade);
  paints.meteorRing.setStrokeWidth(1.6);
  canvas.drawCircle(x, y, 6 + open * 46, paints.meteorRing);
  const late = Math.max(0, Math.min(1, (t - 0.15) / 0.85));
  if (late > 0) {
    paints.meteorRing.setColor(paints.white);
    paints.meteorRing.setAlphaf(0.6 * (1 - late));
    paints.meteorRing.setStrokeWidth(1.2);
    canvas.drawCircle(x, y, 4 + (1 - (1 - late) * (1 - late)) * 28, paints.meteorRing);
  }

  paints.fill.setColor(paints.white);
  paints.fill.setAlphaf(fade);
  canvas.drawCircle(x, y, 2 + 6 * fade, paints.fill);
}

function sunRadius(zoom: number): number {
  'worklet';
  return Math.max(16, 20 * Math.min(3, 1 + (zoom - 1) * 0.12));
}

function drawSolarSystem(canvas: SkCanvas, view: FrameView, overlay: SkyOverlay) {
  'worklet';
  const radius = sunRadius(view.camera.zoom);
  for (const body of overlay.solar) {
    const x = screenX(view, body.ra);
    const y = screenY(view, body.dec);
    if (!isOnScreen(view, x, y, body.isSun ? radius * 2.8 : 40)) continue;
    drawAt(canvas, body.picture, x, y, body.isSun ? radius : 1);
  }
}

/** Her gezegenin yörüngesi: Güneş merkezli silik elips. Tamamen ekran dışındakiler atlanır. */
function drawOrbits(canvas: SkCanvas, view: FrameView, overlay: SkyOverlay, paints: StarPaints) {
  'worklet';
  const { orbits, orbitPaint } = overlay;
  const { orbitRect } = paints;
  const cx = screenX(view, orbits.ra);
  const cy = screenY(view, orbits.dec);
  for (const ring of orbits.rings) {
    const rx = ring.rx * view.scale;
    const ry = ring.ry * view.scale;
    if (cx + rx < 0 || cx - rx > view.width || cy + ry < 0 || cy - ry > view.height) continue;
    // The recording canvas copies the rect, so the next ring can reuse it.
    orbitRect.setXYWH(cx - rx, cy - ry, rx * 2, ry * 2);
    canvas.drawOval(orbitRect, orbitPaint);
  }
}

function drawHero(canvas: SkCanvas, view: FrameView, overlay: SkyOverlay, animSeconds: number) {
  'worklet';
  const hero = overlay.hero;
  if (!hero) return;
  const x = screenX(view, hero.ra);
  const y = screenY(view, hero.dec);
  if (!isOnScreen(view, x, y, 60)) return;

  // Çift yörünge halkalarının nefes alan canlı hissi vermesi için çok hafif harmonik nabız
  // Işıma, yıldızın kendisiyle aynı oranda yakınlaştıkça büyür
  const pulse = (1 + 0.025 * Math.sin(animSeconds * 1.5)) * (0.7 + 0.3 * starZoomBonus(view.camera.zoom));
  canvas.save();
  canvas.translate(x, y);
  if (pulse !== 1) canvas.scale(pulse, pulse);
  canvas.drawPicture(hero.picture);
  canvas.restore();
}

function drawLabels(canvas: SkCanvas, view: FrameView, overlay: SkyOverlay, paints: StarPaints) {
  'worklet';
  const zoom = view.camera.zoom;
  const { scale } = view;

  const claimedAlpha = smoothstep(CLAIMED_LABEL_FADE[0], CLAIMED_LABEL_FADE[1], zoom);
  if (claimedAlpha > 0.002 && overlay.claimedLabels.length > 0) {
    if (claimedAlpha < 0.998) beginAlphaLayer(canvas, paints, claimedAlpha);
    for (const item of overlay.claimedLabels) {
      const x = screenX(view, item.ra);
      const y = screenY(view, item.dec);
      if (!isOnScreen(view, x, y, 120)) continue;
      drawAt(canvas, item.label, x, y + starRadius(item.light, zoom) + 20);
    }
    if (claimedAlpha < 0.998) canvas.restore();
  }

  const hero = overlay.hero;
  if (hero) {
    const heroX = screenX(view, hero.ra);
    const heroY = screenY(view, hero.dec);
    for (const connection of overlay.connections) {
      if (!connection.label) continue;
      const x = heroX + shortestRaDelta(hero.ra, connection.ra) * scale;
      const y = heroY - (connection.dec - hero.dec) * scale;
      if (isOnScreen(view, x, y, 120)) drawAt(canvas, connection.label, x, y + 22);
    }
  }

  const radius = sunRadius(zoom);
  for (const body of overlay.solar) {
    if (!body.label) continue;
    const x = screenX(view, body.ra);
    const y = screenY(view, body.dec);
    if (!isOnScreen(view, x, y, 120)) continue;
    drawAt(canvas, body.label, x, y + (body.isSun ? radius : 0) + body.labelOffsetY);
  }

  if (hero?.label) {
    const x = screenX(view, hero.ra);
    const y = screenY(view, hero.dec);
    if (isOnScreen(view, x, y, 120)) drawAt(canvas, hero.label, x, y + 24);
  }
}

/** One full frame: background, sky furniture, stars, then markers and labels. */
export function drawSkyFrame(
  canvas: SkCanvas,
  camera: SkyCamera,
  field: StarField,
  overlay: SkyOverlay | null,
  clock: number,
  animSeconds: number,
  meteors: MeteorFrame,
  paints: StarPaints,
  width: number,
  height: number,
) {
  'worklet';
  const view: FrameView = { camera, scale: pxPerDegree(camera.zoom, height), width, height };
  if (overlay) {
    canvas.drawPicture(overlay.background);
    drawMilkyWay(canvas, view, overlay);
    drawNebulae(canvas, view, overlay);
    drawSectorLabels(canvas, view, overlay, paints);
    drawConstellations(canvas, view, overlay);
    drawConnectionLines(canvas, view, overlay, paints, animSeconds);
    drawOrbits(canvas, view, overlay, paints);
  }
  drawStars(canvas, view, field, clock, animSeconds, paints);
  if (overlay) {
    drawSolarSystem(canvas, view, overlay);
    drawHero(canvas, view, overlay, animSeconds);
    drawLabels(canvas, view, overlay, paints);
  }
  drawMeteors(canvas, view, paints, meteors);
}

/**
 * Records a frame into a picture; call from a UI-thread derived value. The
 * recorder is reused: each picture keeps its own copy of what was drawn.
 */
export function recordSkyFrame(
  camera: SkyCamera,
  field: StarField,
  overlay: SkyOverlay | null,
  clock: number,
  animSeconds: number,
  meteors: MeteorFrame,
  paints: StarPaints,
  width: number,
  height: number,
) {
  'worklet';
  const { recorder, frameBounds } = paints;
  frameBounds.setXYWH(0, 0, width, height);
  const canvas = recorder.beginRecording(frameBounds);
  drawSkyFrame(canvas, camera, field, overlay, clock, animSeconds, meteors, paints, width, height);
  return recorder.finishRecordingAsPicture();
}
