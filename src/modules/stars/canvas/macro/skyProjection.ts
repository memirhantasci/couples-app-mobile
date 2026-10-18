/**
 * Pure camera math for the macro sky map. Every function is a worklet and has
 * no React Native imports, so it runs on the UI thread and in Node tests alike.
 *
 * World space is equirectangular in degrees (x = right ascension, y = -dec).
 * A camera maps it to screen pixels with one uniform scale,
 * `pxPerDegree = zoom * viewportHeight / BASE_FOV_DEG`, which is exactly the
 * projection the previous renderer used, so positions are unchanged.
 *
 * Camera RA is intentionally unbounded (a long pan may reach 1000°); wrap it
 * with `normalizeRa` only when reporting it outside the renderer.
 */

export const MIN_ZOOM = 0.6;
export const MAX_ZOOM = 35;
/** Vertical field of view in degrees at zoom 1. */
export const BASE_FOV_DEG = 60;
/** How far past a celestial pole the viewport edge may travel, in degrees. */
export const POLE_OVERSCROLL_DEG = 12;

export interface SkyCamera {
  readonly ra: number;
  readonly dec: number;
  readonly zoom: number;
}

export interface SkyBoundsWithZoom {
  readonly minRa: number;
  readonly maxRa: number;
  readonly minDec: number;
  readonly maxDec: number;
  readonly zoomLevel: number;
}

export function pxPerDegree(zoom: number, viewportHeight: number): number {
  'worklet';
  return (zoom * viewportHeight) / BASE_FOV_DEG;
}

