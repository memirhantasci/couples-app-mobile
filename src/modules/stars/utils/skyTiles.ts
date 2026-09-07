import type { ViewportStarItem } from '../types/star.types';

export const SKY_TILE_SIZE_DEGREES = 30;
export const MAX_VIEWPORT_STARS = 300;

export interface SkyTile {
  readonly key: string;
  readonly minRa: number;
  readonly maxRa: number;
  readonly minDec: number;
  readonly maxDec: number;
}

export interface SkyBounds {
  readonly minRa: number;
  readonly maxRa: number;
  readonly minDec: number;
  readonly maxDec: number;
}

function normalizeRa(ra: number) {
  return ((ra % 360) + 360) % 360;
}

/** Returns every fixed world tile intersecting a viewport, including RA wrap. */
export function getTilesInBounds(bounds: SkyBounds): SkyTile[] {
  const minDec = Math.max(-90, bounds.minDec);
  const maxDec = Math.min(90, bounds.maxDec);
  if (minDec > maxDec) return [];

  const normalizedMaxRa = bounds.maxRa === 360 ? 360 : normalizeRa(bounds.maxRa);
  const ranges = bounds.minRa <= bounds.maxRa
    ? [[normalizeRa(bounds.minRa), normalizedMaxRa]]
    : [[normalizeRa(bounds.minRa), 360], [0, normalizeRa(bounds.maxRa)]];
  const tiles = new Map<string, SkyTile>();
  const minDecIndex = Math.max(0, Math.floor((minDec + 90) / SKY_TILE_SIZE_DEGREES));
  const maxDecIndex = Math.min(5, Math.floor((Math.max(minDec, maxDec - 0.0001) + 90) / SKY_TILE_SIZE_DEGREES));

  for (const [rangeMin, rangeMax] of ranges) {
    const minRaIndex = Math.floor(rangeMin / SKY_TILE_SIZE_DEGREES);
    const maxRaIndex = Math.min(11, Math.floor((Math.max(rangeMin, rangeMax - 0.0001)) / SKY_TILE_SIZE_DEGREES));
    for (let raIndex = minRaIndex; raIndex <= maxRaIndex; raIndex += 1) {
      for (let decIndex = minDecIndex; decIndex <= maxDecIndex; decIndex += 1) {
        const key = `${raIndex}:${decIndex}`;
        tiles.set(key, {
          key,
          minRa: raIndex * SKY_TILE_SIZE_DEGREES,
          maxRa: (raIndex + 1) * SKY_TILE_SIZE_DEGREES,
          minDec: decIndex * SKY_TILE_SIZE_DEGREES - 90,
          maxDec: (decIndex + 1) * SKY_TILE_SIZE_DEGREES - 90,
        });
      }
    }
  }

  return Array.from(tiles.values());
}

export function isStarInBounds(star: ViewportStarItem, bounds: SkyBounds) {
  if (star.dec < bounds.minDec || star.dec > bounds.maxDec) return false;
  const ra = normalizeRa(star.ra);
  return bounds.minRa <= bounds.maxRa
    ? ra >= bounds.minRa && ra <= bounds.maxRa
    : ra >= bounds.minRa || ra <= bounds.maxRa;
}

/** A tiny dependency-free LRU with TTL, suitable for React refs. */
export class LruTtlCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T) {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) return;
      this.entries.delete(oldestKey);
    }
  }
}

/** De-duplicates tile borders and guarantees that the canvas receives <= 300 stars. */
export function mergeViewportStars(tileStars: readonly (readonly ViewportStarItem[])[]): ViewportStarItem[] {
  const unique = new Map<number, ViewportStarItem>();
  for (const stars of tileStars) {
    for (const star of stars) unique.set(star.catalog_id, star);
  }

  return Array.from(unique.values())
    .sort((left, right) => {
      if (left.is_mine !== right.is_mine) return left.is_mine ? -1 : 1;
      if (left.is_claimed !== right.is_claimed) return left.is_claimed ? -1 : 1;
      return left.magnitude - right.magnitude;
    })
    .slice(0, MAX_VIEWPORT_STARS);
}

export function areSameViewportStars(
  left: readonly ViewportStarItem[],
  right: readonly ViewportStarItem[],
) {
  return left.length === right.length && left.every((star, index) => {
    const other = right[index];
    return star.catalog_id === other.catalog_id
      && star.is_mine === other.is_mine
      && star.is_claimed === other.is_claimed
      && star.luminosity_level === other.luminosity_level
      && star.resonance_active === other.resonance_active
      && star.custom_name === other.custom_name;
  });
}
