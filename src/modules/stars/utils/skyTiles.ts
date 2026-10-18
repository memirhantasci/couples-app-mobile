import type { ViewportStarItem } from '../types/star.types';

/**
 * Sky tile pyramid for streaming stars from `get_stars_in_viewport`.
 *
 * Levels follow the RPC's LOD thresholds (zoom 1.5 and 4): each level asks
 * for a fainter magnitude limit, and finer levels use smaller tiles so one
 * call stays under the server's 300-row limit. Tiles of every level that
 * are already loaded stay usable, so zooming in only ever adds stars.
 */

export interface SkyTileLevel {
  readonly sizeDeg: number;
  /** `zoom_level` sent to the RPC; it selects the magnitude limit. */
  readonly rpcZoom: number;
}

export const SKY_TILE_LEVELS: readonly SkyTileLevel[] = [
  { sizeDeg: 30, rpcZoom: 1 }, // zoom < 1.5   → magnitude ≤ 3.8
  { sizeDeg: 15, rpcZoom: 2 }, // zoom < 4     → magnitude ≤ 5.8
  { sizeDeg: 15, rpcZoom: 5 }, // zoom ≥ 4     → magnitude ≤ 9.0
];

export function tileLevelForZoom(zoom: number): number {
  if (zoom < 1.5) return 0;
  if (zoom < 4) return 1;
  return 2;
}

export interface SkyBounds {
  readonly minRa: number;
  readonly maxRa: number;
  readonly minDec: number;
  readonly maxDec: number;
}

export interface SkyTile extends SkyBounds {
  readonly key: string;
  readonly level: number;
}

function normalizeRa(ra: number) {
  const wrapped = ra % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

export function skyTileKey(level: number, raIndex: number, decIndex: number) {
  return `${level}/${raIndex}/${decIndex}`;
}

/** Every tile of `level` intersecting the bounds; minRa > maxRa means the range crosses RA 0°. */
export function getTilesInBounds(bounds: SkyBounds, level = 0): SkyTile[] {
  const size = SKY_TILE_LEVELS[level].sizeDeg;
  const raCount = Math.round(360 / size);
  const decCount = Math.round(180 / size);
  const minDec = Math.max(-90, bounds.minDec);
  const maxDec = Math.min(90, bounds.maxDec);
  if (minDec > maxDec) return [];

  const minRa = normalizeRa(bounds.minRa);
  const maxRa = bounds.maxRa >= 360 ? 360 : normalizeRa(bounds.maxRa);
  const ranges = minRa <= maxRa ? [[minRa, maxRa]] : [[minRa, 360], [0, maxRa]];
  const minDecIndex = Math.max(0, Math.floor((minDec + 90) / size));
  const maxDecIndex = Math.min(decCount - 1, Math.floor((Math.max(minDec, maxDec - 1e-4) + 90) / size));
  const tiles = new Map<string, SkyTile>();

  for (const [rangeMin, rangeMax] of ranges) {
    const minRaIndex = Math.floor(rangeMin / size);
    const maxRaIndex = Math.min(raCount - 1, Math.floor(Math.max(rangeMin, rangeMax - 1e-4) / size));
    for (let raIndex = minRaIndex; raIndex <= maxRaIndex; raIndex += 1) {
      for (let decIndex = minDecIndex; decIndex <= maxDecIndex; decIndex += 1) {
        const key = skyTileKey(level, raIndex, decIndex);
        tiles.set(key, {
          key,
          level,
          minRa: raIndex * size,
          maxRa: (raIndex + 1) * size,
          minDec: decIndex * size - 90,
          maxDec: (decIndex + 1) * size - 90,
        });
      }
    }
  }
  return Array.from(tiles.values());
}

/** Centre of possibly RA-wrapping bounds. */
export function boundsCenter(bounds: SkyBounds) {
  const width = bounds.minRa <= bounds.maxRa ? bounds.maxRa - bounds.minRa : bounds.maxRa + 360 - bounds.minRa;
  return { ra: normalizeRa(bounds.minRa + width / 2), dec: (bounds.minDec + bounds.maxDec) / 2 };
}

/** Orders tiles centre-out so the middle of the screen fills first. */
export function sortTilesByDistance(tiles: readonly SkyTile[], ra: number, dec: number): SkyTile[] {
  const distance = (tile: SkyTile) => {
    const tileRa = (tile.minRa + tile.maxRa) / 2;
    const deltaRa = ((((tileRa - ra) % 360) + 540) % 360) - 180;
    const deltaDec = (tile.minDec + tile.maxDec) / 2 - dec;
    return deltaRa * deltaRa + deltaDec * deltaDec;
  };
  return [...tiles].sort((left, right) => distance(left) - distance(right));
}

export interface SkyTileRecord {
  readonly stars: readonly ViewportStarItem[];
  readonly fetchedAt: number;
}

/** Tile responses keyed by tile, evicting the least recently used. */
export class SkyTileStore {
  private readonly records = new Map<string, SkyTileRecord>();
  private readonly maxTiles: number;

  constructor(maxTiles = 400) {
    this.maxTiles = maxTiles;
  }

  /** Reads without changing the eviction order. */
  peek(key: string) {
    return this.records.get(key);
  }

  touch(key: string) {
    const record = this.records.get(key);
    if (record) {
      this.records.delete(key);
      this.records.set(key, record);
    }
    return record;
  }

  set(key: string, stars: readonly ViewportStarItem[], fetchedAt: number) {
    this.records.delete(key);
    this.records.set(key, { stars, fetchedAt });
    while (this.records.size > this.maxTiles) {
      const oldest = this.records.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.records.delete(oldest);
    }
  }

  get size() {
    return this.records.size;
  }
}

/**
 * Merges tile responses into one list. Stars on tile borders are
 * de-duplicated and the most recently fetched copy wins, so claim status
 * and brightness stay current. There is no global cap: every tile is
 * already bounded by the server.
 */
export function mergeTileStars(records: Iterable<SkyTileRecord>): ViewportStarItem[] {
  const ordered = [...records].sort((left, right) => left.fetchedAt - right.fetchedAt);
  const unique = new Map<number, ViewportStarItem>();
  for (const record of ordered) {
    for (const star of record.stars) unique.set(star.catalog_id, star);
  }
  return Array.from(unique.values());
}
