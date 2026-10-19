import React, { useMemo } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { hapticSelection } from "@/lib/soundEffects";

// Bu kadar aşağı çekilip bırakılırsa (ya da bu hızla fırlatılırsa) kapanır
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;
// Sürükleme bu mesafeye geldiğinde zemin tamamen saydamlaşır, içerik en küçük boyuna iner
const FULL_PROGRESS_FRACTION = 0.45;
const MIN_SCALE = 0.78;

const SETTLE_SPRING = { damping: 20, stiffness: 220, mass: 0.9 } as const;

interface SwipeDismissViewProps {
  /** Aşağı kaydırma kabul edilip çıkış animasyonu bitince çağrılır (modalı kapatın). */
  onDismiss: () => void;
  children: React.ReactNode;
  /** Sürükledikçe saydamlaşan zemin rengi (varsayılan: siyah). */
  backdropColor?: string;
  /** Zeminin içine konan ek katman (ör. BlurView); zeminle birlikte solar. */
  backdrop?: React.ReactNode;
}

/**
 * Tam ekran fotoğraf görüntüleyicileri (lightbox) için "aşağı kaydırarak kapat" davranışı.
 * İçerik parmağı izler, sürükledikçe yumuşakça küçülüp köşeleri yuvarlanır ve zemin saydamlaşır,
 * bırakınca eşik aşıldıysa aşağı süzülüp kapanır; aksi halde yay gibi yerine döner.
 *
 * React Native `Modal` içinde kullanılırken Android'de (ve iOS'ta) gesture handler'ın çalışması için
 * kendi `GestureHandlerRootView`'ini taşır: doğrudan Modal'ın çocuğu olarak yerleştirin.
 */
export function SwipeDismissView({
  onDismiss,
  children,
  backdropColor = "#000000",
  backdrop,
}: SwipeDismissViewProps) {
  const { height: screenHeight } = useWindowDimensions();

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  // Eşik aşıldı mı (yalnızca geçişte bir kez hafif titreşim vermek için)
  const armed = useSharedValue(false);

  const progress = useDerivedValue(() =>
    Math.min(1, Math.max(0, translateY.get() / (screenHeight * FULL_PROGRESS_FRACTION)))
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        // Yalnızca aşağı yönlü dikey niyette devreye girer; yatay hareket jesti iptal eder
        .activeOffsetY(14)
        .failOffsetX([-20, 20])
        .onUpdate((event) => {
          "worklet";
          translateY.set(Math.max(0, event.translationY));
          translateX.set(event.translationX * 0.6);

          const pastThreshold = event.translationY > DISMISS_DISTANCE;
          if (pastThreshold !== armed.get()) {
            armed.set(pastThreshold);
            if (pastThreshold) scheduleOnRN(hapticSelection);
          }
        })
        .onEnd((event) => {
          "worklet";
          const shouldDismiss =
            event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY;

          if (shouldDismiss) {
            translateY.set(
              withTiming(screenHeight, { duration: 240, easing: Easing.in(Easing.cubic) }, (done) => {
                "worklet";
                if (done) scheduleOnRN(onDismiss);
              })
            );
          } else {
            armed.set(false);
            translateX.set(withSpring(0, SETTLE_SPRING));
            translateY.set(withSpring(0, SETTLE_SPRING));
          }
        }),
    [translateX, translateY, armed, screenHeight, onDismiss]
  );

  const contentStyle = useAnimatedStyle(() => ({
    borderRadius: 36 * progress.get(),
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
      { scale: 1 - (1 - MIN_SCALE) * progress.get() },
    ],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - progress.get() * 1.6),
  }));

  return (
    <GestureHandlerRootView style={styles.fill}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: backdropColor }, backdropStyle]}
      >
        {backdrop}
      </Animated.View>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.content, contentStyle]}>{children}</Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  // Köşeler küçülürken yuvarlanır; taşan içerik kırpılır
  content: {
    flex: 1,
    overflow: "hidden",
  },
});
