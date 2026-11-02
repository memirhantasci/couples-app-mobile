import { useCallback, useEffect, useMemo, useState, memo } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, type LayoutChangeEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useDerivedValue,
  useReducedMotion,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  cancelAnimation,
  Easing,
  withDelay,
  type SharedValue,
} from "react-native-reanimated";
import { useFocusEffect } from "expo-router";
import { Heart } from "lucide-react-native";
import { AppTheme } from "@/lib/theme";
import { smoothstep } from "@/lib/bezier";
import { playCelebration } from "@/lib/soundEffects";
import { useTranslation } from "react-i18next";

// Skia yalnızca native modül mevcutsa yüklenir (Expo Go vb. ortamlarda çökmesin);
// yoksa çubuk eskisi gibi düz degrade dolguyla çizilir.
let SkiaLib: typeof import("@shopify/react-native-skia") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@shopify/react-native-skia");
  if (mod?.Skia && mod?.Canvas) SkiaLib = mod;
} catch {
  SkiaLib = null;
}

interface LoveMeterProps {
  value?: number | null; // 0-100
  theme: AppTheme;
  subtitle?: string;
  isLoading?: boolean;
}

const TRACK_H = 22;
/** Sıvı yüzeyinin dinlenme seviyesi (tüp yüksekliğine oranla, üstten). */
const LIQUID_LEVEL = 0.3;
/** Akış saati bir turunu bu sürede atar; dalga ve baloncuklar tam sayı kez döner, döngü dikişsizdir. */
const FLOW_CYCLE_MS = 4000;
const WAVE_CYCLES = 2;
const BUBBLE_COUNT = 5;
const TAP_HEART_COUNT = 5;
const TAP_HEART_MS = 1100;

// Yüzde yazısı UI thread'inde güncellenir (TextInput'a animatedProps ile "text" yazılır): sayaç eskiden
// requestAnimationFrame ile her karede React state'i güncelleyip bileşeni saniyede 60 kez yeniden çiziyordu.
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export const LoveMeter = memo(function LoveMeter({ value, theme, subtitle, isLoading }: LoveMeterProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const hasValue = value !== undefined && value !== null;
  // Çubuğun genişliği ve yüzde sayacı aynı değerden okunur: ikisi hep birlikte hareket eder
  const widthVal = useSharedValue(hasValue ? (value as number) : 0);
  const clock = useSharedValue(0);
  const splash = useSharedValue(0);
  const pop = useSharedValue(0);
  const hearts = useSharedValue(0);
  const [trackW, setTrackW] = useState(0);

  useEffect(() => {
    if (hasValue) {
      widthVal.value = withDelay(
        150,
        withTiming(value as number, { duration: 1000, easing: Easing.out(Easing.cubic) })
      );
    } else {
      widthVal.value = 0;
    }
  }, [value, hasValue, widthVal]);

  // Sıvı yalnızca ekran odaktayken akar: arka plandaki sekmede UI iş parçacığı boşuna çalışmasın
  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) return;
      clock.set(0);
      clock.set(withRepeat(withTiming(1, { duration: FLOW_CYCLE_MS, easing: Easing.linear }), -1, false));
      return () => cancelAnimation(clock);
    }, [reduceMotion, clock])
  );

  const handlePress = useCallback(() => {
    // Arp glissandosu + başarı titreşimi
    playCelebration();
    // Hareket azaltma: dokunuşun son karesi çubuğun kendisidir, yalnızca ses ve his kalır
    if (reduceMotion) return;
    // Sıvı kabarır: dalga genliği ve sıklığı tatlı bir sıçrama yapıp yatışır
    splash.set(
      withSequence(
        withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 1100, easing: Easing.out(Easing.cubic) })
      )
    );
    hearts.set(0);
    hearts.set(withTiming(1, { duration: TAP_HEART_MS, easing: Easing.out(Easing.quad) }));
    pop.set(withSequence(withTiming(1, { duration: 90 }), withSpring(0, { damping: 10, stiffness: 120 })));
  }, [reduceMotion, splash, hearts, pop]);

  const percentProps = useAnimatedProps(() => {
    const text = `${Math.round(widthVal.value)}%`;
    return { text, defaultValue: text } as any;
  });

  const percentPopStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.18 * pop.get() }],
  }));

  const animatedWidthStyle = useAnimatedStyle(() => ({
    width: `${widthVal.value}%` as any,
  }));

  const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackW(Math.round(event.nativeEvent.layout.width));
  }, []);

  const displaySubtitle = subtitle ?? t("home.loveMeter.defaultSubtitle");

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={handlePress}
      style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}
    >
      {/* Başlık + yüzde */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text }]}>{t("home.loveMeter.title")}</Text>
        <Animated.View style={[styles.percentBox, percentPopStyle]}>
          {isLoading && !hasValue ? (
            <Text style={[styles.percentLabel, { color: theme.accent, opacity: 0.5 }]}>--%</Text>
          ) : (
            <AnimatedTextInput
              editable={false}
              pointerEvents="none"
              underlineColorAndroid="transparent"
              animatedProps={percentProps}
              defaultValue={`${hasValue ? Math.round(value as number) : 0}%`}
              style={[styles.percentLabel, styles.percentInput, { color: theme.accent }]}
            />
          )}
        </Animated.View>
      </View>

      {/* Enerji tüpü: skor oranında yaşayan sıvı */}
      <View style={styles.trackWrap} onLayout={handleTrackLayout}>
        <View style={[styles.track, { backgroundColor: theme.isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)" }]}>
          {SkiaLib && trackW > 0 ? (
            <LiquidFill
              width={trackW}
              level={widthVal}
              clock={clock}
              splash={splash}
              accent={theme.accent}
              accentLight={theme.accentLight}
              showBubbles={!reduceMotion}
            />
          ) : (
            <Animated.View style={[styles.fillWrapper, animatedWidthStyle]}>
              <LinearGradient
                colors={[theme.accent, theme.accentLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.fill}
              />
            </Animated.View>
          )}
        </View>

        {!reduceMotion && trackW > 0
          ? Array.from({ length: TAP_HEART_COUNT }, (_, index) => (
              <TapHeart
                key={index}
                index={index}
                progress={hearts}
                level={widthVal}
                trackW={trackW}
                color={index % 3 === 0 ? "#F5C563" : index % 2 === 0 ? theme.accent : theme.accentLight}
              />
            ))
          : null}
      </View>

      {/* Alt açıklama — dinamik */}
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>
        {isLoading && !hasValue ? t("home.loveMeter.loading") : displaySubtitle}
      </Text>
    </TouchableOpacity>
  );
});

