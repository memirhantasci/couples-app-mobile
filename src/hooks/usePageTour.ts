import { useState, useCallback } from "react";
import { safeStorage } from "@/lib/safeStorage";
import { FEATURE_GUIDES, PageTourGuide } from "@/constants/featureGuides";
import { resetHomeTour } from "@/hooks/useHomeSpotlightTour";

// Eski sürümde her sayfa ilk ziyarette kendi tanıtımını otomatik açıyordu; bu anahtarlar
// artık yalnızca temizlik için tutuluyor.
const LEGACY_TOUR_STORAGE_PREFIX = "@couples_app_tour_seen_v1_";

/** Tüm tanıtımları sıfırlar: bir sonraki Ana Sayfa ziyaretinde spotlight turu yeniden açılır. */
export async function resetAllPageTours(): Promise<void> {
  try {
    await Promise.all([
      resetHomeTour(),
      ...Object.keys(FEATURE_GUIDES).map((key) =>
        safeStorage.removeItem(`${LEGACY_TOUR_STORAGE_PREFIX}${key}`)
      ),
    ]);
  } catch {}
}

/**
 * Sayfa bilgi kartı: yalnızca kullanıcı sağ üstteki ? butonuna bastığında açılır,
 * sayfaya girişte kendiliğinden açılmaz.
 */
export function usePageTour(pageKey: string) {
  const [isTourVisible, setIsTourVisible] = useState(false);
  const [guide] = useState<PageTourGuide | null>(FEATURE_GUIDES[pageKey] || null);

  const openTour = useCallback(() => {
    setIsTourVisible(true);
  }, []);

  const closeTour = useCallback(() => {
    setIsTourVisible(false);
  }, []);

  return {
    isTourVisible,
    guide,
    openTour,
    closeTour,
  };
}
