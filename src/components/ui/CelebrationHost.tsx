import { memo, useEffect, useMemo, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { subscribeCelebrate, type CelebrationKind } from "@/lib/celebrate";

const HEARTS = ["❤️", "💗", "💕", "💖", "🩷"];
const SPARKLES = ["✨", "⭐", "💫", "🌟"];
const COUNT = 16;
const LIFETIME_MS = 3400;

interface Particle {
  key: number;
  glyph: string;
  startX: number;
  drift: number;
  size: number;
  delay: number;
  duration: number;
  rise: number;
}

function makeParticles(kind: CelebrationKind, width: number, height: number): Particle[] {
  const glyphs = kind === "sparkles" ? SPARKLES : HEARTS;
  return Array.from({ length: COUNT }, (_, i) => ({
    key: i,
    glyph: glyphs[i % glyphs.length],
    startX: width * (0.18 + Math.random() * 0.64),
    drift: (Math.random() - 0.5) * 120,
    size: 20 + Math.random() * 22,
    delay: Math.random() * 520,
    duration: 1900 + Math.random() * 1000,
    rise: height * (0.35 + Math.random() * 0.3),
  }));
}

const Heart = memo(function Heart({ particle, startY }: { particle: Particle; startY: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      withDelay(
        particle.delay,
        withTiming(1, { duration: particle.duration, easing: Easing.out(Easing.quad) })
      )
    );
  }, [particle, progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: interpolate(p, [0, 0.12, 0.75, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: particle.drift * p },
        { translateY: -particle.rise * p },
        { scale: interpolate(p, [0, 0.25, 1], [0.3, 1.1, 0.85]) },
        { rotate: `${(particle.drift / 120) * 25 * p}deg` },
      ],
    };
  });

  return (
    <Animated.Text
      style={[
        styles.heart,
        { left: particle.startX, top: startY, fontSize: particle.size },
        style,
      ]}
    >
      {particle.glyph}
    </Animated.Text>
  );
});

/**
 * Kökte bir kez bağlanır. `celebrate()` çağrıldığında ekranın altından yukarı süzülen kalpler / parıltılar
 * çizer ve birkaç saniye sonra kendini temizler. Dokunmaları engellemez; "hareketi azalt" açıkken çıkmaz.
 */
export function CelebrationHost() {
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const [burst, setBurst] = useState<{ id: number; kind: CelebrationKind } | null>(null);

  useEffect(() => {
    if (reduceMotion) return;
    let clearTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeCelebrate((kind) => {
      if (clearTimer) clearTimeout(clearTimer);
      setBurst({ id: Date.now(), kind });
      clearTimer = setTimeout(() => setBurst(null), LIFETIME_MS);
    });
    return () => {
      unsubscribe();
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, [reduceMotion]);

  const particles = useMemo(
    () => (burst ? makeParticles(burst.kind, width, height) : []),
    [burst, width, height]
  );

  if (!burst) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {particles.map((particle) => (
        <Heart key={`${burst.id}-${particle.key}`} particle={particle} startY={height * 0.78} />
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
  heart: {
    position: "absolute",
  },
});

