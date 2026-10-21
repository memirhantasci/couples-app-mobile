import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Sparkles } from "lucide-react-native";

interface AnniversaryGlowProps {
  /** Yıldönümüne ≤3 gün kala ya da 14 Şubat'ta true */
  active: boolean;
  /** Sarılan kartın köşe yarıçapı */
  radius: number;
  isLight: boolean;
  children: React.ReactNode;
}

// Koyu zeminde parlak altın, açık zeminde okunur kalması için biraz koyu bal rengi
const GOLD_DARK = "255, 205, 90";
const GOLD_LIGHT = "224, 161, 0";

/**
 * Aşk sayacı kartını sararak yıldönümüne yaklaşırken (ve 14 Şubat'ta) etrafında hafif,
 * "nefes alan" bir altın ışıltı, kartın üzerinde ara ara süzülen bir parıltı ve köşelerde
 * göz kırpan yıldızlar gösterir. Sarmalayıcı her zaman render edilir: `active` değişse de
 * çocuk (kart) yeniden mount olmaz, böylece ölçüm ref'leri (spotlight turu) bozulmaz.
 */
export function AnniversaryGlow({ active, radius, isLight, children }: AnniversaryGlowProps) {
  const gold = isLight ? GOLD_LIGHT : GOLD_DARK;
  return (
    <View>
      {active ? <GlowHalo radius={radius} gold={gold} isLight={isLight} /> : null}
      {children}
      {active ? <GlowSheen radius={radius} gold={gold} isLight={isLight} /> : null}
    </View>
  );
}

/** Kartın ARKASINDA kalan, dışa taşan halka katmanları (kart opak olduğu için yalnızca kenar boşluğunda görünür). */
function GlowHalo({ radius, gold, isLight }: { radius: number; gold: string; isLight: boolean }) {
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(reduceMotion ? 0.6 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    breath.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(breath);
  }, [reduceMotion, breath]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + 0.5 * breath.get(),
    transform: [{ scale: 1 + 0.012 * breath.get() }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.layer, animatedStyle]}>
      <View style={[styles.ring, ringBox(10, radius), { borderWidth: 8, borderColor: `rgba(${gold}, ${isLight ? 0.05 : 0.07})` }]} />
      <View style={[styles.ring, ringBox(5, radius), { borderWidth: 5, borderColor: `rgba(${gold}, ${isLight ? 0.12 : 0.16})` }]} />
      <View
        style={[
          styles.ring,
          ringBox(2, radius),
          {
            borderWidth: 1.5,
            borderColor: `rgba(${gold}, ${isLight ? 0.55 : 0.95})`,
            shadowColor: `rgb(${gold})`,
            shadowOpacity: isLight ? 0.28 : 0.75,
            shadowRadius: isLight ? 7 : 14,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      />
    </Animated.View>
  );
}

// UI iş parçacığında çalışır (useAnimatedStyle içinden çağrılır) → 'worklet' şart
function sparkleAnimatedStyle(value: SharedValue<number>) {
  "worklet";
  const v = value.get();
  return {
    opacity: v,
    transform: [{ scale: 0.5 + 0.7 * v }, { rotate: `${v * 40}deg` }],
  };
}

function ringBox(inset: number, radius: number) {
  return {
    top: -inset,
    left: -inset,
    right: -inset,
    bottom: -inset,
    borderRadius: radius + inset,
  };
}

/** Kartın ÜZERİNDE: ara ara geçen ışık süzmesi + köşelerde göz kırpan yıldızlar. */
function GlowSheen({ radius, gold, isLight }: { radius: number; gold: string; isLight: boolean }) {
  const reduceMotion = useReducedMotion();
  const cardWidth = useSharedValue(0);
  const sheen = useSharedValue(0);
  const twinkleA = useSharedValue(reduceMotion ? 0.85 : 0);
  const twinkleB = useSharedValue(reduceMotion ? 0.85 : 0);
  const twinkleC = useSharedValue(reduceMotion ? 0.85 : 0);

  useEffect(() => {
    if (reduceMotion) return;

    // Işık süzmesi: 1.6 sn bekle, 1.4 sn'de karttan geç, başa dön
    sheen.set(
      withRepeat(
        withSequence(
          withDelay(1600, withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.cubic) })),
          withTiming(0, { duration: 1 })
        ),
        -1,
        false
      )
    );

    // Yıldızlar farklı gecikmelerle yanıp söner (nabız hissi vermesin diye eşit olmayan süreler)
    const twinkle = (delay: number, up: number, down: number, rest: number) =>
      withRepeat(
        withSequence(
          withDelay(delay, withTiming(1, { duration: up, easing: Easing.out(Easing.quad) })),
          withTiming(0, { duration: down, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: rest })
        ),
        -1,
        false
      );
    twinkleA.set(twinkle(300, 700, 900, 1100));
    twinkleB.set(twinkle(1200, 800, 700, 1500));
    twinkleC.set(twinkle(2100, 600, 1000, 900));

    return () => {
      cancelAnimation(sheen);
      cancelAnimation(twinkleA);
      cancelAnimation(twinkleB);
      cancelAnimation(twinkleC);
    };
  }, [reduceMotion, sheen, twinkleA, twinkleB, twinkleC]);

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: sheen.get() > 0 ? 1 : 0,
    transform: [
      { translateX: -120 + (cardWidth.get() + 240) * sheen.get() },
      { rotate: "16deg" },
    ],
  }));

  const styleA = useAnimatedStyle(() => sparkleAnimatedStyle(twinkleA));
  const styleB = useAnimatedStyle(() => sparkleAnimatedStyle(twinkleB));
  const styleC = useAnimatedStyle(() => sparkleAnimatedStyle(twinkleC));

  const sparkleColor = `rgb(${gold})`;

  return (
    <>
      {/* Kartın köşelerine uyan kırpma: süzme kart dışına taşmaz */}
      <View
        pointerEvents="none"
        style={[styles.layer, styles.front, { borderRadius: radius, overflow: "hidden" }]}
        onLayout={(event) => cardWidth.set(event.nativeEvent.layout.width)}
      >
        {!reduceMotion && (
          <Animated.View style={[styles.sheen, sheenStyle]}>
            <LinearGradient
              colors={isLight
                ? [`rgba(${gold}, 0)`, `rgba(${gold}, 0.16)`, `rgba(${gold}, 0)`]
                : ["rgba(255,255,255,0)", `rgba(${gold}, 0.26)`, "rgba(255,255,255,0)"]
              }
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}
      </View>

      <Animated.View pointerEvents="none" style={[styles.sparkle, styles.front, { top: -7, right: 24 }, styleA]}>
        <Sparkles size={15} color={sparkleColor} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.sparkle, styles.front, { bottom: -7, left: 30 }, styleB]}>
        <Sparkles size={12} color={sparkleColor} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.sparkle, styles.front, { top: "42%", left: -6 }, styleC]}>
        <Sparkles size={11} color={sparkleColor} />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  ring: {
    position: "absolute",
  },
  // Android'de elevation z-sırasını belirler: kart (elevation 3) üzerinde kalsınlar
  front: {
    elevation: 5,
    zIndex: 5,
  },
  sheen: {
    position: "absolute",
    top: -40,
    bottom: -40,
    left: 0,
    width: 70,
  },
  sparkle: {
    position: "absolute",
  },
});
