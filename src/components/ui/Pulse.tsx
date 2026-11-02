import React, { useEffect } from "react";
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
} from "react-native-reanimated";

interface PulseProps {
  children: React.ReactNode;
  /** Büyüme oranı (1.14 = %14). */
  scale?: number;
  /** Bir atışın toplam süresi (ms). */
  period?: number;
}

/** İçeriğini kalp atışı gibi hafifçe büyütüp küçültür (çift ritmiyle: iki kısa atış, bir dinlenme). */
export function Pulse({ children, scale = 1.16, period = 1500 }: PulseProps) {
  const reduceMotion = useReducedMotion();
  const value = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    const beat = period * 0.16;
    value.set(
      withRepeat(
        withSequence(
          withTiming(scale, { duration: beat, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: beat, easing: Easing.in(Easing.quad) }),
          withTiming(scale * 0.94, { duration: beat, easing: Easing.out(Easing.quad) }),
          withDelay(0, withTiming(1, { duration: beat * 1.4, easing: Easing.in(Easing.quad) })),
          withTiming(1, { duration: period - beat * 4.4 })
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(value);
  }, [reduceMotion, scale, period, value]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: value.get() }] }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
