import { useCallback, useEffect, useRef } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { AnniversaryGlow } from "@/components/home/AnniversaryGlow";
import { playCelebration } from "@/lib/soundEffects";
import type { AppTheme } from "@/lib/theme";

const GOLD = "#F5C563";
const GOLD_DEEP = "#C9962E";
const CARD_RADIUS = 28;

// ─── Zaman Çizelgesi (ms) ───
// 0    arka plan kararır, parşömen yukarıdan yaylanarak iner
// 380  altın kurdele ortadaki fiyonktan iki yana çözülür
// 900  fiyonk oturur, yıldız tozu saçılır, yazılar belirir
const T = { scrim: 300, cardAt: 60, ribbonAt: 380, ribbon: 520, knotAt: 820, dustAt: 900, dust: 900, textAt: 950 } as const;

const DUST = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  const distance = 90 + (i % 3) * 22;
  return { dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance * 0.7, size: 8 + (i % 3) * 3 };
});

interface AnniversaryMilestoneModalProps {
  visible: boolean;
  /** Kaçıncı yıldönümü */
  years: number;
  /** Birlikte geçen gün sayısı */
  days: number;
  theme: AppTheme;
  /** Tören kapandıktan sonra çağrılır (görüldü kaydı ve konfeti üst bileşende) */
  onClose: () => void;
}

/** Sevgililik yıldönümü sabahı Anılar ekranını karşılayan altın kurdeleli tören. */
export function AnniversaryMilestoneModal({ visible, ...rest }: AnniversaryMilestoneModalProps) {
  if (!visible) return null;
  return <MilestoneScene {...rest} />;
}

