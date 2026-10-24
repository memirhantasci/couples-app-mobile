import { useCallback, useEffect, useState } from 'react';
import { starService } from '../api/starService';
import type { ViewportStarItem } from '../types/star.types';
import { SKY_TILE_LEVELS, SkyTileStore } from '../utils/skyTiles';
import { SkyTileStreamController, type SkyViewport } from '../utils/skyTileStream';

const EMPTY_STARS: ViewportStarItem[] = [];

/**
 * Oturum boyunca yaşayan karo önbelleği: yıldız ekranı kapatılıp açılınca görünür karolar ağdan beklenmeden
 * önbellekten çizilir (60 sn'den eskilerse arkadan tazelenir). Hesap değişince clearSharedSkyTiles ile boşaltılır:
 * karolardaki "benim yıldızım" / bağlantı bilgisi kullanıcıya özeldir.
 */
let sharedStore: SkyTileStore | null = null;
const getSharedStore = () => (sharedStore ??= new SkyTileStore(400));
export function clearSharedSkyTiles() {
  sharedStore = null;
}

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
        store: getSharedStore(),
      }),
  );

  useEffect(() => {
    controller.activate();
    return () => controller.dispose();
  }, [controller]);

  const onBoundsChange = useCallback((viewport: SkyViewport) => controller.setViewport(viewport), [controller]);
  const prefetch = useCallback((viewport: SkyViewport) => controller.prefetch(viewport), [controller]);
  const refresh = useCallback(() => controller.refresh(), [controller]);

  return { stars, onBoundsChange, prefetch, refresh };
}
