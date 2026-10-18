import type { MapThemeType } from "@/components/map/mapTypes";

/** `customMapStyle` için tek bir Google Maps stil kuralı. */
export interface MapStyleRule {
  featureType?: string;
  elementType?: string;
  stylers: Record<string, string | number>[];
}

// ─── HARİTA STİLLERİ (Otoyollar bağırmıyor, romantik, zarif ve aydınlık) ─────

// 1. Romantik & Sıcak Pastel Tema (Varsayılan: Yumuşak krem, nane/gül parklar, sakin su)
export const ROMANTIC_CREAM_STYLE: MapStyleRule[] = [
  { elementType: "geometry", stylers: [{ color: "#F9F6F0" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#4A4356" }] },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#F9F6F0" }, { weight: 2 }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9E4A68" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#F0E9DF" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#E7EFE6" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#5E8467" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#FFFFFF" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#E8DFD8" }, { weight: 0.8 }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#FCEEE9" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#F2D7CD" }, { weight: 1 }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8E6058" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#EAE3DC" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#C6DCF2" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#4E7294" }],
  },
];

// 2. Geceyarısı Kadife Tema (Sade, zengin lacivert/antrasit koyu tema)
export const MIDNIGHT_VELVET_STYLE: MapStyleRule[] = [
  { elementType: "geometry", stylers: [{ color: "#0F131D" }] },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#0F131D" }, { weight: 2 }],
  },
  { elementType: "labels.text.fill", stylers: [{ color: "#9BA5B9" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#E0A8BA" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8E99AF" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#161F26" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#618F71" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1C2232" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#131722" }, { weight: 0.8 }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#7B879D" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#2A3249" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1A1F2E" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#C9D4EC" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#192030" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0A0D15" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3B5270" }],
  },
];

// 3. Minimalist Gümüş Tema (Temiz, nötr Apple Maps tarzı)
export const MINIMAL_SILVER_STYLE: MapStyleRule[] = [
  { elementType: "geometry", stylers: [{ color: "#F2F4F7" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5F6368" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#F2F4F7" }] },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#E3ECE2" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#FFFFFF" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#E0E3E8" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#D2E2F0" }],
  },
];

export const MAP_THEME_STYLES: Record<MapThemeType, MapStyleRule[]> = {
  romantic: ROMANTIC_CREAM_STYLE,
  midnight: MIDNIGHT_VELVET_STYLE,
  silver: MINIMAL_SILVER_STYLE,
};

/** Açık zeminli temalarda koyu yazı/ikon, koyu temada açık renk kullanılır. */
export const isLightMapTheme = (theme: MapThemeType): boolean =>
  theme === "romantic" || theme === "silver";
