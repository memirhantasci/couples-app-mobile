/**
 * Shooting stars as shared sky events, used by the per-frame renderer (UI
 * thread) and tap hit-testing (JS thread). Pure worklets, no React Native
 * imports, so the same code runs in Node tests.
 *
 * No server is involved: every device derives the same meteors from the wall
 * clock and the sky position alone. The sky is split into METEOR_CELL_DEG
 * cells and time into METEOR_SLOT_MS slots; a hash of (slot, cell) decides
 * whether that cell gets a meteor in that slot and how it flies. Whoever looks
 * at that part of the sky at that moment sees it, everyone else misses it.
 * Device clocks that differ by a few seconds only shift when it is seen.
 *
 * Meteors live in world space (RA/Dec degrees), so they stay among the stars
 * while the camera pans or zooms.
 *
 * Rate: the map is flat (equirectangular), so meteors are spread uniformly
 * over RA×Dec degrees rather than true sky area; every part of the map, polar
 * regions included, gets the same rate. Measured over simulated hours, a
 * viewer sees about one meteor per ~11 s at the star screen's resting zoom
 * (3) and ~6 s at the overview zoom (1.2), where only the brighter ones show
 * (see meteorZoomVisibility). Zoomed far in the visible patch is small and
 * meteors are rarer (~30 s at zoom 6), as with a telescope.
 *
 * Meteors are slow and short enough to be tapped: at the resting zoom the
 * head moves ~140 px/s (median).
 */

import { pxPerDegree, shortestRaDelta, type SkyCamera } from './skyProjection';
import { smoothstep } from './starStyle';

export const METEOR_SLOT_MS = 10_000;
export const METEOR_CELL_DEG = 20;
const RA_CELLS = 360 / METEOR_CELL_DEG;
const DEC_CELLS = 180 / METEOR_CELL_DEG;
/** Chance that a cell gets a meteor in a slot (≈ 2.1e-4 meteors per deg² per second). */
export const METEOR_CHANCE = 0.85;
const MIN_DURATION_MS = 2200;
const MAX_DURATION_MS = 3200;
const MIN_LENGTH_DEG = 5;
/** Longest path; cells this far outside the view can still send a meteor into it. */
const MAX_LENGTH_DEG = 12;
/** Path angle below the horizontal: meteors fall, mostly sideways. */
const MIN_FALL_ANGLE_DEG = 10;
const MAX_FALL_ANGLE_DEG = 65;
const FIREBALL_CHANCE = 0.06;
const MIN_BRIGHTNESS = 0.6;
/** Meteors start this far from the poles at most and never travel past MAX_ABS_DEC. */
const MAX_START_DEC = 80;
const MAX_ABS_DEC = 86;
/** At most this many meteors are drawn at once (zoomed far out several may overlap). */
const MAX_ACTIVE_METEORS = 3;
/** Hit-testing also looks this far back, so a tap that trails the head still counts. */
const TAP_LATENCY_MS = 150;

export interface MeteorEvent {
  /** Same on every device for the same meteor. */
  readonly id: number;
  /** Wall-clock (epoch) start, in milliseconds. */
  readonly startMs: number;
  readonly durationMs: number;
  readonly startRa: number;
  readonly startDec: number;
  /** Signed, unwrapped RA travelled over the whole path. */
  readonly deltaRa: number;
  readonly deltaDec: number;
  /** Streak length as a fraction of the path. */
  readonly tail: number;
  /** MIN_BRIGHTNESS…1. */
  readonly brightness: number;
  /** A rare, brighter and warmer meteor. */
  readonly fireball: boolean;
}

/** A meteor the user tapped, frozen at the moment of the catch. */
export interface CaughtMeteor {
  readonly event: MeteorEvent;
  readonly atMs: number;
}

/** A meteor's streak in screen pixels. */
export interface MeteorSegment {
  readonly headX: number;
  readonly headY: number;
  readonly tailX: number;
  readonly tailY: number;
  /** Combined fade-in/out, brightness and zoom visibility, 0…1. */
  readonly alpha: number;
}

/** 32-bit integer hash of three integers; identical on every JS engine. */
function hash32(a: number, b: number, c: number): number {
  'worklet';
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ b, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h ^ c, 0x27d4eb2f);
  h ^= h >>> 15;
  return h >>> 0;
}

