import type { SkPaint, SkPicture } from '@shopify/react-native-skia';
import { Easing, withTiming, type SharedValue } from 'react-native-reanimated';
import type { ViewportStarItem } from '../../types/star.types';
import { Skia } from '../skiaBridge';
import { bandZoom, lodForZoom, magnitudeLimitForZoom, normalizeRa, pxPerDegree } from './skyProjection';
import { magnitudeToAlpha, magnitudeToRadius, MAX_STAR_EXTENT_PX } from './starStyle';

/**
 * Star pictures, recorded on the JS thread in world space (x = RA°, y = -dec°)
 * for one zoom band and one 30° render tile. The UI thread only translates
 * and scales them, so panning and zooming never re-record anything.
 */

export const RENDER_TILE_DEGREES = 30;
export const STAR_FADE_MS = 220;
/** Additions stack as fading delta layers; past this a tile is re-recorded whole. */
const MAX_LAYERS_PER_TILE = 4;
const MAX_CACHED_TILE_PICTURES = 96;

export interface StarTileEntry {
  readonly picture: SkPicture;
  readonly minRa: number;
  readonly maxRa: number;
  readonly minDec: number;
  readonly maxDec: number;
  /** How far star glows reach past the tile edge, in degrees. */
  readonly marginDeg: number;
  /** Date.now() when the entry began fading in; 0 = fully visible. */
  readonly bornAt: number;
  /** Date.now() when the entry began fading out; 0 = alive. */
  readonly diedAt: number;
}

export interface StarScene {
  readonly entries: readonly StarTileEntry[];
}

export const EMPTY_STAR_SCENE: StarScene = { entries: [] };

interface TileBounds {
  readonly minRa: number;
  readonly maxRa: number;
  readonly minDec: number;
  readonly maxDec: number;
}

interface TileLayer {
  readonly picture: SkPicture;
  readonly bornAt: number;
}

interface TileState {
  readonly band: number;
  readonly bounds: TileBounds;
  readonly marginDeg: number;
  readonly starHashes: ReadonlyMap<number, number>;
  readonly layers: TileLayer[];
}

// ─── Colours ───────────────────────────────────────────────────────────────

const rgbCache = new Map<string, readonly [number, number, number]>();

function rgbOf(hex: string): readonly [number, number, number] {
  let cached = rgbCache.get(hex);
  if (!cached) {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    cached = clean.length >= 6 && !Number.isNaN(r + g + b) ? [r / 255, g / 255, b / 255] : [1, 1, 1];
    rgbCache.set(hex, cached);
  }
  return cached;
}

/** Skia colour without string parsing per star. */
export function colorOf(hex: string, alpha: number): Float32Array {
  const [r, g, b] = rgbOf(hex);
  return Float32Array.of(r, g, b, Math.max(0, Math.min(1, alpha)));
}

const GOLD = '#F59E0B';
const PURPLE = '#A855F7';
const WHITE = '#FFFFFF';

// ─── Hashing ───────────────────────────────────────────────────────────────

function mixHash(hash: number, value: number): number {
  return Math.imul(hash ^ (value | 0), 16777619) >>> 0;
}

function mixStringHash(hash: number, value: string): number {
  let next = hash;
  for (let index = 0; index < value.length; index += 1) {
    next = mixHash(next, value.charCodeAt(index));
  }
  return next;
}

/** Hash of every field that changes how a star is drawn. */
function starRenderHash(star: ViewportStarItem): number {
  let hash = 2166136261;
  hash = mixHash(hash, star.catalog_id);
  hash = mixHash(hash, Math.round(star.magnitude * 100));
  hash = mixHash(hash, star.is_claimed ? 1 : 0);
  hash = mixHash(hash, star.resonance_active ? 1 : 0);
  hash = mixHash(hash, Math.round((star.luminosity_level ?? 1) * 100));
  hash = mixStringHash(hash, star.base_color || WHITE);
  return mixStringHash(hash, (star.spectral_type || 'G').charAt(0));
}

function tileSignature(hashes: ReadonlyMap<number, number>): string {
  let sum = 0;
  let xor = 0;
  for (const hash of hashes.values()) {
    sum = (sum + hash) >>> 0;
    xor = (xor ^ hash) >>> 0;
  }
  return `${hashes.size}:${sum}:${xor}`;
}

