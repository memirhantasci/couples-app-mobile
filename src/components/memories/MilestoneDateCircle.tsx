import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import type { AppTheme } from "@/lib/theme";

const PULSE_MS = 1800;
const SIZE = 32;

interface MilestoneDateCircleProps {
  index: number;
  theme: AppTheme;
  /** Listede yıldönümü en yakın olan anı: altın nabız halesiyle öne çıkar */
  highlight: boolean;
}

/** Zaman tünelindeki sıra numarası dairesi; sıradaki özel günde nefes alan altın bir hale atar. */
export function MilestoneDateCircle({ index, theme, highlight }: MilestoneDateCircleProps) {
  // Açık zeminde altın metin okunmaz: koyu bal rengine çekilir
  const gold = theme.isLight ? "#B7791F" : "#F5C563";
  const ring = theme.isLight ? "#E0A100" : "#F5C563";
  return (
    <View style={styles.wrap}>
      {highlight ? <PulseHalo color={ring} /> : null}
      <View
        style={[
          styles.circle,
          { borderColor: highlight ? ring : theme.accent, backgroundColor: theme.cardBg },
          highlight && styles.circleHighlight,
          highlight && { shadowColor: ring },
        ]}
      >
        <Text style={[styles.number, { color: highlight ? gold : theme.accent }]}>{index + 1}</Text>
      </View>
    </View>
  );
}

function PulseHalo({ color }: { color: string }) {
  const reduceMotion = useReducedMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    p.set(withRepeat(withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) }), -1, false));
    return () => cancelAnimation(p);
  }, [reduceMotion, p]);

  const style = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: 0.35, transform: [{ scale: 1.1 }] }
      : { opacity: 0.8 - 0.6 * p.get(), transform: [{ scale: 1 + 0.14 * p.get() }] }
  );

  return <Animated.View pointerEvents="none" style={[styles.halo, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    marginRight: 20,
    zIndex: 2,
  },
  halo: {
    ...StyleSheet.absoluteFill,
    borderRadius: SIZE / 2,
  },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  circleHighlight: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  number: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});

