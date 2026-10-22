import type { ViewportStarItem } from '../../types/star.types';
import { pxPerDegree, shortestRaDelta, type SkyCamera } from './skyProjection';
import { starLight, starRadius, UNCLAIMED_STAR_BRIGHTNESS } from './starStyle';

const MIN_TOUCH_RADIUS = 52;
const SOLAR_TOUCH_RADIUS = 64;

/**
 * Nearest tappable object to a screen point, using the camera exactly as it
 * was rendered when the tap happened (snapshot from the UI thread), so the
 * hit always matches what was on screen.
 */
export function hitTestSky(
  x: number,
  y: number,
  camera: SkyCamera,
  width: number,
  height: number,
  candidates: readonly ViewportStarItem[],
): ViewportStarItem | null {
  const scale = pxPerDegree(camera.zoom, height);
  let nearest: ViewportStarItem | null = null;
  let nearestDistance = Infinity;

  for (const star of candidates) {
    const starX = width / 2 + shortestRaDelta(camera.ra, star.ra) * scale;
    const starY = height / 2 - (star.dec - camera.dec) * scale;
    const isSolar = star.catalog_code.startsWith('SOL-');
    const sizeFactor = star.catalog_code === 'SOL-SUN' ? 3 : star.is_mine ? 1.6 : 1;
    const light = starLight(star.is_claimed, star.luminosity_level ?? UNCLAIMED_STAR_BRIGHTNESS);
    const radius = starRadius(light, camera.zoom) * sizeFactor;
    const touchRadius = Math.max(radius + 30, isSolar ? SOLAR_TOUCH_RADIUS : MIN_TOUCH_RADIUS);
    const distance = Math.hypot(x - starX, y - starY);
    if (distance <= touchRadius && distance < nearestDistance) {
      nearest = star;
      nearestDistance = distance;
    }
  }
  return nearest;
}
