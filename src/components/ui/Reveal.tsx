import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";

interface RevealProps {
  children: React.ReactNode;
  /** Sıradaki öğe numarası: her öğe bir öncekinden biraz sonra belirir (en fazla 8 basamak). */
  index?: number;
  style?: StyleProp<ViewStyle>;
}

const STEP_MS = 65;
const MAX_STEPS = 8;
const MAX_ANIMATED = 10;

/**
 * İçeriği hafifçe aşağıdan yukarı süzülerek ve solarak gösterir; liste ve kartlar ekran açılırken
 * kademeli belirir. "Hareketi azalt" ayarı açıkken animasyonsuz çizilir.
 */
export function Reveal({ children, index = 0, style }: RevealProps) {
  const reduceMotion = useReducedMotion();
  // Yalnızca ilk birkaç öğe animasyonlanır; uzun listelerde kaydırma sırasında satır başına iş yapılmaz
  if (reduceMotion || index >= MAX_ANIMATED) return <Animated.View style={style}>{children}</Animated.View>;
  return (
    <Animated.View
      style={style}
      entering={FadeInDown.delay(Math.min(index, MAX_STEPS) * STEP_MS).duration(420).springify().damping(18)}
    >
      {children}
    </Animated.View>
  );
}
