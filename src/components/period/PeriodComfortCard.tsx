import { useCallback, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useFocusEffect } from "expo-router";
import { Coffee } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { smoothstep } from "@/lib/bezier";
import type { AppTheme } from "@/lib/theme";

// Skia yalnızca native modül mevcutsa yüklenir (Expo Go vb. ortamlarda çökmesin);
// yoksa kart buhar çizgileri olmadan, nefes alan kupayla gösterilir.
let SkiaLib: typeof import("@shopify/react-native-skia") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@shopify/react-native-skia");
  if (mod?.Skia && mod?.Canvas) SkiaLib = mod;
} catch {
  SkiaLib = null;
}

interface PeriodComfortCardProps {
  theme: AppTheme;
}

/** Kupanın bir nefes alışı (ya da verişi). */
const BREATH_MS = 2600;
/** Bir buhar çizgisinin yükselip sönmesi. */
const STEAM_CYCLE_MS = 2400;
const STEAM_COUNT = 3;
const STEAM_RISE = 25;
const MUG = 58;
const STEAM_W = 46;
const STEAM_H = 64;

/** Döngü günlerinde kadın kullanıcıya: sıcak bir kupa ve kendine nazik olma hatırlatması. */
export function PeriodComfortCard({ theme }: PeriodComfortCardProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(0);
  const steam = useSharedValue(0);

  // Yalnızca ekran odaktayken nefes alır ve buhar tüter
  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) return;
      breath.set(withRepeat(withTiming(1, { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) }), -1, true));
      steam.set(0);
      steam.set(withRepeat(withTiming(1, { duration: STEAM_CYCLE_MS, easing: Easing.linear }), -1, false));
      return () => {
        cancelAnimation(breath);
        cancelAnimation(steam);
      };
    }, [reduceMotion, breath, steam])
  );

  const mugStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.06 * breath.get() }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + 0.3 * breath.get(),
    transform: [{ scale: 1 + 0.16 * breath.get() }],
  }));

  const palette = theme.isLight
    ? {
        gradient: ["#FFE9DE", "#FDE3EC"] as const,
        border: "rgba(214, 120, 100, 0.22)",
        mugBg: "rgba(255, 255, 255, 0.75)",
        glow: "#FFC9B0",
        steam: "rgba(170, 110, 90, 0.5)",
        label: "#C2705A",
        text: "#4E3038",
      }
    : {
        gradient: ["rgba(255, 190, 160, 0.20)", "rgba(240, 160, 190, 0.12)"] as const,
        border: "rgba(255, 200, 180, 0.18)",
        mugBg: "rgba(255, 255, 255, 0.08)",
        glow: "#FF9F86",
        steam: "rgba(255, 240, 232, 0.6)",
        label: "#FFB59C",
        text: theme.text,
      };

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: palette.border, ...theme.cardShadow }]}>
      <LinearGradient
        pointerEvents="none"
        colors={palette.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.mugColumn}>
        {SkiaLib ? <Steam progress={steam} color={palette.steam} /> : null}
        <Animated.View style={[styles.glow, { backgroundColor: palette.glow }, glowStyle]} />
        <Animated.View style={[styles.mug, { backgroundColor: palette.mugBg }, mugStyle]}>
          <Coffee size={26} color={palette.label} strokeWidth={2.2} />
        </Animated.View>
      </View>

      <View style={styles.textColumn}>
        <Text style={[styles.label, { color: palette.label }]}>{t("period.comfort.label")}</Text>
        <Text style={[styles.message, { color: palette.text }]}>{t("period.comfort.message")}</Text>
      </View>
    </View>
  );
}

/** Skia: kupadan süzülen, kıvrılarak yükselip sönen şeffaf bitki çayı buharı. */
function Steam({ progress, color }: { progress: SharedValue<number>; color: string }) {
  const Skia = SkiaLib!;
  return (
    <Skia.Canvas style={styles.steamCanvas} pointerEvents="none">
      {Array.from({ length: STEAM_COUNT }, (_, index) => (
        <SteamWisp key={index} index={index} progress={progress} color={color} />
      ))}
    </Skia.Canvas>
  );
}

function SteamWisp({ index, progress, color }: { index: number; progress: SharedValue<number>; color: string }) {
  const Skia = SkiaLib!;
  // Her çizgi kendi yerinde, hafif farklı kıvrımla çizilir; aynı saatten sırayla kalkar
  const path = useMemo(() => {
    const x = STEAM_W / 2 + (index - 1) * 10;
    const sway = index % 2 === 0 ? 5 : -5;
    const bottom = STEAM_H - 4;
    const top = bottom - 28;
    return `M${x} ${bottom} C${x - sway} ${bottom - 9}, ${x + sway} ${bottom - 18}, ${x} ${top + 10} S${x - sway * 0.6} ${top + 3}, ${x + sway * 0.4} ${top}`;
  }, [index]);

  const phase = useDerivedValue(() => (progress.get() + index / STEAM_COUNT) % 1);
  const transform = useDerivedValue(() => [{ translateY: -STEAM_RISE * phase.get() }]);
  const opacity = useDerivedValue(() => {
    const p = phase.get();
    return 0.6 * (1 - p) * smoothstep(0, 0.12, p);
  });

  return (
    <Skia.Group transform={transform} opacity={opacity}>
      <Skia.Path path={path} style="stroke" strokeWidth={2.2} strokeCap="round" color={color}>
        <Skia.BlurMask blur={1.2} style="normal" />
      </Skia.Path>
    </Skia.Group>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 18,
    // Buhar kupanın üstünde yükselir: üstte ona yer bırakılır
    paddingTop: 34,
    paddingBottom: 18,
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },
  mugColumn: {
    width: MUG,
    height: MUG,
    alignItems: "center",
    justifyContent: "center",
  },
  steamCanvas: {
    position: "absolute",
    left: (MUG - STEAM_W) / 2,
    bottom: MUG - 12,
    width: STEAM_W,
    height: STEAM_H,
  },
  glow: {
    position: "absolute",
    width: MUG,
    height: MUG,
    borderRadius: MUG / 2,
  },
  mug: {
    width: MUG,
    height: MUG,
    borderRadius: MUG / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  textColumn: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
  },
  message: {
    fontSize: 14.5,
    lineHeight: 21,
    fontFamily: "Inter_600SemiBold",
  },
});
