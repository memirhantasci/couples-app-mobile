import { Platform } from "react-native";

/** Süzülen alt sekme çubuğunun yüksekliği (CustomTabBar). */
export const TAB_BAR_HEIGHT = 64;

/**
 * Çubuğun ekranın altından uzaklığı. Android'de uygulama sistem çubuğunun arkasına kadar çizilir:
 * 3 butonlu gezinmede çubuk butonların üstüne biniyordu. Sistem çubuğu yüksekliği (insets.bottom) eklenir.
 */
export function getTabBarBottomOffset(insetsBottom: number): number {
  return Platform.OS === "ios" ? Math.max(insetsBottom - 4, 12) : insetsBottom + 10;
}
