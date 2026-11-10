import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/** Açılıp kapanma süresi (ms). Kapanış bitince içerik kaldırılır. */
export const COLLAPSE_DURATION = 220;

/**
 * İçeriği yüksekliğiyle birlikte yumuşakça açar ve kapatır: alttaki içerik kayarak yer açar, sıçramaz.
 * Kapanış bitince içerik ağaçtan kalkar (ekran okuyucu ve dokunma gizli içeriğe ulaşmaz).
 * Yalnızca kullanıcı eylemiyle oynar; ekranın tek seferlik giriş animasyonuyla (Reveal) ilgisi yoktur, listeyi
 * yeniden canlandırmaz. "Hareketi azalt" açıkken anında açılır ve kapanır.
 */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(open);
  const progress = useSharedValue(open ? 1 : 0);
  // İçeriğin doğal yüksekliği: içerik mutlak konumda ölçülür (kap 0 yükseklikteyken de doğru ölçü verir)
  const contentHeight = useSharedValue(0);

  // Açılış hemen çizilir; "hareketi azalt"ta kapanış da beklemez (çizim sırasında ayarlanır, efekt beklenmez)
  if (open && !mounted) setMounted(true);
  if (!open && mounted && reduceMotion) setMounted(false);

  useEffect(() => {
    const target = open ? 1 : 0;
    progress.set(
      reduceMotion ? target : withTiming(target, { duration: COLLAPSE_DURATION, easing: Easing.out(Easing.cubic) })
    );
    if (open || reduceMotion) return;
    // Kapanış animasyonu bitince içerik ağaçtan kalkar
    const timer = setTimeout(() => setMounted(false), COLLAPSE_DURATION);
    return () => clearTimeout(timer);
  }, [open, reduceMotion, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: contentHeight.get() * progress.get(),
    opacity: progress.get(),
  }));

  if (!mounted) return null;
  return (
    <Animated.View style={[styles.clip, animatedStyle]} pointerEvents={open ? "box-none" : "none"}>
      <View style={styles.measure} onLayout={(event) => contentHeight.set(event.nativeEvent.layout.height)}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
  },
  measure: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
});