/** Sıvı yüzeyinin x noktasındaki yüksekliği: iki sinüsün toplamı, sakin ama tekdüze olmayan bir dalga. */
function surfaceY(x: number, clock: number, splash: number): number {
  "worklet";
  const amp = TRACK_H * 0.1 * (1 + 1.8 * splash);
  const k = ((Math.PI * 2) / (TRACK_H * 2.4)) * (1 + 0.45 * splash);
  const phase = clock * Math.PI * 2 * WAVE_CYCLES;
  return (
    TRACK_H * LIQUID_LEVEL +
    Math.sin(x * k + phase) * amp +
    Math.sin(x * k * 0.5 - clock * Math.PI * 2) * amp * 0.35
  );
}

function fillWidth(level: number, width: number): number {
  "worklet";
  return (Math.min(100, Math.max(0, level)) / 100) * width;
}

interface LiquidFillProps {
  width: number;
  level: SharedValue<number>;
  clock: SharedValue<number>;
  splash: SharedValue<number>;
  accent: string;
  accentLight: string;
  showBubbles: boolean;
}

/** Skia: dalgalı yüzeyli, ucunda parıldayan ve içinden baloncuklar yükselen sıvı. */
function LiquidFill({ width, level, clock, splash, accent, accentLight, showBubbles }: LiquidFillProps) {
  const Skia = SkiaLib!;
  const clip = useMemo(
    () => Skia.rrect(Skia.rect(0, 0, width, TRACK_H), TRACK_H / 2, TRACK_H / 2),
    [Skia, width]
  );

  const liquid = Skia.usePathValue((builder) => {
    "worklet";
    const fillW = fillWidth(level.get(), width);
    if (fillW < 1) return;
    const c = clock.get();
    const s = splash.get();
    builder.moveTo(0, TRACK_H);
    for (let x = 0; x < fillW; x += 3) builder.lineTo(x, surfaceY(x, c, s));
    builder.lineTo(fillW, surfaceY(fillW, c, s));
    builder.lineTo(fillW, TRACK_H);
    builder.close();
  });

  // Yüzeydeki ince ışık çizgisi: sıvıya cam gibi parlaklık verir
  const sheen = Skia.usePathValue((builder) => {
    "worklet";
    const fillW = fillWidth(level.get(), width);
    if (fillW < 4) return;
    const c = clock.get();
    const s = splash.get();
    builder.moveTo(2, surfaceY(2, c, s));
    for (let x = 5; x < fillW - 2; x += 3) builder.lineTo(x, surfaceY(x, c, s));
  });

  const gradientEnd = useDerivedValue(() => ({ x: Math.max(1, fillWidth(level.get(), width)), y: 0 }));
  const tip = useDerivedValue(() => {
    const fillW = fillWidth(level.get(), width);
    return { x: Math.max(0, fillW - 2), y: surfaceY(fillW, clock.get(), splash.get()) + 1 };
  });
  const tipOpacity = useDerivedValue(() => (fillWidth(level.get(), width) > 6 ? 0.85 : 0));

  return (
    <Skia.Canvas style={{ width, height: TRACK_H }} pointerEvents="none">
      <Skia.Group clip={clip}>
        <Skia.Path path={liquid}>
          <Skia.LinearGradient start={{ x: 0, y: 0 }} end={gradientEnd} colors={[accent, accentLight]} />
        </Skia.Path>
        <Skia.Path path={sheen} style="stroke" strokeWidth={1.2} strokeCap="round" color="#FFFFFF" opacity={0.45} />
        {showBubbles
          ? Array.from({ length: BUBBLE_COUNT }, (_, index) => (
              <Bubble key={index} index={index} width={width} level={level} clock={clock} splash={splash} />
            ))
          : null}
        <Skia.Circle c={tip} r={3.5} color="#FFFFFF" opacity={tipOpacity}>
          <Skia.BlurMask blur={3} style="normal" />
        </Skia.Circle>
      </Skia.Group>
    </Skia.Canvas>
  );
}

