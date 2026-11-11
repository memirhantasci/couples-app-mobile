import { memo, useCallback, useEffect, useRef } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient as SvgGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { Heart, Sparkles } from "lucide-react-native";
import { useTranslation } from "react-i18next";

export interface SkyCeremonyOverlayProps {
  visible: boolean;
  /** Seçilen tarih ve saat satırı (ör. "14 Şubat 2025 · 22:00") */
  dateLine?: string | null;
  /** Seçilen yer adı (ör. "Kadıköy, İstanbul") */
  placeName?: string | null;
  /** Çiftin isimleri (ör. "Ada & Can") */
  coupleNames?: string | null;
  /** Tören tamamlandığında (veya dokunularak geçildiğinde) çağrılır */
  onComplete: () => void;
}

// ─── Zaman Çizelgesi (ms, toplam ≈ 2.65 sn) ──────────────────────────────────
// 0     Karanlık uzay perdesi açılır, altın çerçeveli gökyüzü kartı yükselir
// 260   Gök kubbe çemberleri ve pusula çizgileri belirir
// 680   Takımyıldızı çizgileri ve yıldızlar gök kubbede parlayarak dizilir
// 1320  Altın astrolab / gökyüzü mührü kartın altına yaylanarak basılır (şok halkası + yıldız tozu)
// 2300  Sahne yumuşakça süzülerek açılır → gerçek poster ekranda hazırdır
const T = {
  scrimIn: 240,
  cardIn: 340,
  domeAt: 240,
  domeDur: 480,
  starsAt: 640,
  starsDur: 560,
  sealAt: 1320,
  dustAt: 1380,
  dustDur: 640,
  exitAt: 2320,
  exitDur: 320,
} as const;

const SAFETY_MS = T.exitAt + T.exitDur + 1500;
const GOLD = "#E8C77B";
const GOLD_BRIGHT = "#FCE9A8";
const ROSE = "#E87A90";

const DUST_COUNT = 14;
const DUST = Array.from({ length: DUST_COUNT }, (_, i) => {
  const angle = (i / DUST_COUNT) * Math.PI * 2 + (i % 2 ? 0.18 : -0.12);
  const distance = 68 + (i % 3) * 22;
  return {
    dx: Math.cos(angle) * distance,
    dy: Math.sin(angle) * distance,
    size: 8 + (i % 3) * 3.5,
    isRose: i % 4 === 0,
  };
});

const CONSTELLATION_STARS = [
  { cx: 56, cy: 52, r: 2.4 },
  { cx: 82, cy: 38, r: 3.0 },
  { cx: 114, cy: 48, r: 2.6 },
  { cx: 134, cy: 76, r: 2.2 },
  { cx: 98, cy: 88, r: 3.4 }, // Merkez çift yıldızı
  { cx: 64, cy: 96, r: 2.3 },
  { cx: 44, cy: 118, r: 2.0 },
  { cx: 124, cy: 122, r: 2.5 },
  { cx: 88, cy: 134, r: 2.1 },
] as const;

const CONSTELLATION_LINES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [1, 4],
  [4, 5],
  [5, 6],
  [4, 7],
  [7, 8],
  [5, 8],
] as const;

/**
 * "Bizim Gecemiz" akışında saat adımından poster önizlemesine geçilirken oynayan,
 * mektup (OrigamiBirdAnimation) ve günlük (JournalLockSuccessOverlay) törenleriyle aynı
 * görsel dilde tam ekran "Gökyüzü Haritası Mühürleme" töreni (sessiz).
 */
export function SkyCeremonyOverlay({ visible, ...rest }: SkyCeremonyOverlayProps) {
  if (!visible) return null;
  return <SkyCeremonyScene {...rest} />;
}

