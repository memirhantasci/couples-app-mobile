import React, { useEffect, memo } from "react";
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
  value?: number | null; // 0-100
  theme: AppTheme;
  subtitle?: string;
  isLoading?: boolean;
}

export const LoveMeter = memo(function LoveMeter({ value, theme, subtitle, isLoading }: LoveMeterProps) {
  const hasValue = value !== undefined && value !== null;
  const widthVal = useSharedValue(hasValue ? (value as number) : 0);

  useEffect(() => {
    if (hasValue) {
      widthVal.value = withDelay(
        150,
        withTiming(value as number, { duration: 1000, easing: Easing.out(Easing.cubic) })
      );
    }
  }, [value, hasValue]);

  const animatedWidthStyle = useAnimatedStyle(() => ({
    width: `${widthVal.value}%` as any,
  }));

  const displaySubtitle = subtitle ?? "Bugün için ölçüldü 💝 · Harika bir uyum!";

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
      {/* Başlık + yüzde */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text }]}>Aşk Ölçer</Text>
        {isLoading && !hasValue ? (
          <Text style={[styles.percentLabel, { color: theme.accent, opacity: 0.5 }]}>--%</Text>
        ) : (
          <Text style={[styles.percentLabel, { color: theme.accent }]}>{hasValue ? value : 0}%</Text>
        )}
      </View>

      {/* Progress Bar */}
      <View style={[styles.track, { backgroundColor: theme.isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)" }]}>
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
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>
        {isLoading && !hasValue ? "Aşk skoru hesaplanıyor..." : displaySubtitle}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    marginBottom: 4,
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
  },
  percentLabel: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
  },
  track: {
    height: 8,
    borderRadius: 10,
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
  },
});
