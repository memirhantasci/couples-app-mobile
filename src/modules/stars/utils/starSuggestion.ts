import type { ViewportStarItem } from '../types/star.types';
import { UNCLAIMED_STAR_BRIGHTNESS, starVisibility } from '../canvas/macro/starStyle';

/**
 * `suggest_available_stars` RPC'sinin bir satırı. PostgREST numeric sütunlarını sayı ya da metin olarak
 * döndürebildiğinden sayısal alanlar her ikisini de kabul eder.
 */
export interface SuggestedStarRow {
  readonly catalog_id: number | string;
  readonly catalog_code: string;
  readonly ra: number | string;
  readonly dec: number | string;
  readonly magnitude: number | string;
  readonly spectral_type: string;
  readonly base_color: string;
  readonly common_name?: string | null;
}

/** Öneri yıldızına uçulurken kameranın varsayılan yakınlığı (parlak/orta yıldızlar için yeterli). */
export const SUGGESTED_STAR_ZOOM = 3.0;

/** Daha sönük yıldızlar için denenen, giderek daha yakın kamera yakınlıkları. */
const SUGGESTED_STAR_ZOOM_STEPS = [SUGGESTED_STAR_ZOOM, 5.0, 7.0] as const;

/**
 * Önerilen yıldıza uçulacak kamera yakınlığı: yıldızın tam görünür olduğu en uzak yakınlık. Kademeli görünürlükte
 * (starStyle.visibleMagnitudeLimit) katalogdaki her yıldız 2.5'ten itibaren tam görünür, bu yüzden bu bugün hep
 * varsayılan yakınlıktır; sınır değişirse kamera yine çizilmeyen bir noktaya uçmaz.
 */
export function suggestedStarZoom(magnitude: number): number {
  for (const zoom of SUGGESTED_STAR_ZOOM_STEPS) {
    if (starVisibility(magnitude, false, zoom) >= 1) return zoom;
  }
  return SUGGESTED_STAR_ZOOM_STEPS[SUGGESTED_STAR_ZOOM_STEPS.length - 1];
}

/**
 * Önerilen (boşta) yıldızı, gökyüzü kartının ve tescil penceresinin kullandığı `ViewportStarItem` biçimine çevirir.
 * Bozuk bir satır (sayıya çevrilemeyen koordinat, eksik kod) null döner; çağıran bu satırı atar.
 */
export function toSuggestedViewportStar(row: SuggestedStarRow): ViewportStarItem | null {
  const catalogId = Number(row.catalog_id);
  const ra = Number(row.ra);
  const dec = Number(row.dec);
  const magnitude = Number(row.magnitude);
  if (![catalogId, ra, dec, magnitude].every(Number.isFinite)) return null;
  if (typeof row.catalog_code !== 'string' || row.catalog_code.length === 0) return null;

  return {
    catalog_id: catalogId,
    catalog_code: row.catalog_code,
    ra,
    dec,
    magnitude,
    spectral_type: row.spectral_type,
    base_color: row.base_color,
    common_name: row.common_name ?? null,
    is_claimed: false,
    is_mine: false,
    custom_name: null,
    luminosity_level: UNCLAIMED_STAR_BRIGHTNESS,
    resonance_active: false,
    owner_label: null,
    is_connected: false,
  };
}