function SkyCeremonyScene({
  dateLine,
  placeName,
  coupleNames,
  onComplete,
}: Omit<SkyCeremonyOverlayProps, "visible">) {
  const { i18n } = useTranslation();
  const isTr = i18n.language?.startsWith("tr") ?? true;
  const reduceMotion = useReducedMotion();

  const scrim = useSharedValue(0);
  const cardIn = useSharedValue(0);
  const dome = useSharedValue(0);
  const stars = useSharedValue(0);
  const ringSpin = useSharedValue(0);
  const seal = useSharedValue(0);
  const shock = useSharedValue(0);
  const stampPress = useSharedValue(0);
  const dust = useSharedValue(0);
  const exit = useSharedValue(0);

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
    const onExitDone = (done?: boolean) => {
      "worklet";
      if (done) scheduleOnRN(finish);
    };

    if (reduceMotion) {
      scrim.set(1);
      cardIn.set(1);
      dome.set(1);
      stars.set(1);
      seal.set(1);
      exit.set(withDelay(900, withTiming(1, { duration: 220 }, onExitDone)));
      return () => {
        clearTimeout(safety);
        cancelAnimation(exit);
      };
    }

    scrim.set(withTiming(1, { duration: T.scrimIn, easing: Easing.out(Easing.quad) }));
    cardIn.set(withSpring(1, { damping: 13, stiffness: 125 }));
    dome.set(withDelay(T.domeAt, withTiming(1, { duration: T.domeDur, easing: Easing.out(Easing.cubic) })));
    ringSpin.set(withTiming(1, { duration: T.exitAt, easing: Easing.out(Easing.quad) }));
    stars.set(withDelay(T.starsAt, withTiming(1, { duration: T.starsDur, easing: Easing.out(Easing.cubic) })));

    // Mühür inişi + kartın hafif çökmesi + şok halkası + yıldız tozu
    seal.set(withDelay(T.sealAt, withSpring(1, { damping: 9, stiffness: 175 })));
    stampPress.set(
      withDelay(
        T.sealAt + 35,
        withSequence(withTiming(1, { duration: 75 }), withTiming(0, { duration: 230 }))
      )
    );
    shock.set(
      withDelay(T.sealAt + 35, withTiming(1, { duration: 540, easing: Easing.out(Easing.cubic) }))
    );
    dust.set(
      withDelay(T.dustAt, withTiming(1, { duration: T.dustDur, easing: Easing.out(Easing.quad) }))
    );

    exit.set(
      withDelay(T.exitAt, withTiming(1, { duration: T.exitDur, easing: Easing.in(Easing.quad) }, onExitDone))
    );

    return () => {
      clearTimeout(safety);
      [scrim, cardIn, dome, stars, ringSpin, seal, shock, stampPress, dust, exit].forEach(cancelAnimation);
    };
  }, [reduceMotion, scrim, cardIn, dome, stars, ringSpin, seal, shock, stampPress, dust, exit, finish]);

  const skip = useCallback(() => {
    cancelAnimation(exit);
    exit.set(
      withTiming(1, { duration: 160 }, (done) => {
        "worklet";
        if (done) scheduleOnRN(finish);
      })
    );
  }, [exit, finish]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrim.get() * (1 - exit.get()),
  }));

  const stageStyle = useAnimatedStyle(() => {
    const c = cardIn.get();
    const s = stampPress.get();
    const e = exit.get();
    return {
      opacity: Math.min(1, c * 1.6) * (1 - e),
      transform: [
        { translateY: (1 - c) * 64 + 4 * s - e * 18 },
        { scale: (0.72 + 0.28 * c) * (1 - 0.03 * s) * (1 + 0.04 * e) },
      ],
    };
  });

  const domeStyle = useAnimatedStyle(() => {
    const d = dome.get();
    return {
      opacity: d,
      transform: [
        { scale: 0.78 + 0.22 * d },
        { rotate: `${-28 * (1 - ringSpin.get())}deg` },
      ],
    };
  });

  const starsStyle = useAnimatedStyle(() => {
    const st = stars.get();
    return {
      opacity: st,
      transform: [{ scale: 0.88 + 0.12 * st }],
    };
  });

  const sealStyle = useAnimatedStyle(() => {
    const s = seal.get();
    return {
      opacity: Math.min(1, s * 2.5),
      transform: [
        { scale: 2.3 - 1.3 * s },
        { rotate: `${-20 + 20 * s}deg` },
      ],
    };
  });

  const shockStyle = useAnimatedStyle(() => {
    const k = shock.get();
    return {
      opacity: k > 0 ? 0.65 * (1 - k) : 0,
      transform: [{ scale: 1 + 2.8 * k }],
    };
  });

  const phase1TextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(seal.get(), [0, 0.35], [1, 0], Extrapolation.CLAMP),
  }));

  const phase2TextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(seal.get(), [0.35, 0.75], [0, 1], Extrapolation.CLAMP),
  }));

  const captionStyle = useAnimatedStyle(() => ({
    opacity: scrim.get() * (1 - exit.get()),
    transform: [{ translateY: (1 - cardIn.get()) * 14 }],
  }));

  const statusDrawing = isTr ? "Yıldızlar hizalanıyor…" : "Aligning the stars…";
  const statusSealed = isTr ? "O gecenin gökyüzü mühürlendi ✨" : "That night's sky is sealed ✨";
  const bottomCaption = isTr
    ? "Seçtiğiniz yer ve saatteki gerçek gök kubbe çiziliyor…"
    : "Drawing the real sky dome for your chosen night and place…";

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={skip}
    >
      <View style={styles.root} accessibilityViewIsModal>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />

        <Animated.View pointerEvents="none" style={[styles.cardContainer, stageStyle]}>
          <View style={styles.posterSheet}>
            {/* Köşe altın işlemeleri */}
            <View style={[styles.cornerOrnament, styles.cornerTL]} />
            <View style={[styles.cornerOrnament, styles.cornerTR]} />
            <View style={[styles.cornerOrnament, styles.cornerBL]} />
            <View style={[styles.cornerOrnament, styles.cornerBR]} />

            {/* Üst Başlık */}
            <View style={styles.posterHeader}>
              <Text style={styles.posterKicker}>
                {isTr ? "O GECENİN GÖKYÜZÜ" : "THE SKY THAT NIGHT"}
              </Text>
              <Text style={styles.posterTitle} numberOfLines={1}>
                {coupleNames || (isTr ? "Bizim Gecemiz" : "Our Night")}
              </Text>
            </View>

            {/* Orta Gök Kubbe ve Takımyıldızları */}
            <View style={styles.domeCenter}>
              <Animated.View style={[styles.domeSvgWrap, domeStyle]}>
                <AstrolabeDomeSvg />
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, styles.domeSvgWrap, starsStyle]}>
                <ConstellationOverlaySvg />
              </Animated.View>
            </View>

            {/* Tarih & Konum Özeti */}
            <View style={styles.metaWrap}>
              {dateLine ? (
                <Text style={styles.metaDate} numberOfLines={1}>
                  {dateLine}
                </Text>
              ) : null}
              {placeName ? (
                <Text style={styles.metaPlace} numberOfLines={1}>
                  {placeName}
                </Text>
              ) : null}
            </View>

            {/* Alt Durum Metni (Mektuptaki "Mühürleniyor... / Mühürlendi" gibi çapraz geçişli) */}
            <View style={styles.posterFooter}>
              <Animated.Text style={[styles.footerStatusText, phase1TextStyle]}>
                {statusDrawing}
              </Animated.Text>
              <Animated.Text style={[styles.footerStatusText, styles.footerStatusOverlay, phase2TextStyle]}>
                {statusSealed}
              </Animated.Text>
            </View>

            {/* Sağ Alt Altın Gökyüzü Mührü + Yıldız Tozu */}
            <View style={styles.sealSpot}>
              {DUST.map((particle, idx) => (
                <DustStar key={idx} dust={dust} {...particle} />
              ))}
              <Animated.View style={[styles.shockRing, shockStyle]} />
              <Animated.View style={[styles.seal, sealStyle]}>
                <View style={styles.sealInner}>
                  <Sparkles size={16} color="#1A132B" />
                </View>
              </Animated.View>
            </View>
          </View>
        </Animated.View>

        <Animated.Text pointerEvents="none" style={[styles.caption, captionStyle]}>
          {bottomCaption}
        </Animated.Text>

        {/* Ekrana dokunarak animasyon hemen geçilebilir */}
        <Pressable style={StyleSheet.absoluteFill} onPress={skip} accessibilityRole="button" />
      </View>
    </Modal>
  );
}