/** Sıvının dibinden yüzeye doğru yükselip sönen yarı saydam baloncuk. */
function Bubble({
  index,
  width,
  level,
  clock,
  splash,
}: {
  index: number;
  width: number;
  level: SharedValue<number>;
  clock: SharedValue<number>;
  splash: SharedValue<number>;
}) {
  const Skia = SkiaLib!;
  const spec = useMemo(
    () => ({
      x: 0.12 + 0.76 * ((index * 0.61) % 1),
      r: 1.1 + (index % 3) * 0.55,
      // Tam sayı hız: saat başa sardığında baloncuk da aynı yerden devam eder
      speed: index % 2 === 0 ? 1 : 2,
      offset: (index * 0.37) % 1,
    }),
    [index]
  );

  const center = useDerivedValue(() => {
    const p = (clock.get() * spec.speed + spec.offset) % 1;
    const top = TRACK_H * LIQUID_LEVEL + 3;
    return {
      x: spec.x * fillWidth(level.get(), width) + Math.sin(p * Math.PI * 2 + index) * 1.5,
      y: TRACK_H - 2 - p * (TRACK_H - 2 - top),
    };
  });
  const opacity = useDerivedValue(() => {
    // Sıvı çok azken baloncuk sığmaz
    if (fillWidth(level.get(), width) < 24) return 0;
    const p = (clock.get() * spec.speed + spec.offset) % 1;
    return (0.45 + 0.35 * splash.get()) * smoothstep(0, 0.15, p) * (1 - smoothstep(0.8, 1, p));
  });

  return <Skia.Circle c={center} r={spec.r} color="#FFFFFF" opacity={opacity} />;
}

/** Dokununca çubuğun ucundan yukarı sıçrayıp sönen minik parlak kalp. */
function TapHeart({
  index,
  progress,
  level,
  trackW,
  color,
}: {
  index: number;
  progress: SharedValue<number>;
  level: SharedValue<number>;
  trackW: number;
  color: string;
}) {
  const spec = useMemo(() => {
    const size = 9 + (index % 3) * 2;
    return {
      size,
      dx: (index - (TAP_HEART_COUNT - 1) / 2) * 9,
      rise: 30 + (index % 3) * 9,
      delay: index * 0.05,
    };
  }, [index]);

  const style = useAnimatedStyle(() => {
    const raw = progress.get();
    const p = Math.min(1, Math.max(0, (raw - spec.delay) / (1 - spec.delay)));
    const travel = 1 - Math.pow(1 - p, 2);
    const endX = fillWidth(level.get(), trackW);
    return {
      opacity: raw > 0 && raw < 1 ? smoothstep(0, 0.1, p) * (1 - smoothstep(0.55, 1, p)) : 0,
      transform: [
        { translateX: Math.min(trackW - spec.size, Math.max(0, endX - spec.size / 2 + spec.dx * travel)) },
        { translateY: -spec.rise * travel },
        { scale: 0.5 + 0.6 * smoothstep(0, 0.3, p) },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.tapHeart, { top: TRACK_H / 2 - spec.size / 2 }, style]}
    >
      <Heart size={spec.size} color={color} fill={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
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
  percentBox: {
    transformOrigin: "right",
  },
  percentLabel: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
  },
  percentInput: {
    padding: 0,
    margin: 0,
    textAlign: "right",
    minWidth: 90,
    includeFontPadding: false,
  },
  trackWrap: {
    marginBottom: 10,
  },
  track: {
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    overflow: "hidden",
  },
  fillWrapper: {
    height: "100%",
    borderRadius: TRACK_H / 2,
    overflow: "hidden",
  },
  fill: {
    flex: 1,
    borderRadius: TRACK_H / 2,
  },
  tapHeart: {
    position: "absolute",
    left: 0,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
