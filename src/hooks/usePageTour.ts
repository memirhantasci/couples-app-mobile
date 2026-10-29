import { useState, useCallback, useMemo } from "react";
import { safeStorage } from "@/lib/safeStorage";
import { FEATURE_GUIDE_PAGE_KEYS, getPageGuide, PageTourGuide } from "@/constants/featureGuides";
import { resetHomeTour } from "@/hooks/useHomeSpotlightTour";
import { useTranslation } from "react-i18next";

// Eski sürümde her sayfa ilk ziyarette kendi tanıtımını otomatik açıyordu; bu anahtarlar
// artık yalnızca temizlik için tutuluyor.
const LEGACY_TOUR_STORAGE_PREFIX = "@couples_app_tour_seen_v1_";

/** Tüm tanıtımları sıfırlar: bir sonraki Ana Sayfa ziyaretinde spotlight turu yeniden açılır. */
export async function resetAllPageTours(): Promise<void> {
  try {
    await Promise.all([
      resetHomeTour(),
      ...FEATURE_GUIDE_PAGE_KEYS.map((key) =>
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
  const { t } = useTranslation();
  const [isTourVisible, setIsTourVisible] = useState(false);
  const guide = useMemo<PageTourGuide | null>(() => getPageGuide(pageKey, t), [pageKey, t]);

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