/** The meteor a cell gets in a slot, if any. */
export function meteorForCell(slot: number, raCell: number, decCell: number): MeteorEvent | null {
  'worklet';
  // mulberry32 seeded by the cell and slot
  let state = hash32(slot, raCell, decCell);
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Polar cells only start meteors up to MAX_START_DEC; their chance shrinks
  // with that band so the rate per degree stays even.
  const decLow = Math.max(-MAX_START_DEC, -90 + decCell * METEOR_CELL_DEG);
  const decHigh = Math.min(MAX_START_DEC, -90 + (decCell + 1) * METEOR_CELL_DEG);
  if (next() >= (METEOR_CHANCE * (decHigh - decLow)) / METEOR_CELL_DEG) return null;

  const durationMs = MIN_DURATION_MS + next() * (MAX_DURATION_MS - MIN_DURATION_MS);
  // The whole flight stays inside its slot, so only the current slot is ever active.
  const startMs = slot * METEOR_SLOT_MS + next() * (METEOR_SLOT_MS - durationMs);
  const startRa = raCell * METEOR_CELL_DEG + next() * METEOR_CELL_DEG;
  const startDec = decLow + next() * (decHigh - decLow);
  const length = MIN_LENGTH_DEG + next() * (MAX_LENGTH_DEG - MIN_LENGTH_DEG);
  const angle =
    ((MIN_FALL_ANGLE_DEG + next() * (MAX_FALL_ANGLE_DEG - MIN_FALL_ANGLE_DEG)) * Math.PI) / 180;
  const direction = next() < 0.5 ? -1 : 1;
  const deltaRa = Math.cos(angle) * length * direction;
  let deltaDec = -Math.sin(angle) * length;
  // Near the south pole a falling meteor would leave the map: it rises instead.
  if (startDec + deltaDec < -MAX_ABS_DEC) deltaDec = -deltaDec;
  const tail = 0.3 + next() * 0.15;
  const shade = next();
  const fireball = next() < FIREBALL_CHANCE;
  const brightness = fireball ? 1 : MIN_BRIGHTNESS + (1 - MIN_BRIGHTNESS) * shade * shade;

  return {
    id: slot * RA_CELLS * DEC_CELLS + decCell * RA_CELLS + raCell,
    startMs,
    durationMs,
    startRa,
    startDec,
    deltaRa,
    deltaDec,
    tail,
    brightness,
    fireball,
  };
}

/**
 * How visible a meteor of this brightness is at a zoom (0…1). Zoomed out only
 * the brighter meteors show, like stars, so the rate stays even while the
 * visible patch of sky grows; from zoom ~2.6 every meteor shows.
 */
export function meteorZoomVisibility(brightness: number, zoom: number): number {
  'worklet';
  const t = Math.max(0, Math.min(1, (zoom - 0.7) / 1.9));
  const threshold = 0.88 - (0.88 - MIN_BRIGHTNESS) * t;
  return smoothstep(threshold - 0.06, threshold + 0.06, brightness);
}

/** Position along the path at progress p; meteors slow down slightly as they burn. */
function pathEase(p: number): number {
  'worklet';
  return p + 0.15 * p * (1 - p);
}

/** The meteor's streak on screen at `nowMs`, or null when it is not in flight. */
export function meteorSegment(
  event: MeteorEvent,
  nowMs: number,
  camera: SkyCamera,
  width: number,
  height: number,
): MeteorSegment | null {
  'worklet';
  const progress = (nowMs - event.startMs) / event.durationMs;
  if (progress < 0 || progress > 1) return null;

  const head = pathEase(progress);
  const tail = pathEase(Math.max(0, progress - event.tail));
  const scale = pxPerDegree(camera.zoom, height);
  const headRa = event.startRa + event.deltaRa * head;
  const headDec = event.startDec + event.deltaDec * head;
  const headX = width / 2 + shortestRaDelta(camera.ra, headRa) * scale;
  const headY = height / 2 - (headDec - camera.dec) * scale;
  // The tail is placed relative to the head (unwrapped), so a streak crossing RA 0° never tears.
  const tailX = headX - event.deltaRa * (head - tail) * scale;
  const tailY = headY + event.deltaDec * (head - tail) * scale;

  const fade = smoothstep(0, 0.12, progress) * (1 - smoothstep(0.72, 1, progress));
  const alpha = fade * (0.75 + 0.25 * event.brightness) * meteorZoomVisibility(event.brightness, camera.zoom);
  return { headX, headY, tailX, tailY, alpha };
}

