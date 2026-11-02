import { memo, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useFocusEffect } from "expo-router";
import { Heart } from "lucide-react-native";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { useTheme } from "@/context/ThemeContext";
import { smoothstep } from "@/lib/bezier";
import { hapticHeartbeat, playBubblePop } from "@/lib/soundEffects";
import { useTranslation } from "react-i18next";

interface CoupleAvatarRingProps {
  myName?: string | null;
  partnerName?: string | null;
  myAvatarUrl?: string | null;
  partnerAvatarUrl?: string | null;
  /** Partnerin bugünkü ruh hali emojisi (canlı rozet) */
  partnerMoodEmoji?: string | null;
  size?: number;
  /**
   * Canlı kalp atışı ve dokunma etkileşimi (ana sayfa). Kapalıyken halka durağandır ve dokunuşları
   * yakalamaz; böylece bir düğmenin içinde (ör. yıldız sertifikası) kullanılabilir.
   */
  interactive?: boolean;
}

// Kalp ritmi (ms): 180 büyüme (%18), 180 küçülme, 1200 dinlenme
const BEAT_UP_MS = 180;
const BEAT_DOWN_MS = 180;
const BEAT_REST_MS = 1200;
const BEAT_CYCLE_MS = BEAT_UP_MS + BEAT_DOWN_MS + BEAT_REST_MS;
const BEAT_SCALE = 1.18;
/** Atışla doğan hale bu sürede genişleyip söner. */
const HALO_LIFE_MS = 900;
const TAP_HEART_COUNT = 7;
const TAP_BURST_MS = 1000;

