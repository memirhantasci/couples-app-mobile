/**
 * Smooth camera flights, after van Wijk & Nuij, "Smooth and efficient zooming
 * and panning" (2003) — the algorithm behind Mapbox GL's `flyTo`.
 *
 * The path zooms out while travelling and back in on arrival, minimising the
 * perceived screen motion. A whole flight is a pure function of one progress
 * value, so the UI thread can sample it every frame without the camera centre
 * and zoom ever disagreeing (the target stays framed for the whole flight).
 */

import {
  clampDec,
  clampZoom,
  pxPerDegree,
  shortestRaDelta,
  type SkyCamera,
} from './skyProjection';

/** Curvature of the zoom-out arc (Mapbox default). */
const RHO = 1.42;
/** Average speed in ρ-screenfuls per second. */
const SPEED = 1.35;
const MIN_DURATION_MS = 650;
const MAX_DURATION_MS = 2200;

export const FLIGHT_ARC = 0;
export const FLIGHT_ZOOM_ONLY = 1;
export const FLIGHT_INSTANT = 2;

export interface FlightPlan {
  readonly kind: number;
  readonly fromRa: number;
  readonly fromDec: number;
  readonly fromZoom: number;
  /** Unwrapped so that `toRa - fromRa` is the shortest RA path. */
  readonly toRa: number;
  readonly toDec: number;
  readonly toZoom: number;
  readonly r0: number;
  /** Total path length in ρ-screenfuls. */
  readonly length: number;
  readonly w0: number;
  readonly u1: number;
  /** +1 zooming out, -1 zooming in (zoom-only flights). */
  readonly zoomDirection: number;
  readonly durationMs: number;
}

export function createFlightPlan(
  from: SkyCamera,
  target: SkyCamera,
  width: number,
  height: number,
): FlightPlan {
  'worklet';
  const toZoom = clampZoom(target.zoom);
  const toRa = from.ra + shortestRaDelta(from.ra, target.ra);
  const toDec = clampDec(target.dec, toZoom);
  const deltaRa = toRa - from.ra;
  const deltaDec = toDec - from.dec;

  // Spans are measured in degrees: the larger viewport side at each zoom.
  const w0 = Math.max(width, height) / pxPerDegree(from.zoom, height);
  const w1 = (w0 * from.zoom) / toZoom;
  const u1 = Math.sqrt(deltaRa * deltaRa + deltaDec * deltaDec);
  const rho2 = RHO * RHO;

  let kind = FLIGHT_ARC;
  let r0 = 0;
  let length = 0;
  let zoomDirection = 0;

  if (u1 > 1e-6) {
    const b0 = (w1 * w1 - w0 * w0 + rho2 * rho2 * u1 * u1) / (2 * w0 * rho2 * u1);
    const b1 = (w1 * w1 - w0 * w0 - rho2 * rho2 * u1 * u1) / (2 * w1 * rho2 * u1);
    r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
    const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
    length = (r1 - r0) / RHO;
  }

  if (u1 <= 1e-6 || !Number.isFinite(length)) {
    if (Math.abs(Math.log(w1 / w0)) < 1e-6) {
      kind = FLIGHT_INSTANT;
      length = 0;
    } else {
      kind = FLIGHT_ZOOM_ONLY;
      zoomDirection = w1 > w0 ? 1 : -1;
      length = Math.abs(Math.log(w1 / w0)) / RHO;
    }
  }

  const durationMs = kind === FLIGHT_INSTANT
    ? 0
    : Math.round(Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, (1000 * length) / SPEED)));

  return {
    kind,
    fromRa: from.ra,
    fromDec: from.dec,
    fromZoom: from.zoom,
    toRa,
    toDec,
    toZoom,
    r0,
    length,
    w0,
    u1,
    zoomDirection,
    durationMs,
  };
}

/** Camera at progress `t` in [0, 1] (apply easing before calling). */
export function sampleFlight(plan: FlightPlan, t: number): SkyCamera {
  'worklet';
  if (t >= 1 || plan.kind === FLIGHT_INSTANT) {
    return { ra: plan.toRa, dec: plan.toDec, zoom: plan.toZoom };
  }
  if (t <= 0) {
    return { ra: plan.fromRa, dec: plan.fromDec, zoom: plan.fromZoom };
  }

  const s = t * plan.length;
  let span = 1;
  let travelled = 0;

  if (plan.kind === FLIGHT_ZOOM_ONLY) {
    span = Math.exp(plan.zoomDirection * RHO * s);
  } else {
    const coshR0 = Math.cosh(plan.r0);
    span = coshR0 / Math.cosh(plan.r0 + RHO * s);
    travelled = (plan.w0 * ((coshR0 * Math.tanh(plan.r0 + RHO * s) - Math.sinh(plan.r0)) / (RHO * RHO))) / plan.u1;
  }

  const zoom = clampZoom(plan.fromZoom / span);
  return {
    ra: plan.fromRa + (plan.toRa - plan.fromRa) * travelled,
    dec: clampDec(plan.fromDec + (plan.toDec - plan.fromDec) * travelled, zoom),
    zoom,
  };
}
