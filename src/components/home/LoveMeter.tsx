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

const PINK = "#ff4d6d";
const CARD_BG = "#231218";
const BORDER = "rgba(255,255,255,0.07)";

interface LoveMeterProps {
  value: number; // 0-100
}

export function LoveMeter({ value }: LoveMeterProps) {
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

  return (
    <View style={styles.card}>
      {/* Başlık + yüzde */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Aşk Ölçer</Text>
        <Text style={styles.percentLabel}>{value}%</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.track}>
        <Animated.View style={[styles.fillWrapper, animatedWidthStyle]}>
          <LinearGradient
            colors={[PINK, "#ff8fa3"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.fill}
          />
        </Animated.View>
      </View>

      {/* Alt açıklama */}
      <Text style={styles.subtitle}>
        Bugün için ölçüldü 💝 · Harika bir uyum!
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  percentLabel: {
    fontSize: 22,
    fontWeight: "800",
    color: PINK,
  },
  track: {
    height: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
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
    color: "rgba(255,255,255,0.35)",
    fontWeight: "400",
  },
});