// ─── Tiles ─────────────────────────────────────────────────────────────────

function renderTileKey(star: ViewportStarItem): string {
  const raIndex = Math.min(11, Math.floor(normalizeRa(star.ra) / RENDER_TILE_DEGREES));
  const decIndex = Math.floor((Math.max(-90, Math.min(89.9999, star.dec)) + 90) / RENDER_TILE_DEGREES);
  return `${raIndex}:${decIndex}`;
}

function renderTileBounds(key: string): TileBounds {
  const [raIndex, decIndex] = key.split(':').map(Number);
  return {
    minRa: raIndex * RENDER_TILE_DEGREES,
    maxRa: (raIndex + 1) * RENDER_TILE_DEGREES,
    minDec: decIndex * RENDER_TILE_DEGREES - 90,
    maxDec: (decIndex + 1) * RENDER_TILE_DEGREES - 90,
  };
}

// ─── Recording ─────────────────────────────────────────────────────────────

interface StarPaints {
  readonly fill: SkPaint;
  readonly stroke: SkPaint;
}

function createStarPaints(): StarPaints {
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  const stroke = Skia.Paint();
  stroke.setAntiAlias(true);
  stroke.setStyle(1);
  return { fill, stroke };
}

/**
 * Records stars as they look at `band`'s zoom. Radii and strokes are designed
 * in screen pixels (as before) and converted to degrees for world space.
 */
function recordStarTile(
  stars: readonly ViewportStarItem[],
  bounds: TileBounds,
  band: number,
  viewportHeight: number,
  paints: StarPaints,
): SkPicture {
  const zoom = bandZoom(band);
  const lod = lodForZoom(zoom);
  const degPerPx = 1 / pxPerDegree(zoom, viewportHeight);
  const margin = MAX_STAR_EXTENT_PX * degPerPx;
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(
    Skia.XYWHRect(
      bounds.minRa - margin,
      -bounds.maxDec - margin,
      bounds.maxRa - bounds.minRa + margin * 2,
      bounds.maxDec - bounds.minDec + margin * 2,
    ),
  );
  const { fill, stroke } = paints;
  stroke.setStrokeWidth(1.25 * degPerPx);

  for (const star of stars) {
    const x = normalizeRa(star.ra);
    const y = -star.dec;
    const radiusPx = magnitudeToRadius(star.magnitude, star.spectral_type, zoom);
    const r = radiusPx * degPerPx;
    const baseColor = star.base_color || WHITE;
    const luminosity = star.luminosity_level ?? 1;
    const alpha = magnitudeToAlpha(star.magnitude, luminosity);

    if (lod === 'low') {
      if (star.resonance_active) {
        stroke.setColor(colorOf(GOLD, 0.9));
        canvas.drawCircle(x, y, r * 1.9, stroke);
        stroke.setColor(colorOf(PURPLE, 0.9));
        canvas.drawCircle(x, y, r * 1.35, stroke);
        continue;
      }
      fill.setColor(colorOf(baseColor, alpha));
      canvas.drawCircle(x, y, r, fill);
      continue;
    }

    if (lod === 'medium') {
      fill.setColor(colorOf(baseColor, 0.25));
      canvas.drawCircle(x, y, r * 2.5, fill);
      fill.setColor(colorOf(baseColor, 0.45));
      canvas.drawCircle(x, y, r * 1.6, fill);
      fill.setColor(colorOf(baseColor, alpha));
      canvas.drawCircle(x, y, r, fill);
      if (star.resonance_active) {
        stroke.setColor(colorOf(GOLD, 0.9));
        canvas.drawCircle(x, y, r * 2.2, stroke);
        stroke.setColor(colorOf(PURPLE, 0.8));
        canvas.drawCircle(x, y, r * 1.75, stroke);
      }
      continue;
    }

    // High LOD: halos, aura, core and a white-hot centre for bright stars.
    if (star.resonance_active) {
      stroke.setColor(colorOf(GOLD, 0.5 * luminosity));
      canvas.drawCircle(x, y, (radiusPx + 20) * degPerPx, stroke);
      stroke.setColor(colorOf(PURPLE, 0.6 * luminosity));
      canvas.drawCircle(x, y, (radiusPx + 10) * degPerPx, stroke);
    } else if (star.is_claimed) {
      fill.setColor(colorOf(baseColor, 0.4 * luminosity));
      canvas.drawCircle(x, y, (radiusPx + 14) * degPerPx, fill);
    }
    fill.setColor(colorOf(baseColor, alpha * 0.45));
    canvas.drawCircle(x, y, r * 2.2, fill);
    fill.setColor(colorOf(baseColor, alpha));
    canvas.drawCircle(x, y, r, fill);
    if (star.magnitude <= 3.5) {
      fill.setColor(colorOf(WHITE, Math.min(1, alpha * 1.2)));
      canvas.drawCircle(x, y, Math.max(1, radiusPx * 0.35) * degPerPx, fill);
    }
  }

  return recorder.finishRecordingAsPicture();
}