function MilestoneScene({ years, days, theme, onClose }: Omit<AnniversaryMilestoneModalProps, "visible">) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const isLight = theme.isLight;

  const scrim = useSharedValue(0);
  const card = useSharedValue(0);
  const ribbon = useSharedValue(0);
  const knot = useSharedValue(0);
  const dust = useSharedValue(0);
  const text = useSharedValue(0);
  const exit = useSharedValue(0);
  const closingRef = useRef(false);

  useEffect(() => {
    playCelebration();
    if (reduceMotion) {
      [scrim, card, ribbon, knot, text].forEach((v) => v.set(1));
      return;
    }
    scrim.set(withTiming(1, { duration: T.scrim }));
    card.set(withDelay(T.cardAt, withSpring(1, { damping: 14, stiffness: 140 })));
    ribbon.set(withDelay(T.ribbonAt, withTiming(1, { duration: T.ribbon, easing: Easing.out(Easing.cubic) })));
    knot.set(withDelay(T.knotAt, withSpring(1, { damping: 9, stiffness: 220 })));
    dust.set(withDelay(T.dustAt, withTiming(1, { duration: T.dust, easing: Easing.out(Easing.quad) })));
    text.set(withDelay(T.textAt, withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) })));
    return () => [scrim, card, ribbon, knot, dust, text, exit].forEach(cancelAnimation);
  }, [reduceMotion, scrim, card, ribbon, knot, dust, text, exit]);

  const finish = useCallback(() => onClose(), [onClose]);
  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    exit.set(
      withTiming(1, { duration: reduceMotion ? 120 : 260, easing: Easing.in(Easing.quad) }, (done) => {
        "worklet";
        if (done) scheduleOnRN(finish);
      })
    );
  };

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.get() * (1 - exit.get()) }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, card.get() * 1.4) * (1 - exit.get()),
    transform: [{ translateY: (1 - card.get()) * -60 + exit.get() * 20 }, { scale: 0.92 + 0.08 * card.get() }],
  }));
  const leftRibbonStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: ribbon.get() }] }));
  const rightRibbonStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: ribbon.get() }] }));
  const knotStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, knot.get() * 2), transform: [{ scale: knot.get() }] }));
  const textStyle = useAnimatedStyle(() => ({ opacity: text.get(), transform: [{ translateY: (1 - text.get()) * 10 }] }));

  const paper = isLight ? "#FFF9EE" : "#241A16";
  const ink = isLight ? "#4A3214" : "#FFF1D6";
  const inkSoft = isLight ? "#7A5A33" : "rgba(255,241,214,0.8)";

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={handleClose}>
      <View style={styles.root} accessibilityViewIsModal>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />

        <Animated.View style={[styles.stage, cardStyle]}>
          <AnniversaryGlow active radius={CARD_RADIUS} isLight={isLight}>
            <View style={[styles.card, { backgroundColor: paper, borderColor: GOLD }]}>
              {/* Altın kurdele: ortadaki fiyonktan iki yana çözülür */}
              <View style={styles.ribbonRow}>
                <Animated.View style={[styles.ribbonHalf, styles.ribbonLeft, leftRibbonStyle]}>
                  <LinearGradient colors={[GOLD_DEEP, GOLD, "#FFE3A3"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                  <RibbonTail side="left" />
                </Animated.View>
                <Animated.View style={[styles.ribbonHalf, styles.ribbonRight, rightRibbonStyle]}>
                  <LinearGradient colors={["#FFE3A3", GOLD, GOLD_DEEP]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                  <RibbonTail side="right" />
                </Animated.View>
                <Animated.View style={[styles.knot, knotStyle]}>
                  <Bow />
                </Animated.View>
              </View>

              <Animated.View style={[styles.body, textStyle]}>
                <Text style={[styles.title, { color: ink }]}>{t("memories.milestone.title", { years })}</Text>
                <View style={[styles.divider, { backgroundColor: GOLD }]} />
                <Text style={[styles.message, { color: inkSoft }]}>{t("memories.milestone.message", { days })}</Text>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleClose}
                  style={[styles.cta, { backgroundColor: theme.accent }]}
                  accessibilityRole="button"
                >
                  <Text style={styles.ctaText}>{t("memories.milestone.cta")}</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </AnniversaryGlow>

          {/* Fiyonk oturunca saçılan altın yıldız tozu */}
          <View pointerEvents="none" style={styles.dustCenter}>
            {DUST.map((d, i) => (
              <DustStar key={i} dust={dust} {...d} />
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function DustStar({ dust, dx, dy, size }: { dust: SharedValue<number>; dx: number; dy: number; size: number }) {
  const style = useAnimatedStyle(() => {
    const p = dust.get();
    return {
      opacity: p <= 0 ? 0 : (1 - p) * Math.min(1, p * 6),
      transform: [{ translateX: dx * p }, { translateY: dy * p }, { scale: 0.5 + 0.8 * (1 - p) }, { rotate: `${120 * p}deg` }],
    };
  });
  return (
    <Animated.View style={[styles.dust, style]}>
      <Svg width={size} height={size} viewBox="0 0 10 10">
        <Path d="M5 0 L6.2 3.8 L10 5 L6.2 6.2 L5 10 L3.8 6.2 L0 5 L3.8 3.8 Z" fill={GOLD} />
      </Svg>
    </Animated.View>
  );
}

/** Kurdelenin V kesikli ucu (kartın kenarında). */
function RibbonTail({ side }: { side: "left" | "right" }) {
  return (
    <Svg width={14} height={26} viewBox="0 0 14 26" style={[styles.tail, side === "left" ? { left: -1 } : { right: -1 }]}>
      <Path d={side === "left" ? "M0 0 H14 V26 H0 L8 13 Z" : "M0 0 H14 L6 13 L14 26 H0 Z"} fill={GOLD_DEEP} />
    </Svg>
  );
}

/** Ortadaki altın fiyonk. */
function Bow() {
  return (
    <Svg width={58} height={40} viewBox="0 0 58 40">
      <Path d="M29 20 C18 4 4 6 5 20 C4 34 18 36 29 20 Z" fill={GOLD} stroke={GOLD_DEEP} strokeWidth={1.4} />
      <Path d="M29 20 C40 4 54 6 53 20 C54 34 40 36 29 20 Z" fill={GOLD} stroke={GOLD_DEEP} strokeWidth={1.4} />
      <Circle cx={29} cy={20} r={6.5} fill="#FFE3A3" stroke={GOLD_DEEP} strokeWidth={1.4} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  scrim: {
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  stage: {
    width: "100%",
    maxWidth: 360,
  },
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1.5,
    paddingTop: 22,
    paddingBottom: 24,
    overflow: "hidden",
  },
  ribbonRow: {
    height: 40,
    justifyContent: "center",
    marginBottom: 14,
  },
  ribbonHalf: {
    position: "absolute",
    top: 7,
    height: 26,
    width: "50%",
    overflow: "hidden",
  },
  // Sol yarı fiyonktan (sağ kenarı) sola doğru açılır, sağ yarı tersine
  ribbonLeft: {
    left: 0,
    transformOrigin: "right",
  },
  ribbonRight: {
    right: 0,
    transformOrigin: "left",
  },
  tail: {
    position: "absolute",
    top: 0,
  },
  knot: {
    alignSelf: "center",
  },
  body: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 26,
    lineHeight: 34,
    fontFamily: "PlayfairDisplay_700Bold",
    textAlign: "center",
  },
  divider: {
    width: 56,
    height: 2,
    borderRadius: 1,
    marginVertical: 14,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    textAlign: "center",
  },
  cta: {
    marginTop: 22,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 18,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  dustCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 30,
  },
  dust: {
    position: "absolute",
    top: 30,
  },
});

