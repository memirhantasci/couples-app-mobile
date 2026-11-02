import { memo, useEffect, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  interpolate,
  Extrapolation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { Heart, Sparkles } from "lucide-react-native";
import { subscribeConfettiRain } from "@/lib/confettiRain";

const CONFETTI_COUNT = 30;
const HEART_COUNT = 10;
const STAR_COUNT = 8;
const MAX_DELAY_MS = 650;
const MAX_FALL_MS = 3300;
const LIFETIME_MS = MAX_DELAY_MS + MAX_FALL_MS + 200;

const CONFETTI_COLORS = ["#F5C563", "#FF85A1", "#D85870", "#FFFFFF", "#C4B5FD", "#FFB38A"];
const HEART_COLORS = ["#FF5C8A", "#FF85A1", "#E11D48"];

type ParticleKind = "confetti" | "heart" | "star";

interface Particle {
  key: number;
  kind: ParticleKind;
  color: string;
  x: number;
  size: number;
  delay: number;
  duration: number;
  sway: number;
  swayFreq: number;
  spin: number;
  flips: number;
}

function makeParticles(width: number): Particle[] {
  const kinds: ParticleKind[] = [
    ...Array<ParticleKind>(CONFETTI_COUNT).fill("confetti"),
    ...Array<ParticleKind>(HEART_COUNT).fill("heart"),
    ...Array<ParticleKind>(STAR_COUNT).fill("star"),
  ];
  return kinds.map((kind, key) => ({
    key,
    kind,
    color:
      kind === "heart"
        ? HEART_COLORS[key % HEART_COLORS.length]
        : kind === "star"
          ? "#F5C563"
          : CONFETTI_COLORS[key % CONFETTI_COLORS.length],
    x: Math.random() * width,
    size: kind === "confetti" ? 7 + Math.random() * 5 : 12 + Math.random() * 8,
    delay: Math.random() * MAX_DELAY_MS,
    duration: 2300 + Math.random() * (MAX_FALL_MS - 2300),
    sway: 14 + Math.random() * 28,
    swayFreq: 1.2 + Math.random() * 1.6,
    spin: (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 540),
    flips: 2 + Math.random() * 4,
  }));
}

const FallingParticle = memo(function FallingParticle({ particle, height }: { particle: Particle; height: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      withDelay(particle.delay, withTiming(1, { duration: particle.duration, easing: Easing.in(Easing.quad) }))
    );
  }, [particle, progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.get();
    const flip = particle.kind === "confetti" ? Math.cos(p * Math.PI * 2 * particle.flips) : 1;
    return {
      opacity: p > 0 ? interpolate(p, [0, 0.05, 0.85, 1], [0, 1, 1, 0], Extrapolation.CLAMP) : 0,
      transform: [
        { translateX: particle.x + Math.sin(p * Math.PI * 2 * particle.swayFreq) * particle.sway },
        { translateY: -40 + (height + 80) * p },
        { rotate: `${particle.spin * p}deg` },
        // Konfeti havada döndükçe kâğıt gibi incelip genişler
        { scaleY: 0.25 + 0.75 * Math.abs(flip) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.particle, style]}>
      {particle.kind === "heart" ? (
        <Heart size={particle.size} color={particle.color} fill={particle.color} />
      ) : particle.kind === "star" ? (
        <Sparkles size={particle.size} color={particle.color} />
      ) : (
        <View
          style={{
            width: particle.size,
            height: particle.size * 0.55,
            borderRadius: 1.5,
            backgroundColor: particle.color,
          }}
        />
      )}
    </Animated.View>
  );
});

/**
 * Kökte bir kez bağlanır. `rainConfetti()` çağrıldığında ekranın tepesinden konfeti, parlak yıldızlar
 * ve minik kalpler yağdırır, birkaç saniye sonra kendini temizler. Dokunuşları engellemez;
 * "hareketi azalt" açıkken yağmur hiç başlamaz (son kare boş ekrandır).
 */
export function ConfettiRainHost() {
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const [burst, setBurst] = useState<{ id: number; particles: Particle[] } | null>(null);

  useEffect(() => {
    if (reduceMotion) return;
    let clearTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeConfettiRain(() => {
      if (clearTimer) clearTimeout(clearTimer);
      setBurst({ id: Date.now(), particles: makeParticles(width) });
      clearTimer = setTimeout(() => setBurst(null), LIFETIME_MS);
    });
    return () => {
      unsubscribe();
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, [reduceMotion, width]);

  if (!burst) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {burst.particles.map((particle) => (
        <FallingParticle key={`${burst.id}-${particle.key}`} particle={particle} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    elevation: 9999,
  },
  particle: {
    position: "absolute",
    left: 0,
    top: 0,
  },
});
