/**
 * Ortak liste düzenleme penceresindeki konum taslağı (WishlistEditSheet). Ad ile koordinat birbirinden kopmasın:
 *   • Ad ve nokta YALNIZCA haritadan seçimde birlikte gelir; seçim adı her zaman günceller.
 *   • Ad elle değişirse (tek harf bile) koordinat silinir. "Aynı yer mi" diye tahmin yürütülmez: benzer görünen
 *     adlar ("Kapadokya" → "Kapalıçarşı") başka yerlerdir ve eski nokta yeni adla kaydedilirdi.
 *   • Ad değişmeden kalırsa nokta korunur. Ad boşsa koordinat da kaydedilmez.
 */
export interface WishlistLocationDraft {
  name: string;
  latitude: number | null;
  longitude: number | null;
}

/** Ekranda gösterilen sınır; sunucuda 500. */
export const WISHLIST_LOCATION_NAME_MAX = 100;

const formatCoordinates = (latitude: number, longitude: number) => `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

export function locationFromMap(location: {
  latitude: number;
  longitude: number;
  locationName?: string | null;
}): WishlistLocationDraft {
  // Adres çözülemediyse koordinat yazılır: ad boş kalsaydı kayıtta nokta da düşerdi
  const name = (location.locationName ?? "").trim() || formatCoordinates(location.latitude, location.longitude);
  return {
    name: name.slice(0, WISHLIST_LOCATION_NAME_MAX),
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

export function locationAfterNameEdit(draft: WishlistLocationDraft, name: string): WishlistLocationDraft {
  if (name === draft.name) return draft;
  return { name, latitude: null, longitude: null };
}

export function locationPatch(
  draft: WishlistLocationDraft,
  clean: (text: string) => string
): { location_name: string | null; latitude: number | null; longitude: number | null } {
  const name = clean(draft.name);
  if (!name) return { location_name: null, latitude: null, longitude: null };
  const hasPoint = draft.latitude !== null && draft.longitude !== null;
  return {
    location_name: name,
    latitude: hasPoint ? draft.latitude : null,
    longitude: hasPoint ? draft.longitude : null,
  };
}
