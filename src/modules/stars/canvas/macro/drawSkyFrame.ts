import type { SkCanvas } from '@shopify/react-native-skia';
import { Skia } from '../skiaBridge';
import type { SkyOverlay } from './skyOverlay';
import { pxPerDegree, shortestRaDelta, type SkyCamera } from './skyProjection';
import { STAR_FADE_MS, type StarScene, type StarTileEntry } from './starTileScene';
import { magnitudeToRadius, smoothstep } from './starStyle';

/**
 * Per-frame drawing, run on the UI thread. It only positions pictures that
 * were recorded ahead of time, so its cost does not depend on star count:
 * a few dozen matrix ops and nested picture draws per frame.
 */

/** Sector names show below this zoom and fade out towards it. */
const SECTOR_LABEL_FADE = [1.7, 2.0] as const;
/** Claimed-star name pills fade in across this zoom range. */
const CLAIMED_LABEL_FADE = [3.6, 4.0] as const;

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

function drawAt(canvas: SkCanvas, picture: StarTileEntry['picture'], x: number, y: number, scale = 1) {
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

function entryAlpha(entry: StarTileEntry, clock: number): number {
  'worklet';
  let alpha = 1;
  if (entry.bornAt > 0) alpha = Math.min(1, Math.max(0, (clock - entry.bornAt) / STAR_FADE_MS));
  if (entry.diedAt > 0) alpha *= 1 - Math.min(1, Math.max(0, (clock - entry.diedAt) / STAR_FADE_MS));
  return alpha;
}

/** Draws every RA copy (k·360°) of a world-space tile that touches the view. */
function drawStarEntry(canvas: SkCanvas, view: FrameView, entry: StarTileEntry) {
  'worklet';
  const { camera, scale, width, height } = view;
  const halfWidthDeg = width / 2 / scale;
  const baseCopy = Math.floor(camera.ra / 360);
  for (let copy = baseCopy - 1; copy <= baseCopy + 1; copy += 1) {
    const offset = copy * 360;
    if (entry.minRa + offset - entry.marginDeg > camera.ra + halfWidthDeg) continue;
    if (entry.maxRa + offset + entry.marginDeg < camera.ra - halfWidthDeg) continue;
    canvas.save();
    canvas.translate(width / 2 + (offset - camera.ra) * scale, height / 2 + camera.dec * scale);
    canvas.scale(scale, scale);
    canvas.drawPicture(entry.picture);
    canvas.restore();
  }
}

function drawStars(canvas: SkCanvas, view: FrameView, scene: StarScene, clock: number) {
  'worklet';
  const halfHeightDeg = view.height / 2 / view.scale;
  const minDec = view.camera.dec - halfHeightDeg;
  const maxDec = view.camera.dec + halfHeightDeg;
  // Entries that fade together (same batch or band switch) share one layer.
  let fadingKeys: string[] | null = null;
  let fadingGroups: Record<string, { alpha: number; entries: StarTileEntry[] }> | null = null;

  for (const entry of scene.entries) {
    if (entry.minDec - entry.marginDeg > maxDec || entry.maxDec + entry.marginDeg < minDec) continue;
    const alpha = entryAlpha(entry, clock);
    if (alpha <= 0.002) continue;
    if (alpha >= 0.998) {
      drawStarEntry(canvas, view, entry);
      continue;
    }
    const key = `${entry.bornAt}|${entry.diedAt}`;
    if (!fadingGroups || !fadingKeys) {
      fadingGroups = {};
      fadingKeys = [];
    }
    const group = fadingGroups[key];
    if (group) {
      group.entries.push(entry);
    } else {
      fadingGroups[key] = { alpha, entries: [entry] };
      fadingKeys.push(key);
    }
  }

  if (!fadingGroups || !fadingKeys) return;
  for (const key of fadingKeys) {
    const group = fadingGroups[key];
    beginAlphaLayer(canvas, group.alpha);
    for (const entry of group.entries) drawStarEntry(canvas, view, entry);
    canvas.restore();
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
  scene: StarScene,
  overlay: SkyOverlay | null,
  clock: number,
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
  drawStars(canvas, view, scene, clock);
  if (overlay) {
    drawSolarSystem(canvas, view, overlay);
    drawHero(canvas, view, overlay);
    drawLabels(canvas, view, overlay);
  }
}

/** Records a frame into a picture; call from a UI-thread derived value. */
export function recordSkyFrame(
  camera: SkyCamera,
  scene: StarScene,
  overlay: SkyOverlay | null,
  clock: number,
  width: number,
  height: number,
) {
  'worklet';
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
  drawSkyFrame(canvas, camera, scene, overlay, clock, width, height);
  return recorder.finishRecordingAsPicture();
}
