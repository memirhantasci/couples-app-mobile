import { useEffect, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import type { AppTheme } from "@/lib/theme";

const GOLD = "#F5C563";
/** Nefes döngüsünün yarım süresi (ms): 0.35 → 0.75 → 0.35 */
const BREATH_MS = 2400;
const REDUCED_GLOW = 0.55;
/** Kaydırmayla akan ışık huzmesinin boyu (px) */
const BEAM_H = 90;
/** Huzme, listenin kaydırıldığı mesafenin bu katı kadar ilerler: kaydırma hızıyla birlikte akar */
const BEAM_SPEED = 0.6;

interface MemoryThreadProps {
  theme: AppTheme;
  /** Listenin dikey kaydırma konumu (UI thread'de güncellenir) */
  scrollY: SharedValue<number>;
  /** Çizginin yatay konumu: tarih dairelerinin merkezi */
  left: number;
}

/**
 * Anılar zaman tünelinin "aşk ipi": donuk zemin çizgisinin üstünde vurgu renginden altına akan degrade,
 * arkasında nefes alan bir ışıltı ve liste kaydırıldıkça yukarıdan aşağı akan bir ışık huzmesi.
 */
export function MemoryThread({ theme, scrollY, left }: MemoryThreadProps) {
  const reduceMotion = useReducedMotion();
  const [height, setHeight] = useState(0);
  const breath = useSharedValue(reduceMotion ? REDUCED_GLOW : 0.35);

  useEffect(() => {
    if (reduceMotion) {
      breath.set(REDUCED_GLOW);
      return;
    }
    breath.set(0.35);
    breath.set(withRepeat(withTiming(0.75, { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(breath);
  }, [reduceMotion, breath]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: breath.get() }));
  const beamStyle = useAnimatedStyle(() => {
    if (height <= 0) return { opacity: 0 };
    const travel = height + BEAM_H;
    const raw = (Math.max(0, scrollY.get()) * BEAM_SPEED) % travel;
    return { opacity: 1, transform: [{ translateY: raw - BEAM_H }] };
  });

  const onLayout = (e: LayoutChangeEvent) => setHeight(Math.round(e.nativeEvent.layout.height));
  const threadColors = [theme.accent, GOLD, theme.accentLight] as const;

  return (
    <View pointerEvents="none" style={[styles.root, { left: left - 5 }]} onLayout={onLayout}>
      {/* Donuk zemin çizgisi */}
      <View style={[styles.base, { backgroundColor: theme.unitBg }]} />
      {/* Nefes alan geniş ışıltı */}
      <Animated.View style={[styles.glow, glowStyle]}>
        <LinearGradient colors={threadColors} style={StyleSheet.absoluteFill} />
      </Animated.View>
      {/* Degrade aşk ipi */}
      <LinearGradient colors={threadColors} style={styles.thread} />
      {/* Kaydırmayla akan ışık huzmesi */}
      <Animated.View style={[styles.beam, beamStyle]}>
        <LinearGradient
          colors={["rgba(255,255,255,0)", "rgba(255,240,200,0.95)", "rgba(255,255,255,0)"]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 12 px genişliğinde kutu; çizgi ortada (left + 5) durur
  root: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 12,
    alignItems: "center",
    overflow: "hidden",
    zIndex: 0,
  },
  base: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
  },
  glow: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 8,
    borderRadius: 4,
    opacity: 0.35,
  },
  thread: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
  },
  beam: {
    position: "absolute",
    top: 0,
    width: 4,
    height: BEAM_H,
    borderRadius: 2,
  },
});