/** Ana sayfa: iç içe geçmiş iki zarif daire — [ Sen ] ❤️ [ Sevgilin ] */
export const CoupleAvatarRing = memo(function CoupleAvatarRing({
  myName,
  partnerName,
  myAvatarUrl,
  partnerAvatarUrl,
  partnerMoodEmoji,
  size = 36,
  interactive = false,
}: CoupleAvatarRingProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const heartSize = Math.round(size * 0.5);
  const moodSize = Math.round(size * 0.52);

  // 0→1 arası tekrar eden ritim fazı: kalp ve hale aynı saatten türetilir, hep senkron kalır
  const cycle = useSharedValue(0);
  const hug = useSharedValue(0);
  const burst = useSharedValue(0);

  // Yalnızca ekran odaktayken atar: arka plandaki sekmede UI iş parçacığı boşuna çalışmasın
  useFocusEffect(
    useCallback(() => {
      if (!interactive || reduceMotion) return;
      cycle.set(withRepeat(withTiming(1, { duration: BEAT_CYCLE_MS, easing: Easing.linear }), -1, false));
      return () => {
        cancelAnimation(cycle);
        cycle.set(0);
      };
    }, [interactive, reduceMotion, cycle])
  );

  const handlePress = useCallback(() => {
    hapticHeartbeat();
    playBubblePop();
    // Hareket azaltma: dokunuşun son karesi halkanın kendisidir, yalnızca his ve ses kalır
    if (reduceMotion) return;
    hug.set(
      withSequence(
        withTiming(1, { duration: 170, easing: Easing.out(Easing.back(2)) }),
        withSpring(0, { damping: 9, stiffness: 180 })
      )
    );
    burst.set(0);
    burst.set(withTiming(1, { duration: TAP_BURST_MS, easing: Easing.out(Easing.quad) }));
  }, [reduceMotion, hug, burst]);

  const leftStyle = useAnimatedStyle(() => {
    const h = hug.get();
    return {
      transform: [
        { translateX: size * 0.06 * h },
        { rotate: `${10 * h}deg` },
        { scale: 1 + 0.08 * h },
      ],
    };
  });
  const rightStyle = useAnimatedStyle(() => {
    const h = hug.get();
    return {
      transform: [
        { translateX: -size * 0.06 * h },
        { rotate: `${-10 * h}deg` },
        { scale: 1 + 0.08 * h },
      ],
    };
  });

  const heartStyle = useAnimatedStyle(() => {
    const ms = cycle.get() * BEAT_CYCLE_MS;
    const beat = interpolate(ms, [0, BEAT_UP_MS, BEAT_UP_MS + BEAT_DOWN_MS], [1, BEAT_SCALE, 1], Extrapolation.CLAMP);
    return { transform: [{ scale: beat * (1 + 0.2 * hug.get()) }] };
  });

  const haloStyle = useAnimatedStyle(() => {
    const ms = cycle.get() * BEAT_CYCLE_MS;
    // Ritim durmuşsa (odak dışı, hareket azaltma) hale görünmez
    if (ms <= 0) return { opacity: 0 };
    const p = Math.min(1, ms / HALO_LIFE_MS);
    return { opacity: 0.6 * (1 - p), transform: [{ scale: 1 + 0.4 * p }] };
  });

  const a11yLabel = t("home.couple.a11yLabel", {
    me: myName || t("common.you"),
    partner: partnerName || t("common.partnerFallback"),
  });

  const content = (
    <>
      <Animated.View style={leftStyle}>
        <UserAvatar uri={myAvatarUrl} name={myName} size={size} borderColor={theme.cardBg} borderWidth={2} />
      </Animated.View>

      <View
        style={[
          styles.heartSlot,
          { width: heartSize, height: heartSize, marginHorizontal: -Math.round(heartSize * 0.35) },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            { width: heartSize, height: heartSize, borderRadius: heartSize / 2, backgroundColor: theme.accentLight },
            haloStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.heart,
            {
              width: heartSize,
              height: heartSize,
              borderRadius: heartSize / 2,
              backgroundColor: theme.accent,
              borderColor: theme.cardBg,
            },
            heartStyle,
          ]}
        >
          <Heart size={Math.round(heartSize * 0.55)} color="#FFFFFF" fill="#FFFFFF" />
        </Animated.View>
        {interactive
          ? Array.from({ length: TAP_HEART_COUNT }, (_, index) => (
              <FloatingHeart
                key={index}
                index={index}
                burst={burst}
                heartSize={heartSize}
                rise={size}
                color={index % 2 === 0 ? theme.accent : theme.accentLight}
              />
            ))
          : null}
      </View>

      <Animated.View style={rightStyle}>
        <UserAvatar
          uri={partnerAvatarUrl}
          name={partnerName}
          size={size}
          borderColor={theme.cardBg}
          borderWidth={2}
          badge={
            partnerMoodEmoji ? (
              <View
                style={[
                  styles.mood,
                  {
                    width: moodSize,
                    height: moodSize,
                    borderRadius: moodSize / 2,
                    backgroundColor: theme.cardBg,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <Text style={{ fontSize: Math.round(moodSize * 0.62) }}>{partnerMoodEmoji}</Text>
              </View>
            ) : undefined
          }
        />
      </Animated.View>
    </>
  );

  if (!interactive) {
    return (
      <View style={styles.row} accessibilityLabel={a11yLabel}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={t("home.couple.a11yHint")}
    >
      {content}
    </Pressable>
  );
});

/** Dokununca kalbin olduğu noktadan yukarı süzülüp sönen minik kalp. */
function FloatingHeart({
  index,
  burst,
  heartSize,
  rise,
  color,
}: {
  index: number;
  burst: SharedValue<number>;
  heartSize: number;
  rise: number;
  color: string;
}) {
  const spec = useMemo(() => {
    // Yukarı doğru yelpaze: -50°…+50° arası, kalpler sırayla biraz gecikmeli kalkar
    const spreadDeg = -50 + (100 * index) / (TAP_HEART_COUNT - 1);
    const rad = (spreadDeg * Math.PI) / 180;
    return {
      dx: Math.sin(rad),
      dy: -Math.cos(rad),
      // Kart kenarına (overflow: hidden) ulaşmadan sönsün diye yükseklik halka boyuyla sınırlı
      dist: rise * (0.7 + 0.25 * ((index * 37) % 7) / 6),
      delay: (index % 3) * 0.06,
      sway: index % 2 === 0 ? 1 : -1,
      size: Math.max(7, Math.round(heartSize * (0.42 + 0.12 * (index % 3)))),
    };
  }, [index, heartSize, rise]);

  const style = useAnimatedStyle(() => {
    const b = burst.get();
    const p = Math.min(1, Math.max(0, (b - spec.delay) / (1 - spec.delay)));
    const travel = 1 - Math.pow(1 - p, 2);
    return {
      opacity: b > 0 && b < 1 ? smoothstep(0, 0.1, p) * (1 - smoothstep(0.5, 1, p)) : 0,
      transform: [
        { translateX: spec.dx * spec.dist * 0.6 * travel + spec.sway * 3 * Math.sin(p * Math.PI * 2) },
        { translateY: spec.dy * spec.dist * travel },
        { scale: 0.4 + 0.6 * smoothstep(0, 0.3, p) },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.floatingHeart,
        { left: (heartSize - spec.size) / 2, top: (heartSize - spec.size) / 2 },
        style,
      ]}
    >
      <Heart size={spec.size} color={color} fill={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.9,
  },
  heartSlot: {
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
  },
  heart: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  mood: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  floatingHeart: {
    position: "absolute",
  },
});
