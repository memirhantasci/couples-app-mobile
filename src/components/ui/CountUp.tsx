import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, type StyleProp, type TextStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

interface CountUpProps {
  value: number;
  style?: StyleProp<TextStyle>;
  /** Sayma süresi (ms). */
  duration?: number;
}

/** Sayıyı 0'dan (ya da önceki değerden) hedefe yumuşakça sayarak gösterir: günlerimiz sayacı gibi. */
export function CountUp({ value, style, duration = 1100 }: CountUpProps) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);
  const fromRef = useRef(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) return;
    const from = fromRef.current;
    const start = Date.now();
    let frame: ReturnType<typeof requestAnimationFrame>;

    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduceMotion]);

  return <Text style={style}>{reduceMotion ? value : display}</Text>;
}

// Yazı UI iş parçacığında güncellenir (TextInput'a animatedProps ile "text" yazılır): sayarken bileşen
// saniyede 60 kez yeniden çizilmez
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface UICountUpProps {
  value: number;
  style?: StyleProp<TextStyle>;
  /** Sayma süresi (ms). */
  duration?: number;
  /** Saymaya başlamadan önceki bekleme (ms); sahne girişiyle aynı ritimde fırlasın diye. */
  delay?: number;
}

/**
 * Sayıyı her bağlanışta 0'dan hedefe fırlatır; sayaç UI iş parçacığında çalışır. Metin kutusu
 * genişliği ölçemeyebileceği için satırı kaplar ve ortalanır (büyük, ortalanmış rakamlar için).
 */
export function UICountUp({ value, style, duration = 1100, delay = 0 }: UICountUpProps) {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) {
      shown.set(value);
      return;
    }
    shown.set(0);
    shown.set(withDelay(delay, withTiming(value, { duration, easing: Easing.out(Easing.cubic) })));
  }, [value, duration, delay, reduceMotion, shown]);

  const animatedProps = useAnimatedProps(() => {
    const text = `${Math.round(shown.get())}`;
    return { text, defaultValue: text } as object;
  });

  return (
    <AnimatedTextInput
      editable={false}
      pointerEvents="none"
      underlineColorAndroid="transparent"
      animatedProps={animatedProps}
      defaultValue={`${reduceMotion ? value : 0}`}
      style={[style, uiCountUpStyles.input]}
    />
  );
}

const uiCountUpStyles = StyleSheet.create({
  input: {
    alignSelf: "stretch",
    textAlign: "center",
    padding: 0,
    margin: 0,
    includeFontPadding: false,
  },
});
