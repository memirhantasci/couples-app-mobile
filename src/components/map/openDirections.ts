import { Linking, Platform } from "react-native";

/** Bağlantı hiç açılamazsa (tarayıcı / harita uygulaması yok) sessizce vazgeçilir. */
function openUrlSafely(url: string): void {
  Linking.openURL(url).catch(() => {});
}

/** Cihazın harici harita uygulamasında yol tarifi açar; olmazsa Google Maps web'e düşer. */
export function openDirections(lat: number, lng: number): void {
  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const scheme = Platform.select({
    ios: `maps://app?daddr=${lat},${lng}`,
    android: `google.navigation:q=${lat},${lng}`,
  });

  Linking.openURL(scheme || webUrl).catch(() => {
    openUrlSafely(webUrl);
  });
}

/** Koordinatı olmayan bir yer adını Google Maps'te arar. */
export function openMapSearch(query: string): void {
  openUrlSafely(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
}