// ─── Scene manager ─────────────────────────────────────────────────────────

export interface StarSceneStats {
  records: number;
  lastRebuildMs: number;
  entries: number;
}

/**
 * Keeps one set of tile pictures for the current zoom band and publishes it
 * to the UI thread. Pure additions (progressive loading) fade in as delta
 * layers without touching stars already on screen; a band switch
 * cross-fades the old band out.
 */
export class StarSceneManager {
  private readonly viewportHeight: number;
  private readonly scene: SharedValue<StarScene>;
  private readonly fadeClock: SharedValue<number>;
  private readonly paints: StarPaints;
  private readonly tiles = new Map<string, TileState>();
  private readonly pictureCache = new Map<string, { signature: string; picture: SkPicture }>();
  private dying: StarTileEntry[] = [];
  private stars: readonly ViewportStarItem[] = [];
  private band = -1;
  private pruneTimer: ReturnType<typeof setTimeout> | null = null;
  readonly stats: StarSceneStats = { records: 0, lastRebuildMs: 0, entries: 0 };

  constructor(viewportHeight: number, scene: SharedValue<StarScene>, fadeClock: SharedValue<number>) {
    this.viewportHeight = viewportHeight;
    this.scene = scene;
    this.fadeClock = fadeClock;
    this.paints = createStarPaints();
  }

  setStars(stars: readonly ViewportStarItem[]) {
    if (stars === this.stars) return;
    this.stars = stars;
    this.rebuild();
  }

  setBand(band: number) {
    if (band === this.band) return;
    this.band = band;
    this.rebuild();
  }

  /** Faintest unclaimed magnitude currently drawn; taps must not hit hidden stars. */
  get magnitudeLimit() {
    return this.band < 0 ? Infinity : magnitudeLimitForZoom(bandZoom(this.band));
  }

  dispose() {
    if (this.pruneTimer) clearTimeout(this.pruneTimer);
    this.pruneTimer = null;
  }

  private fullPicture(key: string, stars: readonly ViewportStarItem[], bounds: TileBounds, signature: string) {
    const cacheKey = `${key}|${this.band}`;
    const cached = this.pictureCache.get(cacheKey);
    if (cached && cached.signature === signature) {
      this.pictureCache.delete(cacheKey);
      this.pictureCache.set(cacheKey, cached);
      return cached.picture;
    }
    const picture = recordStarTile(stars, bounds, this.band, this.viewportHeight, this.paints);
    this.stats.records += 1;
    this.pictureCache.delete(cacheKey);
    this.pictureCache.set(cacheKey, { signature, picture });
    while (this.pictureCache.size > MAX_CACHED_TILE_PICTURES) {
      const oldest = this.pictureCache.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      // Pictures are garbage collected; one may still be drawn by a fading entry.
      this.pictureCache.delete(oldest);
    }
    return picture;
  }

