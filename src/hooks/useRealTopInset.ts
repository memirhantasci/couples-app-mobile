import { initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Pencerenin GERÇEK üst güvenli alanı (durum çubuğu / çentik).
 *
 * Demo modunda `(tabs)/_layout.tsx` üst şeridin altındaki ekranlar için `insets.top` değerini 0'a çeker.
 * Tüm pencereyi kaplayan modal'lar (tam ekran fotoğraf görüntüleyiciler vb.) ise şeridin altında değil
 * ekranın tepesinden başladıkları için gerçek değeri bu hook'tan almalıdır.
 */
export function useRealTopInset(): number {
  const { top } = useSafeAreaInsets();
  return Math.max(top, initialWindowMetrics?.insets.top ?? 0);
}
