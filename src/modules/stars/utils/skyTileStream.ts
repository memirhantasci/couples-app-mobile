import type { ViewportStarItem } from '../types/star.types';
import {
  boundsCenter,
  getTilesInBounds,
  mergeTileStars,
  SKY_TILE_LEVELS,
  SkyTileStore,
  sortTilesByDistance,
  tileLevelForZoom,
  type SkyBounds,
  type SkyTile,
  type SkyTileRecord,
} from './skyTiles';

export interface SkyViewport extends SkyBounds {
  readonly zoomLevel: number;
}

export interface SkyTileStreamOptions {
  readonly fetchTile: (tile: SkyTile, signal: AbortSignal) => Promise<readonly ViewportStarItem[]>;
  /** Receives the merged stars for the current viewport whenever they change. */
  readonly onStars: (stars: ViewportStarItem[]) => void;
  readonly maxConcurrent?: number;
  /** Cached tiles older than this are shown, then refetched in the background. */
  readonly staleMs?: number;
  /** A failed tile is not retried for this long. */
  readonly retryAfterMs?: number;
  /** Responses arriving within this window are published together. */
  readonly flushDelayMs?: number;
  readonly maxTiles?: number;
  readonly now?: () => number;
}

/**
 * Streams sky tiles for a moving viewport.
 *
 * Viewport updates arrive throttled while the camera moves, never only at
 * the end of a gesture. Visible tiles load centre-out with bounded
 * concurrency; tiles that left the view are aborted; every response is
 * cached by tile (none is dropped for being "late"), and the published
 * star list is the union of all cached levels inside the viewport, so stars
 * already on screen stay there while finer levels load.
 */
export class SkyTileStreamController {
  private readonly options: Required<Omit<SkyTileStreamOptions, 'fetchTile' | 'onStars'>> &
    Pick<SkyTileStreamOptions, 'fetchTile' | 'onStars'>;
  private readonly store: SkyTileStore;
  private readonly inFlight = new Map<string, AbortController>();
  private readonly failedAt = new Map<string, number>();
  private readonly prefetchKeys = new Set<string>();
  private queue: SkyTile[] = [];
  private viewport: SkyViewport | null = null;
  private lastSignature = '';
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private active = true;

  constructor(options: SkyTileStreamOptions) {
    this.options = {
      maxConcurrent: 4,
      staleMs: 60_000,
      retryAfterMs: 5_000,
      flushDelayMs: 60,
      maxTiles: 400,
      now: () => Date.now(),
      ...options,
    };
    this.store = new SkyTileStore(this.options.maxTiles);
  }

  /** The viewport changed (throttled while moving, exact when settled). */
  setViewport(viewport: SkyViewport) {
    if (!this.active) return;
    this.viewport = viewport;
    const level = tileLevelForZoom(viewport.zoomLevel);
    const center = boundsCenter(viewport);
    const needed = sortTilesByDistance(getTilesInBounds(viewport, level), center.ra, center.dec);
    const neededKeys = new Set(needed.map((tile) => tile.key));
    for (const tile of needed) this.store.touch(tile.key);

    for (const [key, controller] of this.inFlight) {
      if (neededKeys.has(key) || this.prefetchKeys.has(key)) continue;
      controller.abort();
      this.inFlight.delete(key);
    }

    const prefetchTail = this.queue.filter((tile) => this.prefetchKeys.has(tile.key) && !neededKeys.has(tile.key));
    this.queue = [...this.plan(needed), ...prefetchTail];
    this.pump();
    this.flush();
  }

  /** Loads tiles for a destination (e.g. a fly-to target) without disturbing the view. */
  prefetch(viewport: SkyViewport) {
    if (!this.active) return;
    const level = tileLevelForZoom(viewport.zoomLevel);
    const center = boundsCenter(viewport);
    const tiles = this.plan(sortTilesByDistance(getTilesInBounds(viewport, level), center.ra, center.dec));
    const queued = new Set(this.queue.map((tile) => tile.key));
    for (const tile of tiles) {
      this.prefetchKeys.add(tile.key);
      if (!queued.has(tile.key)) this.queue.push(tile);
    }
    this.pump();
  }

  activate() {
    this.active = true;
  }

  dispose() {
    this.active = false;
    for (const controller of this.inFlight.values()) controller.abort();
    this.inFlight.clear();
    this.queue = [];
    this.prefetchKeys.clear();
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }

  /** Missing tiles first, then stale ones (served from cache meanwhile). */
  private plan(tiles: readonly SkyTile[]): SkyTile[] {
    const now = this.options.now();
    const missing: SkyTile[] = [];
    const stale: SkyTile[] = [];
    for (const tile of tiles) {
      if (this.inFlight.has(tile.key)) continue;
      const failedAt = this.failedAt.get(tile.key);
      if (failedAt !== undefined && now - failedAt < this.options.retryAfterMs) continue;
      const record = this.store.peek(tile.key);
      if (!record) missing.push(tile);
      else if (now - record.fetchedAt > this.options.staleMs) stale.push(tile);
    }
    return [...missing, ...stale];
  }

  private pump() {
    while (this.active && this.inFlight.size < this.options.maxConcurrent && this.queue.length > 0) {
      const tile = this.queue.shift()!;
      if (this.inFlight.has(tile.key)) continue;
      const controller = new AbortController();
      this.inFlight.set(tile.key, controller);
      this.options
        .fetchTile(tile, controller.signal)
        .then(
          (stars) => {
            if (controller.signal.aborted) return;
            this.store.set(tile.key, stars, this.options.now());
            this.failedAt.delete(tile.key);
            this.scheduleFlush();
          },
          () => {
            if (!controller.signal.aborted) this.failedAt.set(tile.key, this.options.now());
          },
        )
        .finally(() => {
          if (this.inFlight.get(tile.key) === controller) this.inFlight.delete(tile.key);
          this.prefetchKeys.delete(tile.key);
          this.pump();
        });
    }
  }

  private scheduleFlush() {
    if (this.flushTimer || !this.active) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, this.options.flushDelayMs);
  }

  /** Publishes the union of cached tiles (all levels) inside the viewport, if it changed. */
  private flush() {
    const viewport = this.viewport;
    if (!viewport || !this.active) return;
    const records: SkyTileRecord[] = [];
    const parts: string[] = [];
    for (let level = 0; level < SKY_TILE_LEVELS.length; level += 1) {
      for (const tile of getTilesInBounds(viewport, level)) {
        const record = this.store.peek(tile.key);
        if (!record) continue;
        records.push(record);
        parts.push(`${tile.key}@${record.fetchedAt}`);
      }
    }
    const signature = parts.join('|');
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.options.onStars(mergeTileStars(records));
  }
}