/** Gök kubbe kadranı, meridyen halkaları ve pusula çentikleri */
const AstrolabeDomeSvg = memo(function AstrolabeDomeSvg() {
  return (
    <Svg width={176} height={176} viewBox="0 0 176 176">
      <Defs>
        <SvgGradient id="domeGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#1B2448" />
          <Stop offset="0.6" stopColor="#0D122A" />
          <Stop offset="1" stopColor="#070A18" />
        </SvgGradient>
      </Defs>
      <Circle cx="88" cy="88" r="82" fill="url(#domeGrad)" stroke={GOLD} strokeWidth="1.5" strokeOpacity={0.75} />
      <Circle cx="88" cy="88" r="76" fill="none" stroke={GOLD} strokeWidth="0.7" strokeOpacity={0.35} strokeDasharray="3 3" />
      <Circle cx="88" cy="88" r="54" fill="none" stroke={GOLD} strokeWidth="0.6" strokeOpacity={0.22} />
      <Circle cx="88" cy="88" r="28" fill="none" stroke={GOLD} strokeWidth="0.6" strokeOpacity={0.18} />
      <Line x1="88" y1="8" x2="88" y2="168" stroke={GOLD} strokeWidth="0.5" strokeOpacity={0.18} />
      <Line x1="8" y1="88" x2="168" y2="88" stroke={GOLD} strokeWidth="0.5" strokeOpacity={0.18} />
    </Svg>
  );
});

