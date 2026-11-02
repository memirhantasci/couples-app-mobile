import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import {
  Easing,
  cancelAnimation,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

/**
 * Ekran odaktayken 0'dan 1'e doğrusal ilerleyip başa saran saat (UI iş parçacığında). Nefes, salınım,
 * süzülme gibi sürekli hareketler bundan sinüsle türetilir; sekme arkada kalınca saat durur ve UI iş
 * parçacığı boşuna kare çizmez. `enabled` false iken (ör. hareket azaltma) saat 0'da sabit kalır.
 */
export function useFocusClock(cycleMs: number, enabled: boolean): SharedValue<number> {
  const clock = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      clock.set(0);
      if (!enabled) return;
      clock.set(withRepeat(withTiming(1, { duration: cycleMs, easing: Easing.linear }), -1, false));
      return () => cancelAnimation(clock);
    }, [enabled, cycleMs, clock])
  );

  return clock;
}
