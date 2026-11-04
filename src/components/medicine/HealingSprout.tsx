import { memo, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import { Sparkles } from "lucide-react-native";
import { useFocusClock } from "@/hooks/useFocusClock";
import { playSuccessChime } from "@/lib/soundEffects";

interface HealingSproutProps {
  /** Bugün alınan doz sayısı. */
  taken: number;
  /** Bugünün toplam doz sayısı (ilaç yoksa 0). */
  total: number;
}

export type SproutStage = "seed" | "sapling" | "bloom";

/** Hiç doz alınmadıysa tohum, bir kısmı alındıysa fidan, hepsi alındıysa çiçek. */
export function sproutStage(taken: number, total: number): SproutStage {
  if (total <= 0 || taken <= 0) return "seed";
  return taken >= total ? "bloom" : "sapling";
}

const SIZE_W = 64;
const SIZE_H = 72;
/** Toprağın ortası: bitki buradan filizlenir ve bu noktanın çevresinde salınır. */
const SOIL_Y = 45;
const STEM_H = 26;
const SWAY_CYCLE_MS = 3200;
/** Çiçek, son dozun hap dönüşü bittikten sonra açar: "dokunuş" ve "başarı" titreşimleri üst üste binmesin. */
const BLOOM_DELAY_MS = 520;

const STEM_GREEN = "#3FAE5A";
const LEAF_GREEN = "#4ADE80";
const LEAF_VEIN = "#BBF7D0";
const SPARKLE_GOLD = "#FACC15";
const SPARKLES = [
  { x: -15, phase: 0.15, size: 9 },
  { x: 0, phase: 0.5, size: 11 },
  { x: 14, phase: 0.8, size: 8 },
] as const;

/**
 * İlaç serisi kartındaki "Şifa Çiçeği": minik bir saksıda, günün dozları alındıkça büyüyüp yaprak açan
 * filiz. Bütün dozlar içilince tepesinde pembe bir çiçek açar, üzerine parıltılar yağar.
 */
export const HealingSprout = memo(function HealingSprout({ taken, total }: HealingSproutProps) {
  const reduceMotion = useReducedMotion();
  const stage = sproutStage(taken, total);
  const progress = total > 0 ? Math.min(1, taken / total) : 0;

  const growth = useSharedValue(progress);
  const bloom = useSharedValue(stage === "bloom" ? 1 : 0);
  const clock = useFocusClock(SWAY_CYCLE_MS, stage !== "seed" && !reduceMotion);

  useEffect(() => {
    growth.set(reduceMotion ? progress : withTiming(progress, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [progress, reduceMotion, growth]);

  // Çiçek yalnızca bir doz günü tamamladığında kutlanır; ekran açılırken veriler yüklenip gün zaten
  // tamam çıkarsa (önceki toplam 0) çiçek sessizce açık gelir
  const previous = useRef({ stage, total });
  useEffect(() => {
    const before = previous.current;
    previous.current = { stage, total };
    if (stage !== "bloom") {
      bloom.set(reduceMotion ? 0 : withTiming(0, { duration: 220 }));
      return;
    }
    if (before.stage === "bloom") return;
    if (before.total === 0) {
      bloom.set(reduceMotion ? 1 : withTiming(1, { duration: 300 }));
      return;
    }
    bloom.set(
      reduceMotion
        ? 1
        : withDelay(BLOOM_DELAY_MS, withSequence(withTiming(0, { duration: 0 }), withSpring(1, { damping: 7, stiffness: 160 })))
    );
    const chime = setTimeout(() => playSuccessChime(), BLOOM_DELAY_MS);
    return () => clearTimeout(chime);
  }, [stage, total, reduceMotion, bloom]);

  const plantStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${3 * Math.sin(2 * Math.PI * clock.get())}deg` }],
  }));
  const stemStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: 0.25 + 0.75 * growth.get() }],
  }));
  const budStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -STEM_H * (0.25 + 0.75 * growth.get()) }],
  }));
  const leftLeafStyle = useLeafStyle(growth);
  const rightLeafStyle = useLeafStyle(growth);
  const flowerStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, bloom.get() * 3),
    transform: [{ translateY: -STEM_H * (0.25 + 0.75 * growth.get()) - 2 }, { scale: bloom.get() }],
  }));

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.root}>
      <FlowerPot />

      <Animated.View style={[styles.plant, plantStyle]}>
        <Animated.View style={[styles.stem, stemStyle]} />
        <Animated.View style={[styles.leafLeft, leftLeafStyle]}>
          <Svg width={15} height={9} viewBox="0 0 15 9">
            <Path d="M15 9 C10 0 3 0 0 2 C3 7 9 10 15 9 Z" fill={LEAF_GREEN} />
            <Path d="M14 8.4 C10 5 6 3.4 2.5 2.6" stroke={LEAF_VEIN} strokeWidth={0.9} fill="none" strokeLinecap="round" />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.leafRight, rightLeafStyle]}>
          <Svg width={15} height={9} viewBox="0 0 15 9">
            <Path d="M0 9 C5 0 12 0 15 2 C12 7 6 10 0 9 Z" fill={LEAF_GREEN} />
            <Path d="M1 8.4 C5 5 9 3.4 12.5 2.6" stroke={LEAF_VEIN} strokeWidth={0.9} fill="none" strokeLinecap="round" />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.bud, budStyle]} />
        <Animated.View style={[styles.flower, flowerStyle]}>
          <Svg width={20} height={20} viewBox="0 0 20 20">
            {[0, 1, 2, 3, 4].map((i) => {
              const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
              return <Circle key={i} cx={10 + Math.cos(a) * 5} cy={10 + Math.sin(a) * 5} r={4.4} fill="#F472B6" />;
            })}
            <Circle cx={10} cy={10} r={3.6} fill="#FDE68A" />
            <Circle cx={9} cy={9} r={1.1} fill="#FFFFFF" opacity={0.8} />
          </Svg>
        </Animated.View>
      </Animated.View>

      {stage === "bloom"
        ? SPARKLES.map((sparkle, index) => <FallingSparkle key={index} clock={clock} bloom={bloom} {...sparkle} />)
        : null}
    </View>
  );
});

/** Yaprak, sapın büyüdükçe yükselen noktasına tutunur ve doz alındıkça açılır. */
function useLeafStyle(growth: SharedValue<number>) {
  return useAnimatedStyle(() => {
    const g = growth.get();
    return {
      transform: [
        { translateY: -STEM_H * (0.25 + 0.75 * g) * 0.55 },
        { scale: interpolate(g, [0, 0.15, 1], [0, 0.6, 1], Extrapolation.CLAMP) },
      ],
    };
  });
}

/** Çiçeğin üzerine süzülerek yağan, inip kaybolan simli parıltı. */
function FallingSparkle({
  clock,
  bloom,
  x,
  phase,
  size,
}: {
  clock: SharedValue<number>;
  bloom: SharedValue<number>;
  x: number;
  phase: number;
  size: number;
}) {
  const style = useAnimatedStyle(() => {
    const p = (clock.get() * 2 + phase) % 1;
    return {
      opacity: Math.sin(Math.PI * p) * Math.min(1, bloom.get()),
      transform: [{ translateY: -6 + 16 * p }, { rotate: `${40 * p}deg` }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.sparkle, { left: SIZE_W / 2 + x - size / 2 }, style]}>
      <Sparkles size={size} color={SPARKLE_GOLD} fill={SPARKLE_GOLD} />
    </Animated.View>
  );
}

/** Gülümseyen minik toprak saksı. */
const FlowerPot = memo(function FlowerPot() {
  return (
    <Svg width={SIZE_W} height={SIZE_H} viewBox={`0 0 ${SIZE_W} ${SIZE_H}`} style={StyleSheet.absoluteFill}>
      <Path d="M16 50 H48 L44.5 69 Q44 71 42 71 H22 Q20 71 19.5 69 Z" fill="#B95A36" />
      <Path d="M21.5 54 L23.2 67" stroke="#D98260" strokeWidth={2} strokeLinecap="round" opacity={0.6} />
      <Rect x={13} y={43} width={38} height={9} rx={2.5} fill="#D07049" />
      <Rect x={15} y={49.4} width={34} height={1.3} rx={0.65} fill="#A84E2E" opacity={0.6} />
      <Ellipse cx={32} cy={SOIL_Y} rx={16} ry={3.2} fill="#5B3A29" />
      <Circle cx={27} cy={59.5} r={1.3} fill="#5B2A16" />
      <Circle cx={37} cy={59.5} r={1.3} fill="#5B2A16" />
      <Path d="M29.5 62.4 Q32 64.4 34.5 62.4" stroke="#5B2A16" strokeWidth={1.1} fill="none" strokeLinecap="round" />
      <Circle cx={24.5} cy={62} r={1.8} fill="#F59E9E" opacity={0.6} />
      <Circle cx={39.5} cy={62} r={1.8} fill="#F59E9E" opacity={0.6} />
    </Svg>
  );
});

const styles = StyleSheet.create({
  root: {
    width: SIZE_W,
    height: SIZE_H,
  },
  // Bitkinin alt kenarı toprağın ortası: salınım bu noktanın çevresinde
  plant: {
    position: "absolute",
    left: 0,
    top: 0,
    width: SIZE_W,
    height: SOIL_Y,
    transformOrigin: "bottom",
  },
  stem: {
    position: "absolute",
    bottom: 0,
    left: SIZE_W / 2 - 1.25,
    width: 2.5,
    height: STEM_H,
    borderRadius: 1.25,
    backgroundColor: STEM_GREEN,
    transformOrigin: "bottom",
  },
  bud: {
    position: "absolute",
    bottom: -3,
    left: SIZE_W / 2 - 3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: LEAF_GREEN,
  },
  leafLeft: {
    position: "absolute",
    bottom: 0,
    left: SIZE_W / 2 - 15,
    transformOrigin: "right bottom",
  },
  leafRight: {
    position: "absolute",
    bottom: 0,
    left: SIZE_W / 2,
    transformOrigin: "left bottom",
  },
  flower: {
    position: "absolute",
    bottom: -10,
    left: SIZE_W / 2 - 10,
  },
  sparkle: {
    position: "absolute",
    top: 0,
  },
});
