import React, { useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { shouldReveal } from "@/lib/revealGate";

interface RevealProps {
  children: React.ReactNode;
  /** Kartın ait olduğu ekran: giriş animasyonu her ekran için soğuk açılışta yalnızca bir kez oynar. */
  scope: string;
  /** Sıradaki öğe numarası: her öğe bir öncekinden biraz sonra belirir (en fazla 8 basamak). */
  index?: number;
  style?: StyleProp<ViewStyle>;
}

const STEP_MS = 65;
const MAX_STEPS = 8;
const MAX_ANIMATED = 10;

/**
 * Ekranın kartları ilk kez çizilirken giriş animasyonu oynasın mı? Karar bileşenin ilk çiziminde bir kez
 * verilir (yeniden çizimde değişmez). Bkz. revealGate.
 */
export function useRevealPlay(scope: string): boolean {
  const reduceMotion = useReducedMotion();
  const [play] = useState(() => shouldReveal(scope));
  return play && !reduceMotion;
}

/**
 * İçeriği hafifçe aşağıdan yukarı süzülerek ve solarak gösterir; kartlar bir ekran soğuk açılışta ilk kez
 * çizilirken kademeli belirir. Aynı ekranda sonradan çizilen kartlar (sekme / filtre geçişi, yenileme,
 * kaydırma) animasyonsuz gelir. "Hareketi azalt" ayarı açıkken de animasyonsuz çizilir.
 */
export function Reveal({ children, scope, index = 0, style }: RevealProps) {
  const play = useRevealPlay(scope);
  // Yalnızca ilk birkaç öğe animasyonlanır; uzun listelerde kaydırma sırasında satır başına iş yapılmaz
  if (!play || index >= MAX_ANIMATED) return <Animated.View style={style}>{children}</Animated.View>;
  return (
    <Animated.View
      style={style}
      entering={FadeInDown.delay(Math.min(index, MAX_STEPS) * STEP_MS).duration(420).springify().damping(18)}
    >
      {children}
    </Animated.View>
  );
}
