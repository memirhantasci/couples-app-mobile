import { useState, useEffect, useCallback } from "react";
import { safeStorage } from "@/lib/safeStorage";
import { FEATURE_GUIDES, PageTourGuide } from "@/constants/featureGuides";

const TOUR_STORAGE_PREFIX = "@couples_app_tour_seen_v1_";

export function getTourStorageKey(pageKey: string) {
  return `${TOUR_STORAGE_PREFIX}${pageKey}`;
}

export async function hasSeenTour(pageKey: string): Promise<boolean> {
  try {
    const val = await safeStorage.getItem(getTourStorageKey(pageKey));
    return val === "1";
  } catch {
    return false;
  }
}

export async function markTourAsSeen(pageKey: string): Promise<void> {
  try {
    await safeStorage.setItem(getTourStorageKey(pageKey), "1");
  } catch {}
}

export async function resetAllPageTours(): Promise<void> {
  try {
    const keys = Object.keys(FEATURE_GUIDES);
    await Promise.all(
      keys.map((key) => safeStorage.removeItem(getTourStorageKey(key)))
    );
  } catch {}
}

export interface UsePageTourOptions {
  autoStart?: boolean;
  delayMs?: number;
}

export function usePageTour(pageKey: string, options: UsePageTourOptions = {}) {
  const { autoStart = true, delayMs = 450 } = options;
  const [isTourVisible, setIsTourVisible] = useState(false);
  const [guide] = useState<PageTourGuide | null>(FEATURE_GUIDES[pageKey] || null);

  useEffect(() => {
    if (!autoStart || !guide) return;

    let isMounted = true;
    let timer: any = null;

    (async () => {
      const seen = await hasSeenTour(pageKey);
      if (!seen && isMounted) {
        timer = setTimeout(() => {
          if (isMounted) {
            setIsTourVisible(true);
          }
        }, delayMs);
      }
    })();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [pageKey, autoStart, guide, delayMs]);

  const openTour = useCallback(() => {
    setIsTourVisible(true);
  }, []);

  const closeTour = useCallback(async () => {
    setIsTourVisible(false);
    await markTourAsSeen(pageKey);
  }, [pageKey]);

  return {
    isTourVisible,
    guide,
    openTour,
    closeTour,
  };
}