/** Gök kubbe içinde parlayan takımyıldızı hatları ve merkezdeki çift yıldızı */
const ConstellationOverlaySvg = memo(function ConstellationOverlaySvg() {
  return (
    <Svg width={176} height={176} viewBox="0 0 176 176">
      <G>
        {CONSTELLATION_LINES.map(([a, b], idx) => {
          const p1 = CONSTELLATION_STARS[a];
          const p2 = CONSTELLATION_STARS[b];
          return (
            <Line
              key={idx}
              x1={p1.cx}
              y1={p1.cy}
              x2={p2.cx}
              y2={p2.cy}
              stroke={GOLD}
              strokeWidth="1.1"
              strokeOpacity={0.55}
            />
          );
        })}
        {CONSTELLATION_STARS.map((star, idx) => {
          const isCenter = idx === 4;
          return (
            <G key={idx}>
              {isCenter ? (
                <Circle cx={star.cx} cy={star.cy} r={star.r * 2.8} fill={ROSE} fillOpacity={0.28} />
              ) : null}
              <Circle
                cx={star.cx}
                cy={star.cy}
                r={star.r}
                fill={isCenter ? GOLD_BRIGHT : "#FFFFFF"}
              />
            </G>
          );
        })}
      </G>
    </Svg>
  );
});

/** Mühür basıldığında etrafa saçılan altın/pembe yıldız tozu */
function DustStar({
  dust,
  dx,
  dy,
  size,
  isRose,
}: {
  dust: SharedValue<number>;
  dx: number;
  dy: number;
  size: number;
  isRose: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const p = dust.get();
    return {
      opacity: p <= 0 ? 0 : (1 - p) * Math.min(1, p * 5),
      transform: [
        { translateX: dx * p },
        { translateY: dy * p - 8 * p },
        { scale: 0.5 + 0.65 * (1 - p) },
        { rotate: `${95 * p}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.dust, style]}>
      {isRose ? (
        <Heart size={size} color={ROSE} fill={ROSE} />
      ) : (
        <Svg width={size} height={size} viewBox="0 0 10 10">
          <Path d="M5 0 L6.2 3.8 L10 5 L6.2 6.2 L5 10 L3.8 6.2 L0 5 L3.8 3.8 Z" fill={GOLD_BRIGHT} />
        </Svg>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrim: {
    backgroundColor: "rgba(5, 6, 15, 0.94)",
  },
  cardContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  posterSheet: {
    width: 256,
    height: 356,
    backgroundColor: "#0B0F24",
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderWidth: 1.5,
    borderColor: "rgba(232, 199, 123, 0.45)",
    shadowColor: "#E8C77B",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 22,
    elevation: 14,
    justifyContent: "space-between",
    alignItems: "center",
  },
  cornerOrnament: {
    position: "absolute",
    width: 14,
    height: 14,
    borderColor: "rgba(232, 199, 123, 0.55)",
  },
  cornerTL: {
    top: 10,
    left: 10,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
  },
  cornerTR: {
    top: 10,
    right: 10,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
  },
  cornerBL: {
    bottom: 10,
    left: 10,
    borderBottomWidth: 1.5,
    borderLeftWidth: 1.5,
  },
  cornerBR: {
    bottom: 10,
    right: 10,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
  },
  posterHeader: {
    alignItems: "center",
    gap: 4,
  },
  posterKicker: {
    fontSize: 9.5,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.6,
    color: "rgba(232, 199, 123, 0.85)",
  },
  posterTitle: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay_700Bold",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  domeCenter: {
    width: 176,
    height: 176,
    alignItems: "center",
    justifyContent: "center",
  },
  domeSvgWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  metaWrap: {
    alignItems: "center",
    gap: 2,
  },
  metaDate: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255, 255, 255, 0.88)",
  },
  metaPlace: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(232, 199, 123, 0.8)",
  },
  posterFooter: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(232, 199, 123, 0.18)",
    paddingTop: 10,
    minHeight: 30,
  },
  footerStatusText: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    color: GOLD,
  },
  footerStatusOverlay: {
    position: "absolute",
    top: 10,
  },
  sealSpot: {
    position: "absolute",
    bottom: -18,
    right: 16,
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  seal: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: GOLD,
    borderWidth: 3,
    borderColor: "#B38A38",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 10,
  },
  sealInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: "rgba(26, 19, 43, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  shockRing: {
    position: "absolute",
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2.5,
    borderColor: GOLD_BRIGHT,
  },
  dust: {
    position: "absolute",
  },
  caption: {
    position: "absolute",
    bottom: "15%",
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});

