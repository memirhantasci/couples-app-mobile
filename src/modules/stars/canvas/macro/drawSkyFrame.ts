import type { SkCanvas, SkPaint, SkPicture } from '@shopify/react-native-skia';
import { Skia } from '../skiaBridge';
import type { SkyOverlay } from './skyOverlay';
import { pxPerDegree, shortestRaDelta, type SkyCamera } from './skyProjection';
import { colorOf, STAR_FADE_MS, type StarField, type StarRender } from './starField';
import { magnitudeToRadius, smoothstep, starZoomBonus, visibleMagnitudeLimit } from './starStyle';

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

/** Paints reused for every star, every frame (UI thread only). */
export interface StarPaints {
  readonly fill: SkPaint;
  readonly stroke: SkPaint;
  readonly white: Float32Array;
  readonly gold: Float32Array;
  readonly purple: Float32Array;
}

export function createStarPaints(): StarPaints {
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  const stroke = Skia.Paint();
  stroke.setAntiAlias(true);
  stroke.setStyle(1);
  stroke.setStrokeWidth(1.25);
  return {
    fill,
    stroke,
    white: colorOf('#FFFFFF', 1),
    gold: colorOf('#F59E0B', 1),
    purple: colorOf('#A855F7', 1),
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

function beginAlphaLayer(canvas: SkCanvas, alpha: number) {
  'worklet';
  const paint = Skia.Paint();
  paint.setAlphaf(alpha);
  canvas.saveLayer(paint);
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
  const mediumGlow = style.glow * (1 - style.detail);
  const detail = style.detail;
  fill.setColor(rgb);

  if (detail > 0.01 && star.claimed && !star.resonance) {
    fill.setAlphaf(0.4 * star.luminosity * detail * opacity);
    canvas.drawCircle(x, y, r + 14, fill);
  }
  if (mediumGlow > 0.01) {
    fill.setAlphaf(0.25 * mediumGlow * opacity);
    canvas.drawCircle(x, y, r * 2.5, fill);
    fill.setAlphaf(0.45 * mediumGlow * opacity);
    canvas.drawCircle(x, y, r * 1.6, fill);
  }
  if (detail > 0.01) {
    fill.setAlphaf(star.alpha * 0.45 * detail * opacity);
    canvas.drawCircle(x, y, r * 2.2, fill);
  }
  // Far out, resonating stars show only their rings (as before).
  const core = star.resonance ? style.glow : 1;
  if (core > 0.01) {
    fill.setAlphaf(star.alpha * core * opacity);
    canvas.drawCircle(x, y, r, fill);
  }
  if (detail > 0.01 && star.magnitude <= 3.5) {
    fill.setColor(paints.white);
    fill.setAlphaf(Math.min(1, star.alpha * 1.2) * detail * opacity);
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

function drawStars(canvas: SkCanvas, view: FrameView, field: StarField, clock: number, paints: StarPaints) {
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
  // Largest star radius (3.5px base × 3.2 magnitude scale) plus its reach.
  const marginDeg = (11.2 * style.zoomBonus * 2.5 + STAR_REACH_PX) / scale;

  for (const cell of field.cells) {
    if (cell.minDec - marginDeg > camera.dec + halfHeightDeg) continue;
    if (cell.maxDec + marginDeg < camera.dec - halfHeightDeg) continue;
    const cellHalfWidth = (cell.maxRa - cell.minRa) / 2;
    const cellOffset = Math.abs(shortestRaDelta(camera.ra, cell.minRa + cellHalfWidth));
    if (cellOffset - cellHalfWidth - marginDeg > halfWidthDeg) continue;

    for (const star of cell.stars) {
      const visibility = star.claimed
        ? 1
        : Math.min(1, (style.magnitudeLimit + 0.35 - star.magnitude) / 0.35);
      if (visibility <= 0.01) continue;
      const fade = star.bornAt > 0 ? Math.max(0, Math.min(1, (clock - star.bornAt) / STAR_FADE_MS)) : 1;
      const opacity = visibility * fade;
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

function drawSectorLabels(canvas: SkCanvas, view: FrameView, overlay: SkyOverlay) {
  'worklet';
  const alpha = 1 - smoothstep(SECTOR_LABEL_FADE[0], SECTOR_LABEL_FADE[1], view.camera.zoom);
  if (alpha <= 0.002 || overlay.sectorLabels.length === 0) return;
  if (alpha < 0.998) beginAlphaLayer(canvas, alpha);
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

function drawConnectionLines(canvas: SkCanvas, view: FrameView, overlay: SkyOverlay) {
  'worklet';
  const hero = overlay.hero;
  if (!hero || overlay.connections.length === 0) return;
  const { width, height, scale } = view;
  const x1 = screenX(view, hero.ra);
  const y1 = screenY(view, hero.dec);
  for (const connection of overlay.connections) {
    const x2 = x1 + shortestRaDelta(hero.ra, connection.ra) * scale;
    const y2 = y1 - (connection.dec - hero.dec) * scale;
    if ((x1 < 0 && x2 < 0) || (x1 > width && x2 > width) || (y1 < 0 && y2 < 0) || (y1 > height && y2 > height)) continue;
    canvas.drawLine(x1, y1, x2, y2, overlay.connectionLinePaint);
    if (isOnScreen(view, x2, y2, 40)) drawAt(canvas, overlay.connectionNode, x2, y2);
  }
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

function drawHero(canvas: SkCanvas, view: FrameView, overlay: SkyOverlay) {
  'worklet';
  const hero = overlay.hero;
  if (!hero) return;
  const x = screenX(view, hero.ra);
  const y = screenY(view, hero.dec);
  if (isOnScreen(view, x, y, 60)) drawAt(canvas, hero.picture, x, y);
}

function drawLabels(canvas: SkCanvas, view: FrameView, overlay: SkyOverlay) {
  'worklet';
  const zoom = view.camera.zoom;
  const { scale } = view;

  const claimedAlpha = smoothstep(CLAIMED_LABEL_FADE[0], CLAIMED_LABEL_FADE[1], zoom);
  if (claimedAlpha > 0.002 && overlay.claimedLabels.length > 0) {
    if (claimedAlpha < 0.998) beginAlphaLayer(canvas, claimedAlpha);
    for (const item of overlay.claimedLabels) {
      const x = screenX(view, item.ra);
      const y = screenY(view, item.dec);
      if (!isOnScreen(view, x, y, 120)) continue;
      drawAt(canvas, item.label, x, y + magnitudeToRadius(item.magnitude, item.spectralType, zoom) + 20);
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
  paints: StarPaints,
  width: number,
  height: number,
) {
  'worklet';
  const view: FrameView = { camera, scale: pxPerDegree(camera.zoom, height), width, height };
  if (overlay) {
    canvas.drawPicture(overlay.background);
    drawNebulae(canvas, view, overlay);
    drawSectorLabels(canvas, view, overlay);
    drawConstellations(canvas, view, overlay);
    drawConnectionLines(canvas, view, overlay);
  }
  drawStars(canvas, view, field, clock, paints);
  if (overlay) {
    drawSolarSystem(canvas, view, overlay);
    drawHero(canvas, view, overlay);
    drawLabels(canvas, view, overlay);
  }
}

/** Records a frame into a picture; call from a UI-thread derived value. */
export function recordSkyFrame(
  camera: SkyCamera,
  field: StarField,
  overlay: SkyOverlay | null,
  clock: number,
  paints: StarPaints,
  width: number,
  height: number,
) {
  'worklet';
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
  drawSkyFrame(canvas, camera, field, overlay, clock, paints, width, height);
  return recorder.finishRecordingAsPicture();
}