  private rebuild() {
    if (this.band < 0) return;
    const startedAt = performance.now();
    const now = Date.now();
    const magnitudeLimit = magnitudeLimitForZoom(bandZoom(this.band));
    const degPerPx = 1 / pxPerDegree(bandZoom(this.band), this.viewportHeight);
    const marginDeg = MAX_STAR_EXTENT_PX * degPerPx;

    const groups = new Map<string, ViewportStarItem[]>();
    for (const star of this.stars) {
      // The user's own star is drawn by the hero beacon overlay.
      if (star.is_mine) continue;
      if (!star.is_claimed && star.magnitude > magnitudeLimit) continue;
      const key = renderTileKey(star);
      const group = groups.get(key);
      if (group) group.push(star);
      else groups.set(key, [star]);
    }

    let changed = false;
    for (const [key, state] of this.tiles) {
      if (groups.has(key)) continue;
      // Fade out rather than pop (e.g. faint stars leaving at a lower band).
      for (const layer of state.layers) {
        this.dying.push(this.toEntry(state.bounds, state.marginDeg, layer, now));
      }
      this.tiles.delete(key);
      changed = true;
    }

    for (const [key, tileStars] of groups) {
      const state = this.tiles.get(key);
      const starHashes = new Map<number, number>();
      for (const star of tileStars) starHashes.set(star.catalog_id, starRenderHash(star));
      const bounds = state?.bounds ?? renderTileBounds(key);

      if (!state || state.band !== this.band) {
        if (state) {
          for (const layer of state.layers) {
            this.dying.push(this.toEntry(state.bounds, state.marginDeg, layer, now));
          }
        }
        const picture = this.fullPicture(key, tileStars, bounds, tileSignature(starHashes));
        this.tiles.set(key, { band: this.band, bounds, marginDeg, starHashes, layers: [{ picture, bornAt: now }] });
        changed = true;
        continue;
      }

      const added: ViewportStarItem[] = [];
      let modified = false;
      for (const star of tileStars) {
        const previous = state.starHashes.get(star.catalog_id);
        if (previous === undefined) added.push(star);
        else if (previous !== starHashes.get(star.catalog_id)) modified = true;
      }
      if (!modified) {
        for (const id of state.starHashes.keys()) {
          if (!starHashes.has(id)) {
            modified = true;
            break;
          }
        }
      }
      if (!modified && added.length === 0) continue;

      if (modified || state.layers.length >= MAX_LAYERS_PER_TILE) {
        // Status/brightness changes apply instantly; no cross-fade of identical stars.
        const picture = this.fullPicture(key, tileStars, bounds, tileSignature(starHashes));
        this.tiles.set(key, { ...state, starHashes, layers: [{ picture, bornAt: 0 }] });
      } else {
        const delta = recordStarTile(added, bounds, this.band, this.viewportHeight, this.paints);
        this.stats.records += 1;
        this.tiles.set(key, { ...state, starHashes, layers: [...state.layers, { picture: delta, bornAt: now }] });
      }
      changed = true;
    }

    const liveDying = this.dying.filter((entry) => now - entry.diedAt < STAR_FADE_MS);
    if (liveDying.length !== this.dying.length) {
      this.dying = liveDying;
      changed = true;
    }
    this.stats.lastRebuildMs = performance.now() - startedAt;
    if (changed) this.publish(now);
  }

  private toEntry(bounds: TileBounds, marginDeg: number, layer: TileLayer, diedAt: number): StarTileEntry {
    return { picture: layer.picture, ...bounds, marginDeg, bornAt: layer.bornAt, diedAt };
  }

  private publish(now: number) {
    const entries: StarTileEntry[] = [...this.dying];
    let fading = this.dying.length > 0;
    for (const state of this.tiles.values()) {
      for (const layer of state.layers) {
        entries.push(this.toEntry(state.bounds, state.marginDeg, layer, 0));
        if (layer.bornAt > 0 && now - layer.bornAt < STAR_FADE_MS) fading = true;
      }
    }
    this.stats.entries = entries.length;
    this.scene.set({ entries });
    if (!fading) return;

    // One shared clock drives every fade; it only ticks while something fades.
    this.fadeClock.set(now);
    this.fadeClock.set(withTiming(now + STAR_FADE_MS, { duration: STAR_FADE_MS, easing: Easing.linear }));
    if (this.pruneTimer) clearTimeout(this.pruneTimer);
    this.pruneTimer = setTimeout(() => {
      this.pruneTimer = null;
      this.prune();
    }, STAR_FADE_MS + 40);
  }

  private prune() {
    const now = Date.now();
    const liveDying = this.dying.filter((entry) => now - entry.diedAt < STAR_FADE_MS);
    if (liveDying.length === this.dying.length) return;
    this.dying = liveDying;
    this.publish(now);
  }
}
