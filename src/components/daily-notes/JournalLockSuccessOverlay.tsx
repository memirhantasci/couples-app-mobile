import { memo, useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  AccessibilityInfo,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
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
import Svg, { Circle, Defs, Ellipse, LinearGradient as SvgGradient, Path, Rect, Stop } from "react-native-svg";
import { Heart } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import { playStampDrop } from "@/lib/soundEffects";

interface JournalLockSuccessOverlayProps {
  /** true olunca kilit töreni baştan oynar; false olunca katman kalkar ve sayfa düzleşir. */
  active: boolean;
  /** Tören bittiğinde tam bir kez çağrılır (listeye dönüş burada yapılır). */
  onComplete: () => void;
  /** Törende bükülen sayfa: ekranın içeriği. */
  children: ReactNode;
}

// ─── Zaman Çizelgesi (ms) ───────────────────────────────────────────────────────
// 0     sayfa sağdan sola 3B bir açıyla bükülür
// 350   defterin kapağı sağdan kayarak kapanır
// 700   kapağın ortasında altın asma kilit "çıt" diye yerine oturur
// 720   damga sesi + tek tok titreşim (playStampDrop titreşimi kendisi verir; ayrıca çağrılmaz)
// 800   kilidin çevresine altın yıldız tozu dağılır, alttaki yazı belirir
// 1200  onComplete
const T = {
  bend: 350,
  coverAt: 350,
  cover: 350,
  lockAt: 700,
  clickAt: 720,
  dustAt: 800,
  dust: 400,
  caption: 320,
} as const;
const LOCK_SPRING = { damping: 12, stiffness: 200 } as const;
/** Animasyon geri çağrısı gelmezse (ör. ekran arkaya düştü) akış yine de takılı kalmasın. */
const SAFETY_MS = T.dustAt + T.dust + 1200;

const GOLD = "#F5C563";
const DUST_COUNT = 10;
/** Yıldız tozu her seferinde aynı zarif dağılımla saçılsın: açı, uzaklık, boyut sabit. */
const DUST = Array.from({ length: DUST_COUNT }, (_, i) => {
  const angle = (i / DUST_COUNT) * Math.PI * 2 + (i % 2 ? 0.2 : -0.14);
  const distance = 48 + (i % 3) * 13;
  return { dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance, size: 8 + (i % 3) * 2.5 };
});

const COVER = {
  // Koyu temada deri, açık temada fildişi kapak
  leather: {
    top: "#62402F",
    bottom: "#38211A",
    spine: "#2A1710",
    stitch: "rgba(245,197,99,0.42)",
    strap: "#2E1A12",
    caption: "#F6DFA6",
  },
  ivory: {
    top: "#FBF4E8",
    bottom: "#EAD9BE",
    spine: "#D9C29C",
    stitch: "rgba(150,108,48,0.42)",
    strap: "#C6AA80",
    caption: "#7A5326",
  },
} as const;

/**
 * Günlük sayfası kaydedilince oynayan "sır defteri" töreni: sayfa bükülür, defterin kapağı kapanır,
 * altın kilit kilitlenir. Sayfanın kendisini (children) sarar; törende bükülen katman odur.
 */
export function JournalLockSuccessOverlay({ active, onComplete, children }: JournalLockSuccessOverlayProps) {
  const bend = useSharedValue(0);

  const pageStyle = useAnimatedStyle(() => {
    const b = bend.get();
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${-25 * b}deg` }, { scale: 1 - 0.08 * b }],
    };
  });

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.page, pageStyle]}>{children}</Animated.View>
      {active ? <JournalLockScene bend={bend} onComplete={onComplete} /> : null}
    </View>
  );
}

function JournalLockScene({ bend, onComplete }: { bend: SharedValue<number>; onComplete: () => void }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const palette = theme.isLight ? COVER.ivory : COVER.leather;
  const caption = t("dailyNotes.journalLocked");

  const cover = useSharedValue(0);
  const lockIn = useSharedValue(0);
  const lockScale = useSharedValue(1.4);
  const dust = useSharedValue(0);
  const captionIn = useSharedValue(0);

  // Tören sürerken ekran yeniden çizilse de zaman çizelgesi baştan başlamasın: geri çağrı ref'ten okunur
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  const completedRef = useRef(false);
  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current();
  }, []);

  useEffect(() => {
    const safety = setTimeout(finish, SAFETY_MS);
    AccessibilityInfo.announceForAccessibility(caption);

    if (reduceMotion) {
      // Hareket azaltma: doğrudan son kare (kapak kapalı, kilit yerinde, yazı görünür); süre aynı kalır ki
      // yazı okunabilsin
      bend.set(1);
      cover.set(1);
      lockIn.set(1);
      lockScale.set(1);
      captionIn.set(1);
      dust.set(
        withDelay(
          T.dustAt + T.dust,
          withTiming(1, { duration: 0 }, (done) => {
            "worklet";
            if (done) scheduleOnRN(finish);
          })
        )
      );
      playStampDrop();
      return () => {
        clearTimeout(safety);
        cancelAnimation(dust);
        bend.set(0);
      };
    }

    bend.set(withTiming(1, { duration: T.bend, easing: Easing.inOut(Easing.quad) }));
    cover.set(withDelay(T.coverAt, withTiming(1, { duration: T.cover, easing: Easing.out(Easing.cubic) })));
    lockIn.set(withDelay(T.lockAt, withTiming(1, { duration: 90 })));
    lockScale.set(withDelay(T.lockAt, withSpring(1, LOCK_SPRING)));
    captionIn.set(withDelay(T.dustAt, withTiming(1, { duration: T.caption, easing: Easing.out(Easing.quad) })));
    dust.set(
      withDelay(
        T.dustAt,
        withTiming(1, { duration: T.dust, easing: Easing.out(Easing.quad) }, (done) => {
          "worklet";
          if (done) scheduleOnRN(finish);
        })
      )
    );
    const click = setTimeout(() => playStampDrop(), T.clickAt);

    return () => {
      clearTimeout(safety);
      clearTimeout(click);
      cancelAnimation(bend);
      cancelAnimation(cover);
      cancelAnimation(lockIn);
      cancelAnimation(lockScale);
      cancelAnimation(captionIn);
      cancelAnimation(dust);
      bend.set(0);
    };
  }, [reduceMotion, bend, cover, lockIn, lockScale, captionIn, dust, finish, caption]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: 0.4 * cover.get() }));
  // Kapak ekranın tam dışından gelir (300 px dar ekranda kapağın bir kısmını baştan gösterirdi)
  const coverStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - cover.get()) * Math.max(300, width) }],
  }));
  const lockStyle = useAnimatedStyle(() => ({
    opacity: lockIn.get(),
    transform: [{ scale: lockScale.get() }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.32 * lockIn.get() * (1 - 0.5 * dust.get()),
    transform: [{ scale: 0.8 + 0.5 * dust.get() }],
  }));
  const captionStyle = useAnimatedStyle(() => ({
    opacity: captionIn.get(),
    transform: [{ translateY: (1 - captionIn.get()) * 10 }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />

      <Animated.View
        style={[styles.cover, { top: insets.top + 10, bottom: insets.bottom + 10 }, coverStyle]}
      >
        <LinearGradient
          colors={[palette.top, palette.bottom]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Sırt: koyu şerit ve dikiş */}
        <View style={[styles.spine, { backgroundColor: palette.spine }]}>
          <View style={[styles.spineStitch, { borderColor: palette.stitch }]} />
        </View>
        <View pointerEvents="none" style={[styles.stitchFrame, { borderColor: palette.stitch }]} />
        <CornerCap style={styles.cornerTop} />
        <CornerCap style={styles.cornerBottom} />
        <View style={styles.emboss}>
          <Heart size={24} color={palette.stitch} strokeWidth={1.6} />
        </View>

        {/* Kapağı kilide bağlayan deri kayış */}
        <View pointerEvents="none" style={styles.centerRow}>
          <View style={[styles.strap, { backgroundColor: palette.strap, borderColor: palette.stitch }]} />
        </View>

        <View pointerEvents="none" style={styles.centerStack}>
          {DUST.map((particle, index) => (
            <DustStar key={index} dust={dust} {...particle} />
          ))}
          <Animated.View style={[styles.lockGlow, glowStyle]} />
          <Animated.View style={lockStyle}>
            <GoldPadlock />
          </Animated.View>
        </View>

        <Animated.View style={[styles.captionWrap, captionStyle]}>
          <Text style={[styles.caption, { color: palette.caption }]}>{caption}</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** Kilidin çevresinden dışa savrulan, dönerek sönen minik altın yıldız. */
function DustStar({ dust, dx, dy, size }: { dust: SharedValue<number>; dx: number; dy: number; size: number }) {
  const style = useAnimatedStyle(() => {
    const p = dust.get();
    return {
      opacity: p <= 0 ? 0 : (1 - p) * Math.min(1, p * 6),
      transform: [
        { translateX: dx * p },
        { translateY: dy * p - 10 * p },
        { scale: 0.5 + 0.7 * (1 - p) },
        { rotate: `${90 * p}deg` },
      ],
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

/** Fildişi/deri kapağın dış köşelerindeki altın köşe kapağı. */
const CornerCap = memo(function CornerCap({ style }: { style: StyleProp<ViewStyle> }) {
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30" style={[styles.corner, style]}>
      <Path d="M30 0 V30 L0 0 Z" fill="#B8862B" />
      <Path d="M30 0 V22 L8 0 Z" fill="#E9C063" />
    </Svg>
  );
});

/** Antika altın asma kilit: kemer, gövde, süs çerçevesi ve anahtar deliği. */
const GoldPadlock = memo(function GoldPadlock() {
  return (
    <Svg width={58} height={70} viewBox="0 0 58 70">
      <Defs>
        <SvgGradient id="lockBody" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FCE9A8" />
          <Stop offset="0.5" stopColor="#E4B24C" />
          <Stop offset="1" stopColor="#B07F25" />
        </SvgGradient>
        <SvgGradient id="lockShackle" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#B8862B" />
          <Stop offset="0.5" stopColor="#F6D98A" />
          <Stop offset="1" stopColor="#A87A22" />
        </SvgGradient>
      </Defs>
      <Path
        d="M17 32 V21 C17 8 41 8 41 21 V32"
        fill="none"
        stroke="url(#lockShackle)"
        strokeWidth={6.5}
        strokeLinecap="round"
      />
      <Rect x={6} y={29} width={46} height={38} rx={10} fill="url(#lockBody)" stroke="#8E6420" strokeWidth={1.2} />
      <Rect x={10.5} y={33.5} width={37} height={29} rx={7} fill="none" stroke="#FFF3C4" strokeOpacity={0.55} strokeWidth={1} />
      <Circle cx={29} cy={44} r={4.8} fill="#4A3214" />
      <Path d="M26.4 46 H31.6 L30.5 56 H27.5 Z" fill="#4A3214" />
      <Ellipse cx={16} cy={36} rx={4} ry={2.2} fill="#FFFFFF" opacity={0.55} />
    </Svg>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // Sayfa sırtından (sol kenar) menteşelenmiş gibi bükülür
  page: {
    flex: 1,
    transformOrigin: "left",
  },
  scrim: {
    backgroundColor: "#000000",
  },
  cover: {
    position: "absolute",
    left: 14,
    right: 14,
    borderRadius: 26,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: -6, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 14,
  },
  spine: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 22,
    justifyContent: "center",
  },
  spineStitch: {
    position: "absolute",
    top: 14,
    bottom: 14,
    right: 5,
    borderRightWidth: 1.5,
    borderStyle: "dashed",
  },
  stitchFrame: {
    position: "absolute",
    top: 14,
    bottom: 14,
    left: 34,
    right: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  corner: {
    position: "absolute",
    right: 0,
  },
  cornerTop: {
    top: 0,
  },
  cornerBottom: {
    bottom: 0,
    transform: [{ scaleY: -1 }],
  },
  emboss: {
    position: "absolute",
    top: "22%",
    left: 22,
    right: 0,
    alignItems: "center",
  },
  centerRow: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
  },
  strap: {
    marginLeft: "50%",
    height: 30,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderStyle: "dashed",
  },
  centerStack: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  lockGlow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: GOLD,
  },
  dust: {
    position: "absolute",
  },
  captionWrap: {
    position: "absolute",
    left: 30,
    right: 18,
    bottom: "16%",
    alignItems: "center",
  },
  caption: {
    fontSize: 19,
    lineHeight: 27,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    textAlign: "center",
  },
});
