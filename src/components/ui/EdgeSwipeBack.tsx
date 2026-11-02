import React, { useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { hapticSelection } from "@/lib/soundEffects";

// Bu kadar sağa çekilip bırakılırsa (ya da bu hızla fırlatılırsa) geri gidilir
const BACK_DISTANCE = 70;
const BACK_VELOCITY = 600;
// Jestin başlayabileceği sol kenar şeridi: içerikteki yatay kaydırmalarla çakışmasın
const EDGE_WIDTH = 24;

interface EdgeSwipeBackProps {
  onBack: () => void;
  enabled?: boolean;
  children: React.ReactNode;
}

/**
 * iPhone'daki "ekranın sol kenarından sağa kaydırarak geri dön" hareketi. Sekmeli yapıda (Tabs) bu
 * davranışı sistem vermediği için sol kenar şeridine bir kaydırma jesti konur; yalnızca iOS'ta çalışır
 * (Android'de sistem geri hareketi zaten var).
 */
export function EdgeSwipeBack({ onBack, enabled = true, children }: EdgeSwipeBackProps) {
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .hitSlop({ left: 0, width: EDGE_WIDTH })
        // Yatay niyette devreye girer; dikey kaydırma (liste) jesti iptal eder
        .activeOffsetX(12)
        .failOffsetY([-18, 18])
        .onEnd((event) => {
          "worklet";
          if (event.translationX > BACK_DISTANCE || event.velocityX > BACK_VELOCITY) {
            scheduleOnRN(hapticSelection);
            scheduleOnRN(onBack);
          }
        }),
    [enabled, onBack]
  );

  if (Platform.OS !== "ios") return <>{children}</>;

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.fill}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
