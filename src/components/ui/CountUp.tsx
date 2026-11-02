import { useEffect, useRef, useState } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

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
