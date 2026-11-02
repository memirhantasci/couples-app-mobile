import { memo, useEffect, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";

/** Kalan gün hapının ekranda kalma süresi (ms). */
const PILL_VISIBLE_MS = 2600;

/**
 * Kilitli mektup kartındaki antika asma kilit. `shakeKey` her değiştiğinde (karta dokunuldu) sağa sola
 * esneyerek sallanır; 0 iken durur.
 */
export const LockedLetterPadlock = memo(function LockedLetterPadlock({ shakeKey }: { shakeKey: number }) {
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const amber = theme.isLight ? "#B45309" : "#f59e0b";
  const rotation = useSharedValue(0);
  const stretch = useSharedValue(0);

  useEffect(() => {
    if (!shakeKey || reduceMotion) return;
    rotation.set(
      withSequence(
        withTiming(-8, { duration: 60 }),
        withTiming(8, { duration: 80 }),
        withTiming(-4, { duration: 60 }),
        withTiming(0, { duration: 60 })
      )
    );
    stretch.set(withSequence(withTiming(1, { duration: 60 }), withSpring(0, { damping: 8, stiffness: 260 })));
  }, [shakeKey, reduceMotion, rotation, stretch]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [
      { rotateZ: `${rotation.get()}deg` },
      { scaleX: 1 - 0.06 * stretch.get() },
      { scaleY: 1 + 0.08 * stretch.get() },
    ],
  }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.padlockTile, { borderColor: `${amber}40` }]}
    >
      <Animated.View style={[styles.padlockHang, shakeStyle]}>
        <Svg width={14} height={18} viewBox="0 0 14 18">
          <Path d="M3.8 8 V5.6 C3.8 1.4 10.2 1.4 10.2 5.6 V8" fill="none" stroke={amber} strokeWidth={1.8} strokeLinecap="round" />
          <Rect x={1.2} y={7.2} width={11.6} height={9.6} rx={2.6} fill={amber} />
          <Rect x={2.6} y={8.6} width={8.8} height={6.8} rx={1.6} fill="none" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={0.8} />
          <Circle cx={7} cy={11.2} r={1.4} fill="#3B2408" />
          <Path d="M6.3 11.8 H7.7 L7.4 14.4 H6.6 Z" fill="#3B2408" />
        </Svg>
      </Animated.View>
    </View>
  );
});

/**
 * Kilitli karta dokununca altında beliren, hafifçe yanıp sönen "kaç gün kaldı" hapı. `showKey` her
 * değiştiğinde yeniden gösterilir; birkaç saniye sonra kendiliğinden kaybolur.
 */
export function LockedLetterPill({ showKey, daysLeft }: { showKey: number; daysLeft: number }) {
  const [dismissedKey, setDismissedKey] = useState(0);
  const visible = showKey > 0 && showKey !== dismissedKey;

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setDismissedKey(showKey), PILL_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [visible, showKey]);

  if (!visible) return null;
  return <PillBody showKey={showKey} daysLeft={daysLeft} />;
}

function PillBody({ showKey, daysLeft }: { showKey: number; daysLeft: number }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const amber = theme.isLight ? "#B45309" : "#f59e0b";
  const label = t("letters.lockedPillTime", { count: daysLeft });
  const blink = useSharedValue(1);

  // Her dokunuşta iki kez yumuşakça yanıp söner
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(label);
    if (reduceMotion) return;
    blink.set(1);
    blink.set(withRepeat(withSequence(withTiming(0.55, { duration: 420 }), withTiming(1, { duration: 420 })), 2, false));
  }, [showKey, label, reduceMotion, blink]);

  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.get() }));

  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeInDown.duration(220)}
      exiting={FadeOut.duration(220)}
      style={styles.pillWrap}
    >
      <Animated.View
        style={[
          styles.pill,
          { backgroundColor: theme.isLight ? "#FFF7E6" : "#2A2011", borderColor: `${amber}66` },
          blinkStyle,
        ]}
      >
        <Text style={[styles.pillText, { color: amber }]} numberOfLines={2}>
          {label}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  padlockTile: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "rgba(245,158,11,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  // Kemerinden asılıymış gibi üst kısmının çevresinde sallanır
  padlockHang: {
    transformOrigin: "50% 15%",
  },
  pillWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
  },
  pill: {
    maxWidth: "100%",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
});
