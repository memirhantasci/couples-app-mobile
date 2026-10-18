import { useCallback, useEffect, useState } from 'react';
import { starService } from '../api/starService';
import type { ViewportStarItem } from '../types/star.types';
import { SKY_TILE_LEVELS } from '../utils/skyTiles';
import { SkyTileStreamController, type SkyViewport } from '../utils/skyTileStream';

const EMPTY_STARS: ViewportStarItem[] = [];

/**
 * Star data for the macro sky map, streamed tile by tile.
 *
 * Pass `onBoundsChange` to MacroSkyCanvas (it reports throttled bounds while
 * the camera moves) and render `stars`. `prefetch` warms a destination,
 * such as a fly-to target, before the camera gets there. The cache lives
 * as long as the screen, so switching micro/macro views does not refetch.
 */
export function useSkyTileStream() {
  const [stars, setStars] = useState<ViewportStarItem[]>(EMPTY_STARS);
  const [controller] = useState(
    () =>
      new SkyTileStreamController({
        fetchTile: (tile, signal) =>
          starService.fetchStarsInViewport(
            {
              minRa: tile.minRa,
              maxRa: tile.maxRa,
              minDec: tile.minDec,
              maxDec: tile.maxDec,
              zoomLevel: SKY_TILE_LEVELS[tile.level].rpcZoom,
            },
            { signal },
          ),
        onStars: setStars,
      }),
  );

  useEffect(() => {
    controller.activate();
    return () => controller.dispose();
  }, [controller]);

  const onBoundsChange = useCallback((viewport: SkyViewport) => controller.setViewport(viewport), [controller]);
  const prefetch = useCallback((viewport: SkyViewport) => controller.prefetch(viewport), [controller]);

  return { stars, onBoundsChange, prefetch };
}
