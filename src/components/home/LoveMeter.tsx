import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  withDelay,
} from "react-native-reanimated";
import { AppTheme } from "@/lib/theme";

interface LoveMeterProps {
  value: number; // 0-100
  theme: AppTheme;
  subtitle?: string; // Dinamik mesaj (opsiyonel, verilmezse varsayılan gösterilir)
}

export function LoveMeter({ value, theme, subtitle }: LoveMeterProps) {
  const widthVal = useSharedValue(0);

  useEffect(() => {
    widthVal.value = withDelay(
      300,
      withTiming(value, { duration: 1400, easing: Easing.out(Easing.cubic) })
    );
  }, [value]);

  const animatedWidthStyle = useAnimatedStyle(() => ({
    width: `${widthVal.value}%` as any,
  }));

  const displaySubtitle = subtitle ?? "Bugün için ölçüldü 💝 · Harika bir uyum!";

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
      {/* Başlık + yüzde */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Aşk Ölçer</Text>
        <Text style={[styles.percentLabel, { color: theme.accent }]}>{value}%</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.track}>
        <Animated.View style={[styles.fillWrapper, animatedWidthStyle]}>
          <LinearGradient
            colors={[theme.accent, theme.accentLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.fill}
          />
        </Animated.View>
      </View>

      {/* Alt açıklama — dinamik */}
      <Text style={styles.subtitle}>{displaySubtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 0,
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  percentLabel: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
  },
  track: {
    height: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginBottom: 10,
  },
  fillWrapper: {
    height: "100%",
    borderRadius: 10,
    overflow: "hidden",
  },
  fill: {
    flex: 1,
    borderRadius: 10,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.40)",
  },
});
