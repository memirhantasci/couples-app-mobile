/**
 * Shooting stars as shared sky events, used by the per-frame renderer (UI
 * thread) and tap hit-testing (JS thread). Pure worklets, no React Native
 * imports, so the same code runs in Node tests.
 *
 * No server is involved: every device derives the same meteors from the wall
 * clock alone. Time is split into METEOR_SLOT_MS slots; a hash of the slot
 * decides whether a meteor launches in it and how it flies. Every meteor
 * crosses the whole map, from its top edge (Dec +90°) down to its bottom edge
 * (Dec −90°), drifting a little sideways in RA. Whoever's view it passes
 * through sees it and can catch it; each device can catch each meteor once.
 * Device clocks that differ by a few seconds only shift when it is seen.
 *
 * Meteors live in world space (RA/Dec degrees), so they stay among the stars
 * while the camera pans or zooms.
 *
 * Speed and rate: a meteor falls at a steady ~6 °/s, about 265 px/s at the
 * star screen's resting zoom (3), where it stays on screen for ~3.5 s.
 * Measured over simulated hours, a viewer sees one about every ~45 s at the
 * resting and overview (1.2) zooms, rarely two at once; zoomed out only the
 * brighter ones show (see meteorZoomVisibility).
 */

import { pxPerDegree, shortestRaDelta, type SkyCamera } from './skyProjection';
import { smoothstep } from './starStyle';

export const METEOR_SLOT_MS = 500;
/** Chance that a slot launches a meteor (≈ 0.6 launches per second over the whole map). */
export const METEOR_CHANCE = 0.3;
/** Top-to-bottom flight time; the path is ~180°, so this sets the speed. */
const MIN_DURATION_MS = 26_000;
const MAX_DURATION_MS = 32_000;
const MAP_TOP_DEC = 90;
const MAP_BOTTOM_DEC = -90;
/** Sideways RA drift over the whole fall, so streaks lean a little. */
const MIN_DRIFT_DEG = 10;
const MAX_DRIFT_DEG = 45;
/** Streak length behind the head; kept close so every meteor looks alike. */
const MIN_TAIL_DEG = 8;
const MAX_TAIL_DEG = 10;
const FIREBALL_CHANCE = 0.06;
const MIN_BRIGHTNESS = 0.6;
/** Share of the flight spent fading in at the top edge and out at the bottom edge. */
const EDGE_FADE = 0.015;
/** At most this many meteors are drawn at once (zoomed far out several may overlap). */
const MAX_ACTIVE_METEORS = 8;
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

/** 32-bit integer hash of an integer; identical on every JS engine. */
function hash32(a: number): number {
  'worklet';
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** The meteor launched in a slot, if any. */
export function meteorForSlot(slot: number): MeteorEvent | null {
  'worklet';
  // mulberry32 seeded by the slot
  let state = hash32(slot);
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  if (next() >= METEOR_CHANCE) return null;

  const durationMs = MIN_DURATION_MS + next() * (MAX_DURATION_MS - MIN_DURATION_MS);
  const startMs = slot * METEOR_SLOT_MS + next() * METEOR_SLOT_MS;
  const startRa = next() * 360;
  const drift = MIN_DRIFT_DEG + next() * (MAX_DRIFT_DEG - MIN_DRIFT_DEG);
  const deltaRa = next() < 0.5 ? -drift : drift;
  const deltaDec = MAP_BOTTOM_DEC - MAP_TOP_DEC;
  const tailDeg = MIN_TAIL_DEG + next() * (MAX_TAIL_DEG - MIN_TAIL_DEG);
  const shade = next();
  const fireball = next() < FIREBALL_CHANCE;
  const brightness = fireball ? 1 : MIN_BRIGHTNESS + (1 - MIN_BRIGHTNESS) * shade * shade;

  return {
    id: slot,
    startMs,
    durationMs,
    startRa,
    startDec: MAP_TOP_DEC,
    deltaRa,
    deltaDec,
    tail: tailDeg / Math.hypot(deltaRa, deltaDec),
    brightness,
    fireball,
  };
}

/**
 * How visible a meteor of this brightness is at a zoom (0…1). Zoomed out only
 * the brighter meteors show, like stars, so the screen doesn't fill up while
 * the visible patch of sky grows; from zoom ~2.6 every meteor shows.
 */
export function meteorZoomVisibility(brightness: number, zoom: number): number {
  'worklet';
  const t = Math.max(0, Math.min(1, (zoom - 0.7) / 1.9));
  const threshold = 0.88 - (0.88 - MIN_BRIGHTNESS) * t;
  return smoothstep(threshold - 0.06, threshold + 0.06, brightness);
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
  // Steady speed, so the head is easy to follow and tap.
  const head = (nowMs - event.startMs) / event.durationMs;
  if (head < 0 || head > 1) return null;

  const tail = Math.max(0, head - event.tail);
  const scale = pxPerDegree(camera.zoom, height);
  const headRa = event.startRa + event.deltaRa * head;
  const headDec = event.startDec + event.deltaDec * head;
  const headX = width / 2 + shortestRaDelta(camera.ra, headRa) * scale;
  const headY = height / 2 - (headDec - camera.dec) * scale;
  // The tail is placed relative to the head (unwrapped), so a streak crossing RA 0° never tears.
  const tailX = headX - event.deltaRa * (head - tail) * scale;
  const tailY = headY + event.deltaDec * (head - tail) * scale;

  const fade = smoothstep(0, EDGE_FADE, head) * (1 - smoothstep(1 - EDGE_FADE, 1, head));
  const alpha = fade * (0.75 + 0.25 * event.brightness) * meteorZoomVisibility(event.brightness, camera.zoom);
  return { headX, headY, tailX, tailY, alpha };
}

/** World position of the meteor's head at `nowMs` (clamped to the flight). */
export function meteorHead(event: MeteorEvent, nowMs: number): { ra: number; dec: number } {
  'worklet';
  const head = Math.max(0, Math.min(1, (nowMs - event.startMs) / event.durationMs));
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
 * Meteors in flight at `nowMs` whose streak may be on screen. Every slot
 * whose meteor can still be falling is checked (~130 cheap hashes a frame).
 */
export function activeMeteorsInView(
  nowMs: number,
  camera: SkyCamera,
  width: number,
  height: number,
): MeteorEvent[] {
  'worklet';
  const result: MeteorEvent[] = [];
  const lastSlot = Math.floor(nowMs / METEOR_SLOT_MS);
  const firstSlot = Math.floor((nowMs - MAX_DURATION_MS) / METEOR_SLOT_MS);

  for (let slot = lastSlot; slot >= firstSlot; slot--) {
    const event = meteorForSlot(slot);
    if (!event) continue;
    const segment = meteorSegment(event, nowMs, camera, width, height);
    if (!segment || segment.alpha <= 0.01 || !segmentOnScreen(segment, width, height, 24)) continue;
    result.push(event);
    if (result.length >= MAX_ACTIVE_METEORS) return result;
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
