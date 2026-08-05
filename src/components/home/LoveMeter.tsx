import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, withDelay } from "react-native-reanimated";

interface LoveMeterProps {
  value: number; // 80-100
}

export function LoveMeter({ value }: LoveMeterProps) {
  const widthVal = useSharedValue(0);
  const opacityVal = useSharedValue(0);

  useEffect(() => {
    widthVal.value = withDelay(300, withTiming(value, { duration: 1500, easing: Easing.out(Easing.ease) }));
    opacityVal.value = withDelay(1200, withTiming(1, { duration: 500 }));
  }, [value]);

  const animatedWidthStyle = useAnimatedStyle(() => ({
    width: `${widthVal.value}%`,
  }));

  const animatedTextStyle = useAnimatedStyle(() => ({
    opacity: opacityVal.value,
  }));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Aşk Ölçer</Text>

      <View style={styles.barContainer}>
        <Animated.View style={[styles.barFillContainer, animatedWidthStyle]}>
          <LinearGradient
            colors={["#E8002D", "#D8A030"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientFill}
          >
            <Animated.Text style={[styles.percentageText, animatedTextStyle]}>
              {value}%
            </Animated.Text>
          </LinearGradient>
        </Animated.View>
      </View>

      <Text style={styles.subtitle}>Bugün için ölçüldü 🤝</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#181a20",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 14,
  },
  barContainer: {
    height: 32,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },
  barFillContainer: {
    height: "100%",
    borderRadius: 20,
    overflow: "hidden",
  },
  gradientFill: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 14,
  },
  percentageText: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.9)",
  },
  subtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    marginTop: 10,
  },
});
