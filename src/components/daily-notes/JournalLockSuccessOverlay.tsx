import { memo, useCallback, useEffect, useRef } from "react";
import { AccessibilityInfo, Modal, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
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
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import { playStampDrop } from "@/lib/soundEffects";

interface JournalLockSuccessOverlayProps {
  /** true olunca tören baştan oynar; false olunca katman kapanır. */
  visible: boolean;
  /** Tören bittiğinde tam bir kez çağrılır. */
  onComplete: () => void;
  /** Kapanan sayfada silik görünen notun ilk satırları. */
  pageText?: string;
}

// ─── Zaman Çizelgesi (ms, toplam ≈2.25 sn) ──────────────────────────────────────
// 0     arka plan kararır, defter ortada belirir (sayfa yukarı kalkık, kapak açık)
// 280   sayfa hışırdayarak defterin içine kapanır
// 760   ön kapak sağdan sola yumuşakça örtülür
// 1210  64 px altın asma kilit kapağın ortasında yaylanarak kilitlenir; damga sesi + tok titreşim
// 1300  kilidin çevresine altın yıldız tozu dağılır, alttaki yazı belirir
// 2000  sahne söner → onComplete
const T = {
  scrimIn: 280,
  bookIn: 320,
  pageAt: 280,
  page: 450,
  coverAt: 760,
  cover: 450,
  lockAt: 1210,
  clickAt: 1230,
  dustAt: 1300,
  dust: 560,
  captionAt: 1320,
  caption: 360,
  exitAt: 2000,
  exit: 260,
} as const;
const LOCK_SPRING = { damping: 12, stiffness: 200 } as const;
/** Hareket azaltmada son kare (kapalı defter, kilit, yazı) bu kadar ekranda kalır. */
const REDUCED_HOLD_MS = 1700;
/** Animasyon geri çağrısı gelmezse akış yine de takılı kalmasın. */
const SAFETY_MS = T.exitAt + T.exit + 1500;

const BOOK_W = 280;
const BOOK_H = 380;
const LOCK_W = 64;
const LOCK_H = 77;
/** Kalkık sayfanın başlangıç açısı (sırttan, derece). */
const PAGE_LIFT_DEG = -55;
/** Kapak sağdan gelirken taşıdığı hafif menteşe eğimi (derece). */
const COVER_TILT_DEG = -24;
const RULED_LINES = 13;

const GOLD = "#F5C563";
const DUST_COUNT = 12;
/** Yıldız tozu her seferinde aynı zarif dağılımla saçılsın: açı, uzaklık, boyut sabit. */
const DUST = Array.from({ length: DUST_COUNT }, (_, i) => {
  const angle = (i / DUST_COUNT) * Math.PI * 2 + (i % 2 ? 0.2 : -0.14);
  const distance = 62 + (i % 3) * 16;
  return { dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance, size: 9 + (i % 3) * 3 };
});

const COVER = {
  // Koyu temada deri, açık temada fildişi kapak
  leather: {
    top: "#6A4433",
    bottom: "#38211A",
    spine: "#2A1710",
    stitch: "rgba(245,197,99,0.45)",
    strap: "#2E1A12",
  },
  ivory: {
    top: "#FBF4E8",
    bottom: "#E6D2B2",
    spine: "#D3B98F",
    stitch: "rgba(150,108,48,0.45)",
    strap: "#C6AA80",
  },
} as const;
const PAPER = "#FFFDF6";
const INK = "#5B4636";

/**
 * Günlük sayfası kaydedilince oynayan "sır defteri" töreni: tam ekran karartmanın ortasında bir defter,
 * yazılan sayfa içine kapanır, ön kapak örtülür ve altın asma kilit kilitlenir. Hem günlük editöründe hem
 * ana sayfadaki hızlı not kartında aynı tören oynar.
 */
export function JournalLockSuccessOverlay({ visible, ...rest }: JournalLockSuccessOverlayProps) {
  // İçerik yalnızca görünürken kurulur: her tören sıfırdan, temiz durumla başlar
  if (!visible) return null;
  return <JournalLockScene {...rest} />;
}

function JournalLockScene({ onComplete, pageText }: Omit<JournalLockSuccessOverlayProps, "visible">) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const palette = theme.isLight ? COVER.ivory : COVER.leather;
  const caption = t("dailyNotes.journalLocked");

  const scrim = useSharedValue(0);
  const bookIn = useSharedValue(0);
  const page = useSharedValue(0);
  const cover = useSharedValue(0);
  const lockIn = useSharedValue(0);
  const lockScale = useSharedValue(1.5);
  const dust = useSharedValue(0);
  const captionIn = useSharedValue(0);
  const exit = useSharedValue(0);

  // Tören sürerken üst bileşen yeniden çizilse de zaman çizelgesi baştan başlamasın
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
    const onExitDone = (done?: boolean) => {
      "worklet";
      if (done) scheduleOnRN(finish);
    };

    if (reduceMotion) {
      // Hareket azaltma: doğrudan son kare (kapalı defter, kilit yerinde, yazı görünür), kısa bekleme, solma
      scrim.set(1);
      bookIn.set(1);
      page.set(1);
      cover.set(1);
      lockIn.set(1);
      lockScale.set(1);
      captionIn.set(1);
      exit.set(withDelay(REDUCED_HOLD_MS, withTiming(1, { duration: 200 }, onExitDone)));
      playStampDrop();
      return () => {
        clearTimeout(safety);
        cancelAnimation(exit);
      };
    }

    scrim.set(withTiming(1, { duration: T.scrimIn, easing: Easing.out(Easing.quad) }));
    bookIn.set(withTiming(1, { duration: T.bookIn, easing: Easing.out(Easing.cubic) }));
    // Sayfa sırtın çevresinde yatar; hafif bir aşma ile içeri oturur (hışırtı hissi)
    page.set(withDelay(T.pageAt, withTiming(1, { duration: T.page, easing: Easing.out(Easing.back(1.4)) })));
    cover.set(withDelay(T.coverAt, withTiming(1, { duration: T.cover, easing: Easing.out(Easing.cubic) })));
    lockIn.set(withDelay(T.lockAt, withTiming(1, { duration: 110 })));
    lockScale.set(withDelay(T.lockAt, withSpring(1, LOCK_SPRING)));
    dust.set(withDelay(T.dustAt, withTiming(1, { duration: T.dust, easing: Easing.out(Easing.quad) })));
    captionIn.set(withDelay(T.captionAt, withTiming(1, { duration: T.caption, easing: Easing.out(Easing.quad) })));
    exit.set(withDelay(T.exitAt, withTiming(1, { duration: T.exit, easing: Easing.in(Easing.quad) }, onExitDone)));
    // playStampDrop "çıt" sesini ve tek tok titreşimi birlikte verir (ayrıca hapticStamp çağrılmaz)
    const click = setTimeout(() => playStampDrop(), T.clickAt);

    return () => {
      clearTimeout(safety);
      clearTimeout(click);
      [scrim, bookIn, page, cover, lockIn, lockScale, dust, captionIn, exit].forEach(cancelAnimation);
    };
  }, [reduceMotion, scrim, bookIn, page, cover, lockIn, lockScale, dust, captionIn, exit, finish, caption]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.get() * (1 - exit.get()) }));
  const stageStyle = useAnimatedStyle(() => ({
    opacity: bookIn.get() * (1 - exit.get()),
    transform: [{ scale: 0.9 + 0.1 * bookIn.get() - 0.04 * exit.get() }],
  }));
  const pageStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${PAGE_LIFT_DEG * (1 - page.get())}deg` }],
  }));
  // Kalkık sayfanın alttaki sayfalara düşen gölgesi: sayfa yattıkça kaybolur
  const pageShadowStyle = useAnimatedStyle(() => ({ opacity: 0.22 * (1 - page.get()) }));
  const coverStyle = useAnimatedStyle(() => {
    const c = cover.get();
    return {
      opacity: Math.min(1, c * 5),
      transform: [
        { perspective: 900 },
        { translateX: (1 - c) * BOOK_W * 0.95 },
        { rotateY: `${COVER_TILT_DEG * (1 - c)}deg` },
      ],
    };
  });
  const lockStyle = useAnimatedStyle(() => ({
    opacity: lockIn.get(),
    transform: [{ scale: lockScale.get() }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * lockIn.get() * (1 - 0.6 * dust.get()),
    transform: [{ scale: 0.8 + 0.6 * dust.get() }],
  }));
  const captionStyle = useAnimatedStyle(() => ({
    opacity: captionIn.get() * (1 - exit.get()),
    transform: [{ translateY: (1 - captionIn.get()) * 12 }],
  }));

  const excerpt = pageText?.trim() ?? "";

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      // Tören 2 sn sürer; geri tuşu onu yarıda kesip kaydı belirsiz bırakmasın
      onRequestClose={() => {}}
    >
      <View style={styles.root} accessibilityViewIsModal>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />

        <Animated.View style={[styles.stage, stageStyle]}>
          {/* Arka kapak ve sayfa bloğu */}
          <View style={[styles.bookFace, styles.backCover, { backgroundColor: palette.bottom }]}>
            <View style={[styles.spine, { backgroundColor: palette.spine }]} />
          </View>
          <View style={styles.pageBlock}>
            <View style={styles.pageEdges} />
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pageShadow, pageShadowStyle]} />
          </View>

          {/* Yazılan sayfa: yukarı kalkık başlar, sırtın çevresinde dönüp içeri yatar */}
          <Animated.View style={[styles.pageBlock, styles.topPage, pageStyle]}>
            <View style={[styles.pageMargin, { backgroundColor: `${theme.accent}40` }]} />
            {Array.from({ length: RULED_LINES }, (_, i) => (
              <View key={i} style={[styles.ruledLine, { top: 46 + i * 23 }]} />
            ))}
            {excerpt ? (
              <Text style={styles.pageText} numberOfLines={12}>
                {excerpt}
              </Text>
            ) : null}
          </Animated.View>

          {/* Ön kapak */}
          <Animated.View style={[styles.bookFace, styles.frontCover, coverStyle]}>
            <LinearGradient
              colors={[palette.top, palette.bottom]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.spine, { backgroundColor: palette.spine }]}>
              <View style={[styles.spineStitch, { borderColor: palette.stitch }]} />
            </View>
            <View pointerEvents="none" style={[styles.stitchFrame, { borderColor: palette.stitch }]} />
            <CornerCap style={styles.cornerTop} />
            <CornerCap style={styles.cornerBottom} />
            <View style={styles.emboss}>
              <Heart size={26} color={palette.stitch} strokeWidth={1.6} />
            </View>
            {/* Kapağı kilide bağlayan deri kayış */}
            <View pointerEvents="none" style={styles.centerRow}>
              <View style={[styles.strap, { backgroundColor: palette.strap, borderColor: palette.stitch }]} />
            </View>
          </Animated.View>

          {/* Kilit ve yıldız tozu kapağın üstünde; toz defterin dışına da taşabilsin diye kapakta değil */}
          <View pointerEvents="none" style={styles.centerStack}>
            {DUST.map((particle, index) => (
              <DustStar key={index} dust={dust} {...particle} />
            ))}
            <Animated.View style={[styles.lockGlow, glowStyle]} />
            <Animated.View style={lockStyle}>
              <GoldPadlock />
            </Animated.View>
          </View>
        </Animated.View>

        <Animated.View style={[styles.captionWrap, captionStyle]}>
          <Text style={styles.caption}>{caption}</Text>
        </Animated.View>
      </View>
    </Modal>
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
    <Svg width={LOCK_W} height={LOCK_H} viewBox="0 0 58 70">
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
    alignItems: "center",
    justifyContent: "center",
  },
  scrim: {
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  stage: {
    width: BOOK_W,
    height: BOOK_H,
  },
  bookFace: {
    position: "absolute",
    top: 0,
    left: 0,
    width: BOOK_W,
    height: BOOK_H,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
  },
  backCover: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.4,
    shadowRadius: 22,
    elevation: 12,
  },
  // Kapak sırttan (sol kenar) menteşeli gibi eğilir
  frontCover: {
    overflow: "hidden",
    transformOrigin: "left",
    shadowColor: "#000000",
    shadowOffset: { width: -4, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 16,
  },
  spine: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 20,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  spineStitch: {
    position: "absolute",
    top: 14,
    bottom: 14,
    right: 5,
    borderRightWidth: 1.5,
    borderStyle: "dashed",
  },
  pageBlock: {
    position: "absolute",
    top: 8,
    bottom: 8,
    left: 16,
    right: 6,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    backgroundColor: PAPER,
    overflow: "hidden",
  },
  // Sayfa destesinin sağ kenarındaki ince katman çizgileri
  pageEdges: {
    position: "absolute",
    top: 6,
    bottom: 6,
    right: 2,
    width: 4,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(120,90,60,0.18)",
  },
  pageShadow: {
    backgroundColor: "#000000",
  },
  // Kalkık sayfa sırtın (sol kenarı) çevresinde döner
  topPage: {
    transformOrigin: "left",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(120,90,60,0.15)",
  },
  pageMargin: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 26,
    width: 1,
  },
  ruledLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(120,90,60,0.13)",
  },
  pageText: {
    position: "absolute",
    top: 28,
    left: 34,
    right: 16,
    fontSize: 14,
    lineHeight: 23,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    color: INK,
    opacity: 0.75,
  },
  stitchFrame: {
    position: "absolute",
    top: 14,
    bottom: 14,
    left: 32,
    right: 14,
    borderRadius: 12,
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
    top: 54,
    left: 20,
    right: 0,
    alignItems: "center",
  },
  centerRow: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
  },
  strap: {
    marginLeft: BOOK_W / 2,
    height: 34,
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
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: GOLD,
  },
  dust: {
    position: "absolute",
  },
  captionWrap: {
    marginTop: 28,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  caption: {
    fontSize: 19,
    lineHeight: 27,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    textAlign: "center",
    color: "#FFF4DA",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});
