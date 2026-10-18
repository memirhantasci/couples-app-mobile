import { Linking, Platform } from "react-native";

/** Cihazın harici harita uygulamasında yol tarifi açar; olmazsa Google Maps web'e düşer. */
export function openDirections(lat: number, lng: number): void {
  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const scheme = Platform.select({
    ios: `maps://app?daddr=${lat},${lng}`,
    android: `google.navigation:q=${lat},${lng}`,
  });

  Linking.openURL(scheme || webUrl).catch(() => {
    Linking.openURL(webUrl);
  });
}