export function normalizeRa(ra: number): number {
  'worklet';
  const wrapped = ra % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Signed shortest angular step from `from` to `to`, in [-180, 180). */
export function shortestRaDelta(from: number, to: number): number {
  'worklet';
  return ((((to - from) % 360) + 540) % 360) - 180;
}

export function clampZoom(zoom: number): number {
  'worklet';
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/**
 * Largest |dec| the camera centre may take at a zoom. The viewport edge may
 * pass a pole by POLE_OVERSCROLL_DEG; at very low zoom the centre is pulled
 * towards the equator instead of showing empty space beyond both poles.
 */
export function decLimit(zoom: number): number {
  'worklet';
  const halfFovDeg = BASE_FOV_DEG / (2 * zoom);
  return Math.max(0, Math.min(90, 90 + POLE_OVERSCROLL_DEG - halfFovDeg));
}

export function clampDec(dec: number, zoom: number): number {
  'worklet';
  const limit = decLimit(zoom);
  return Math.max(-limit, Math.min(limit, dec));
}

export function worldToScreenX(ra: number, camera: SkyCamera, width: number, height: number): number {
  'worklet';
  return width / 2 + shortestRaDelta(camera.ra, ra) * pxPerDegree(camera.zoom, height);
}

export function worldToScreenY(dec: number, camera: SkyCamera, height: number): number {
  'worklet';
  return height / 2 - (dec - camera.dec) * pxPerDegree(camera.zoom, height);
}

/** World point under a screen point. The RA is not normalised (camera-relative). */
export function screenToWorld(
  x: number,
  y: number,
  camera: SkyCamera,
  width: number,
  height: number,
): { ra: number; dec: number } {
  'worklet';
  const scale = pxPerDegree(camera.zoom, height);
  return {
    ra: camera.ra + (x - width / 2) / scale,
    dec: camera.dec - (y - height / 2) / scale,
  };
}

/**
 * Camera that shows `anchorRa/anchorDec` at screen point `x/y` with `zoom`.
 * This is the core of focal-point zooming: the world point under the fingers
 * stays under the fingers. Dec is clamped, so near a pole the anchor may slip.
 */
export function cameraAnchoredAt(
  anchorRa: number,
  anchorDec: number,
  x: number,
  y: number,
  zoom: number,
  width: number,
  height: number,
): SkyCamera {
  'worklet';
  const scale = pxPerDegree(zoom, height);
  return {
    ra: anchorRa - (x - width / 2) / scale,
    dec: clampDec(anchorDec + (y - height / 2) / scale, zoom),
    zoom,
  };
}

/**
 * Damping for a step that pushes further past a limit (rubber band). Returns
 * 1 inside the limit and falls quadratically to 0 at `maxOvershoot`.
 */
export function overshootResistance(overshoot: number, maxOvershoot: number): number {
  'worklet';
  if (overshoot <= 0) return 1;
  const ratio = Math.min(1, overshoot / maxOvershoot);
  return (1 - ratio) * (1 - ratio);
}

/** Maximum elastic zoom overshoot past MIN/MAX, in natural-log units (≈ ±32%). */
export const ZOOM_OVERSHOOT_LOG = Math.log(1.32);
/** Maximum elastic pan overshoot past the dec limit, in screen pixels. */
export const DEC_OVERSHOOT_PX = 120;

/** Log-zoom step damped by how far the current zoom already overshoots. */
export function resistZoomStep(zoom: number, logStep: number): number {
  'worklet';
  const logZoom = Math.log(zoom);
  if (logStep > 0) {
    const overshoot = logZoom - Math.log(MAX_ZOOM);
    return logStep * overshootResistance(overshoot, ZOOM_OVERSHOOT_LOG);
  }
  if (logStep < 0) {
    const overshoot = Math.log(MIN_ZOOM) - logZoom;
    return logStep * overshootResistance(overshoot, ZOOM_OVERSHOOT_LOG);
  }
  return 0;
}

/** Dec step (degrees) damped when it pushes further past the dec limit. */
export function resistDecStep(dec: number, decStep: number, zoom: number, height: number): number {
  'worklet';
  const limit = decLimit(zoom);
  const scale = pxPerDegree(zoom, height);
  if (decStep > 0 && dec > limit) {
    return decStep * overshootResistance((dec - limit) * scale, DEC_OVERSHOOT_PX);
  }
  if (decStep < 0 && dec < -limit) {
    return decStep * overshootResistance((-limit - dec) * scale, DEC_OVERSHOOT_PX);
  }
  return decStep;
}

/** Hard bound for elastic dec so a gesture can never run away past a pole. */
export function elasticDecBound(zoom: number, height: number): number {
  'worklet';
  return decLimit(zoom) + DEC_OVERSHOOT_PX / pxPerDegree(zoom, height);
}

function clampElasticDec(dec: number, zoom: number, height: number): number {
  'worklet';
  const bound = elasticDecBound(zoom, height);
  return Math.max(-bound, Math.min(bound, dec));
}

/**
 * One drag step: the world moves with the finger. Past the dec limit the
 * step is damped (rubber band); RA is free because the sky wraps.
 */
export function panStep(camera: SkyCamera, deltaX: number, deltaY: number, height: number): SkyCamera {
  'worklet';
  const scale = pxPerDegree(camera.zoom, height);
  const decStep = resistDecStep(camera.dec, deltaY / scale, camera.zoom, height);
  return {
    ra: camera.ra - deltaX / scale,
    dec: clampElasticDec(camera.dec + decStep, camera.zoom, height),
    zoom: camera.zoom,
  };
}

/**
 * One pinch step. The world point under the previous focal point is placed
 * under the new focal point at the new zoom, so the map zooms around the
 * fingers and follows them when they move together. Zoom limits are absolute
 * (never relative to a rendered baseline), with elastic resistance past them.
 *
 * Dec is held inside the pole limit during the pinch itself (like Google Maps
 * at the world's edge), so nothing has to slide back after the fingers lift.
 * An overshoot left by a preceding drag is kept, never grown.
 */
export function pinchStep(
  camera: SkyCamera,
  previousFocalX: number,
  previousFocalY: number,
  focalX: number,
  focalY: number,
  scaleChange: number,
  width: number,
  height: number,
): SkyCamera {
  'worklet';
  const safeScaleChange = scaleChange > 0 && Number.isFinite(scaleChange) ? scaleChange : 1;
  const logStep = resistZoomStep(camera.zoom, Math.log(safeScaleChange));
  const zoom = Math.max(
    MIN_ZOOM / Math.exp(ZOOM_OVERSHOOT_LOG),
    Math.min(MAX_ZOOM * Math.exp(ZOOM_OVERSHOOT_LOG), camera.zoom * Math.exp(logStep)),
  );
  const anchor = screenToWorld(previousFocalX, previousFocalY, camera, width, height);
  const scale = pxPerDegree(zoom, height);
  const overshootPx = Math.max(0, Math.abs(camera.dec) - decLimit(camera.zoom)) * pxPerDegree(camera.zoom, height);
  const decBound = Math.min(elasticDecBound(zoom, height), decLimit(zoom) + overshootPx / scale);
  const dec = anchor.dec + (focalY - height / 2) / scale;
  return {
    ra: anchor.ra - (focalX - width / 2) / scale,
    dec: Math.max(-decBound, Math.min(decBound, dec)),
    zoom,
  };
}

/**
 * Viewport bounds for the star query, padded 1.5x vertically (same contract
 * as the previous `computeBounds`). RA bounds wrap: minRa > maxRa means the
 * range crosses 0°.
 */
export function skyBoundsForCamera(
  ra: number,
  dec: number,
  zoom: number,
  width: number,
  height: number,
  padding = 1.5,
): SkyBoundsWithZoom {
  'worklet';
  const fovDec = (BASE_FOV_DEG / zoom) * padding;
  const fovRa = fovDec * (width / height);
  return {
    minRa: normalizeRa(ra - fovRa / 2),
    maxRa: normalizeRa(ra + fovRa / 2),
    minDec: Math.max(-90, dec - fovDec / 2),
    maxDec: Math.min(90, dec + fovDec / 2),
    zoomLevel: zoom,
  };
}

/**
 * Bounds covering the current view and where the camera will be after
 * `lookaheadSec` at its current velocity, so tiles load ahead of a fling.
 */
export function skyBoundsForMotion(
  ra: number,
  dec: number,
  zoom: number,
  raVelocity: number,
  decVelocity: number,
  lookaheadSec: number,
  width: number,
  height: number,
): SkyBoundsWithZoom {
  'worklet';
  const fovDec = (BASE_FOV_DEG / zoom) * 1.5;
  const fovRa = fovDec * (width / height);
  const maxShift = fovDec * 2;
  const shiftRa = Math.max(-maxShift, Math.min(maxShift, raVelocity * lookaheadSec));
  const shiftDec = Math.max(-maxShift, Math.min(maxShift, decVelocity * lookaheadSec));
  const halfRa = Math.min(180, fovRa / 2 + Math.abs(shiftRa) / 2);
  const midRa = ra + shiftRa / 2;
  const minDec = Math.min(dec, dec + shiftDec) - fovDec / 2;
  const maxDec = Math.max(dec, dec + shiftDec) + fovDec / 2;
  return {
    minRa: halfRa >= 180 ? 0 : normalizeRa(midRa - halfRa),
    maxRa: halfRa >= 180 ? 360 : normalizeRa(midRa + halfRa),
    minDec: Math.max(-90, minDec),
    maxDec: Math.min(90, maxDec),
    zoomLevel: zoom,
  };
}
