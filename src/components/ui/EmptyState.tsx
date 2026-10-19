import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { AppTheme } from "@/lib/theme";

interface EmptyStateProps {
  /** Üstte süzülen büyük emoji */
  emoji: string;
  title: string;
  description: string;
  /** Verilirse altında parlayan bir eylem butonu çıkar */
  ctaLabel?: string;
  onPressCta?: () => void;
  theme: AppTheme;
  /** Harita gibi üstte yüzen kartlar için daha sıkı yerleşim */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * İlk kullanımda boş kalan listeler için "kayıt yok" yazısı yerine çifti ilk adıma çağıran,
 * romantik ve yönlendirici boş durum kartı.
 */
export function EmptyState({
  emoji,
  title,
  description,
  ctaLabel,
  onPressCta,
  theme,
  compact = false,
  style,
}: EmptyStateProps) {
  const reduceMotion = useReducedMotion();
  const float = useSharedValue(0);
  const ring = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    float.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );
    ring.set(withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1, false));
    return () => {
      cancelAnimation(float);
      cancelAnimation(ring);
    };
  }, [reduceMotion, float, ring]);

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 * float.get() }, { rotate: `${(float.get() - 0.5) * 6}deg` }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - ring.get()),
    transform: [{ scale: 1 + 0.4 * ring.get() }],
  }));

  const circleSize = compact ? 64 : 88;

  return (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow },
        style,
      ]}
    >
      {/* Dekoratif: ekran okuyucu yalnızca başlığı ve açıklamayı okusun */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.emojiWrap, { width: circleSize, height: circleSize }]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.emojiRing,
            { borderRadius: circleSize / 2, backgroundColor: theme.accent },
            ringStyle,
          ]}
        />
        <View
          style={[
            styles.emojiCircle,
            {
              borderRadius: circleSize / 2,
              backgroundColor: theme.pillAccentBg,
              borderColor: theme.pillAccentBorder,
            },
          ]}
        >
          <Animated.Text style={[compact ? styles.emojiCompact : styles.emoji, emojiStyle]}>
            {emoji}
          </Animated.Text>
        </View>
      </View>

      <Text style={[styles.title, compact && styles.titleCompact, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.description, compact && styles.descriptionCompact, { color: theme.textSecondary }]}>
        {description}
      </Text>

      {ctaLabel && onPressCta ? (
        <GlowButton label={ctaLabel} onPress={onPressCta} color={theme.accent} reduceMotion={reduceMotion} />
      ) : null}
    </View>
  );
}

/** Arkasından halka halka yayılan ışıkla "parlayan" eylem butonu. */
function GlowButton({
  label,
  onPress,
  color,
  reduceMotion,
}: {
  label: string;
  onPress: () => void;
  color: string;
  reduceMotion: boolean;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.set(withRepeat(withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) }), -1, false));
    return () => cancelAnimation(pulse);
  }, [reduceMotion, pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - pulse.get()),
    transform: [{ scaleX: 1 + 0.16 * pulse.get() }, { scaleY: 1 + 0.5 * pulse.get() }],
  }));

  return (
    <View style={styles.ctaWrap}>
      <Animated.View
        pointerEvents="none"
        style={[styles.ctaHalo, { backgroundColor: color }, reduceMotion ? styles.ctaHaloStatic : haloStyle]}
      />
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.cta, { backgroundColor: color, shadowColor: color }]}
      >
        <Text style={styles.ctaText}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
    paddingHorizontal: 26,
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 20,
  },
  cardCompact: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginTop: 0,
  },
  emojiWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emojiRing: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  emojiCircle: {
    flex: 1,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  emoji: {
    fontSize: 40,
  },
  emojiCompact: {
    fontSize: 28,
  },
  title: {
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  titleCompact: {
    fontSize: 16,
    marginBottom: 6,
  },
  description: {
    fontSize: 13.5,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 22,
  },
  descriptionCompact: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 16,
  },
  // İçeriğine göre daralır: halka tam olarak butonun ölçüsünü izler
  ctaWrap: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaHalo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
  },
  ctaHaloStatic: {
    opacity: 0.18,
  },
  cta: {
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
});