/** World position of the meteor's head at `nowMs` (clamped to the flight). */
export function meteorHead(event: MeteorEvent, nowMs: number): { ra: number; dec: number } {
  'worklet';
  const progress = Math.max(0, Math.min(1, (nowMs - event.startMs) / event.durationMs));
  const head = pathEase(progress);
  return { ra: event.startRa + event.deltaRa * head, dec: event.startDec + event.deltaDec * head };
}

function segmentOnScreen(segment: MeteorSegment, width: number, height: number, margin: number): boolean {
  'worklet';
  const { headX, headY, tailX, tailY } = segment;
  if (headX < -margin && tailX < -margin) return false;
  if (headX > width + margin && tailX > width + margin) return false;
  if (headY < -margin && tailY < -margin) return false;
  if (headY > height + margin && tailY > height + margin) return false;
  return true;
}

/**
 * Meteors in flight at `nowMs` whose streak may be on screen. Only cells
 * within a path length of the view are checked (a handful per frame).
 */
export function activeMeteorsInView(
  nowMs: number,
  camera: SkyCamera,
  width: number,
  height: number,
): MeteorEvent[] {
  'worklet';
  const result: MeteorEvent[] = [];
  const slot = Math.floor(nowMs / METEOR_SLOT_MS);
  const scale = pxPerDegree(camera.zoom, height);
  const halfWidthDeg = width / 2 / scale + MAX_LENGTH_DEG;
  const halfHeightDeg = height / 2 / scale + MAX_LENGTH_DEG;

  const decFrom = Math.max(0, Math.floor((camera.dec - halfHeightDeg + 90) / METEOR_CELL_DEG));
  const decTo = Math.min(DEC_CELLS - 1, Math.floor((camera.dec + halfHeightDeg + 90) / METEOR_CELL_DEG));
  const raFrom = Math.floor((camera.ra - halfWidthDeg) / METEOR_CELL_DEG);
  const raCount = Math.min(RA_CELLS, Math.floor((camera.ra + halfWidthDeg) / METEOR_CELL_DEG) - raFrom + 1);

  for (let decCell = decFrom; decCell <= decTo; decCell++) {
    for (let step = 0; step < raCount; step++) {
      const raCell = (((raFrom + step) % RA_CELLS) + RA_CELLS) % RA_CELLS;
      const event = meteorForCell(slot, raCell, decCell);
      if (!event) continue;
      const segment = meteorSegment(event, nowMs, camera, width, height);
      if (!segment || segment.alpha <= 0.01 || !segmentOnScreen(segment, width, height, 24)) continue;
      result.push(event);
      if (result.length >= MAX_ACTIVE_METEORS) return result;
    }
  }
  return result;
}

/** Shortest distance from point p to the segment a–b. */
function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/**
 * The meteor under a tap, if any (JS thread). Looks at the sky now and
 * TAP_LATENCY_MS earlier, so a tap aimed at where the head just was counts.
 * Meteors in `excludeIds` (already caught) are skipped.
 */
export function hitTestMeteor(
  x: number,
  y: number,
  nowMs: number,
  camera: SkyCamera,
  width: number,
  height: number,
  radiusPx: number,
  excludeIds: ReadonlySet<number>,
): MeteorEvent | null {
  for (const at of [nowMs, nowMs - TAP_LATENCY_MS]) {
    for (const event of activeMeteorsInView(at, camera, width, height)) {
      if (excludeIds.has(event.id)) continue;
      const segment = meteorSegment(event, at, camera, width, height);
      if (!segment || segment.alpha < 0.08) continue;
      const { headX, headY, tailX, tailY } = segment;
      if (distanceToSegment(x, y, tailX, tailY, headX, headY) <= radiusPx) return event;
    }
  }
  return null;
}
