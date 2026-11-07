import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Crown, Sparkles } from "lucide-react-native";

export const PREMIUM_GOLD = ["#F8E3A0", "#E6B94A", "#B98424"] as const;

interface Props {
  eyebrow: string;
  title: string;
  subtitle: string;
  textColor: string;
  subtitleColor: string;
  goldText: string;
  isLight: boolean;
}

/** Yalnızca opacity/transform animasyonu: UI thread'de çalışır, "hareketi azalt" açıkken durur. */
function Ring({ size, delay, reduce, color }: { size: number; delay: number; reduce: boolean; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    p.set(withDelay(delay, withRepeat(withTiming(1, { duration: 3600, easing: Easing.out(Easing.quad) }), -1)));
  }, [reduce, delay, p]);
  const style = useAnimatedStyle(() => ({
    opacity: reduce ? 0.18 : 0.5 * (1 - p.get()),
    transform: [{ scale: reduce ? 1 : 0.62 + p.get() * 0.6 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: color },
        style,
      ]}
    />
  );
}

function Twinkle({ x, y, delay, reduce, color }: { x: number; y: number; delay: number; reduce: boolean; color: string }) {
  const p = useSharedValue(0.25);
  useEffect(() => {
    if (reduce) return;
    p.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
            withTiming(0.2, { duration: 1400, easing: Easing.inOut(Easing.quad) })
          ),
          -1
        )
      )
    );
  }, [reduce, delay, p]);
  const style = useAnimatedStyle(() => ({ opacity: p.get(), transform: [{ scale: 0.6 + p.get() * 0.5 }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left: x, top: y }, style]}>
      <Sparkles size={14} color={color} />
    </Animated.View>
  );
}

export function PaywallHero({ eyebrow, title, subtitle, textColor, subtitleColor, goldText, isLight }: Props) {
  const reduce = useReducedMotion();
  const glow = isLight ? "rgba(185,132,36,0.7)" : "rgba(230,185,74,0.85)";

  return (
    <View style={styles.wrap}>
      <View style={styles.crownStage}>
        <Ring size={190} delay={0} reduce={reduce} color={glow} />
        <Ring size={190} delay={1800} reduce={reduce} color={glow} />
        <Twinkle x={18} y={44} delay={0} reduce={reduce} color={goldText} />
        <Twinkle x={158} y={30} delay={600} reduce={reduce} color={goldText} />
        <Twinkle x={150} y={142} delay={1100} reduce={reduce} color={goldText} />
        <Twinkle x={26} y={136} delay={300} reduce={reduce} color={goldText} />

        <LinearGradient
          colors={PREMIUM_GOLD}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.crownOrb, { shadowColor: "#E6B94A" }]}
        >
          <View style={styles.crownInner}>
            <Crown color="#3A2A06" size={44} strokeWidth={2.2} />
          </View>
        </LinearGradient>
      </View>

      <View style={[styles.eyebrowPill, { borderColor: `${goldText}55`, backgroundColor: `${goldText}14` }]}>
        <Text style={[styles.eyebrowText, { color: goldText }]}>{eyebrow}</Text>
      </View>
      <Text style={[styles.title, { color: textColor }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", marginBottom: 26 },
  crownStage: { width: 190, height: 170, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  crownOrb: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 14,
  },
  crownInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  eyebrowPill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, borderWidth: 1, marginBottom: 12 },
  eyebrowText: { fontSize: 11.5, fontFamily: "Inter_700Bold", letterSpacing: 1.6 },
  title: { fontSize: 34, fontFamily: "Inter_700Bold", letterSpacing: -1.1, textAlign: "center" },
  subtitle: { fontSize: 15.5, lineHeight: 22, textAlign: "center", marginTop: 8, paddingHorizontal: 12, letterSpacing: -0.2 },
});
