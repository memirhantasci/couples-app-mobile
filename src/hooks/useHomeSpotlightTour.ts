import { useCallback, useState } from "react";
import { Keyboard } from "react-native";
import { useFocusEffect } from "expo-router";
import { safeStorage } from "@/lib/safeStorage";

// Cihaz başına tek bayrak: tur bir kez otomatik başladıysa bir daha kendiliğinden açılmaz
// (çıkış yapıp tekrar girmek bayrağı silmez).
const HOME_TOUR_COMPLETED_KEY = "@couples_app_home_tour_completed_v1";
// Eski sayfa bazlı turda Ana Sayfa tanıtımını görmüş kullanıcılar yeni turu otomatik görmez
const LEGACY_HOME_TOUR_KEY = "@couples_app_tour_seen_v1_home";
const AUTO_START_DELAY_MS = 700;

export async function isHomeTourCompleted(): Promise<boolean> {
  try {
    const [current, legacy] = await Promise.all([
      safeStorage.getItem(HOME_TOUR_COMPLETED_KEY),
      safeStorage.getItem(LEGACY_HOME_TOUR_KEY),
    ]);
    return current === "1" || legacy === "1";
  } catch {
    return false;
  }
}

export async function markHomeTourCompleted(): Promise<void> {
  try {
    await safeStorage.setItem(HOME_TOUR_COMPLETED_KEY, "1");
  } catch {}
}

/** Profil / Menü'deki "tanıtımları baştan başlat" için: bir sonraki Ana Sayfa ziyaretinde tur tekrar açılır */
export async function resetHomeTour(): Promise<void> {
  try {
    await Promise.all([
      safeStorage.removeItem(HOME_TOUR_COMPLETED_KEY),
      safeStorage.removeItem(LEGACY_HOME_TOUR_KEY),
    ]);
  } catch {}
}

interface UseHomeSpotlightTourOptions {
  /** Otomatik başlatma koşulları (demo modu değil, veriler hazır, başka modal açık değil) */
  canAutoStart: boolean;
}

export function useHomeSpotlightTour({ canAutoStart }: UseHomeSpotlightTourOptions) {
  const [isVisible, setIsVisible] = useState(false);

  // Otomatik tur: yalnızca Ana Sayfa odaktayken ve bayrak yoksa, tek seferlik
  useFocusEffect(
    useCallback(() => {
      if (!canAutoStart) return;
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      isHomeTourCompleted().then((completed) => {
        if (cancelled || completed) return;
        timer = setTimeout(async () => {
          if (cancelled) return;
          // Bayrak tur başlarken yazılır: tur yarıda kalsa bile bir daha kendiliğinden açılmaz
          await markHomeTourCompleted();
          if (cancelled) return;
          Keyboard.dismiss();
          setIsVisible(true);
        }, AUTO_START_DELAY_MS);
      });

      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    }, [canAutoStart])
  );

  // Sayfadan ayrılınca (ör. bildirime dokunup başka sekmeye geçilince) tur kapanır
  useFocusEffect(useCallback(() => () => setIsVisible(false), []));

  const start = useCallback(() => {
    Keyboard.dismiss();
    setIsVisible(true);
  }, []);

  const close = useCallback(() => setIsVisible(false), []);

  return { isVisible, start, close };
}
