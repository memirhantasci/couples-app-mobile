import React, { useCallback, useEffect, useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Heart, Sparkles } from "lucide-react-native";
import { OrigamiBird, ORIGAMI_BIRD_HEAD_OFFSET, ORIGAMI_BIRD_SIZE } from "./OrigamiBird";
import {
  cubicBezierPoint,
  cubicBezierTangent,
  headingDegrees,
  smoothstep,
  type Point,
} from "@/lib/bezier";

interface OrigamiBirdAnimationProps {
  visible: boolean;
  /** Animasyon bittiğinde (ya da dokunularak geçildiğinde) tam bir kez çağrılır. */
  onComplete: () => void;
  accentColor?: string;
}

// ─── Zaman Çizelgesi (ms) ───────────────────────────────────────────────────────
// 0.0 sn  arka plan kararır, mektup kâğıdı yükselir
// 0.6 sn  mum mühür kâğıda basılır (şok halkası)
// 1.3 sn  kâğıt kuşa katlanır
// 1.5 sn  kuş doğar, kanat çırpmaya başlar
// 2.1 sn  kuş eğri bir yolda sağ üst köşeye uçar
// 3.3 sn  biter → çağıran taraf başarı pilini (toast) gösterir
const T = {
  scrimIn: 220,
  paperDelay: 90,
  sealDelay: 560,
  foldDelay: 1300,
  foldDuration: 560,
  birdDelay: 1520,
  flightDelay: 2100,
  flightDuration: 1250,
  scrimOutDelay: 2950,
  scrimOutDuration: 380,
} as const;

const TRAIL_COUNT = 8;

interface FlightPath {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
}

export function OrigamiBirdAnimation({
  visible,
  onComplete,
  accentColor = "#FF4D6D",
}: OrigamiBirdAnimationProps) {
  // İçerik yalnızca görünürken mount edilir: her gösterim sıfırdan, temiz durumla başlar
  if (!visible) return null;
  return <FlightScene onComplete={onComplete} accentColor={accentColor} />;
}

function FlightScene({
  onComplete,
  accentColor,
}: {
  onComplete: () => void;
  accentColor: string;
}) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const scrim = useSharedValue(0);
  const paperIn = useSharedValue(0);
  const seal = useSharedValue(0);
  const shock = useSharedValue(0);
  const stamp = useSharedValue(0);
  const fold = useSharedValue(0);
  const birdIn = useSharedValue(0);
  const flight = useSharedValue(0);
  const flapPhase = useSharedValue(0);
  const completed = useSharedValue(false);
  const flap = useDerivedValue(() => 0.5 + 0.5 * Math.sin(flapPhase.get() * 2 * Math.PI));

  // Merkeze göre görece yol: önce hafifçe sola-yukarı bir kalkış kıvrımı, sonra sağ üst köşeye süzülüş
  const path = useMemo<FlightPath>(
    () => ({
      p0: { x: 0, y: 0 },
      p1: { x: -screenW * 0.1, y: -screenH * 0.2 },
      p2: { x: screenW * 0.5, y: -screenH * 0.18 },
      p3: { x: screenW * 0.68, y: -screenH * 0.68 },
    }),
    [screenW, screenH]
  );

  const finish = useCallback(() => {
    if (completed.get()) return;
    completed.set(true);
    onComplete();
  }, [completed, onComplete]);

  useEffect(() => {
    if (reduceMotion) {
      // Hareket azaltma: sade bir belirme, kısa bekleme ve solma
      scrim.set(
        withSequence(
          withTiming(1, { duration: 200 }),
          withDelay(
            1300,
            withTiming(0, { duration: 250 }, (done) => {
              "worklet";
              if (done) scheduleOnRN(finish);
            })
          )
        )
      );
      paperIn.set(withTiming(1, { duration: 200 }));
      seal.set(withTiming(1, { duration: 200 }));
      return;
    }

    scrim.set(
      withSequence(
        withTiming(1, { duration: T.scrimIn }),
        withDelay(
          T.scrimOutDelay - T.scrimIn,
          withTiming(0, { duration: T.scrimOutDuration }, (done) => {
            "worklet";
            if (done) scheduleOnRN(finish);
          })
        )
      )
    );
    paperIn.set(withDelay(T.paperDelay, withSpring(1, { damping: 13, stiffness: 120 })));
    // Mühür: yaylı iniş (hafif taşma = basma hissi) + şok halkası + kâğıtta kısa çökme
    seal.set(withDelay(T.sealDelay, withSpring(1, { damping: 9, stiffness: 170 })));
    shock.set(
      withDelay(T.sealDelay + 40, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }))
    );
    stamp.set(
      withDelay(
        T.sealDelay + 40,
        withSequence(withTiming(1, { duration: 70 }), withTiming(0, { duration: 220 }))
      )
    );
    fold.set(
      withDelay(
        T.foldDelay,
        withTiming(1, { duration: T.foldDuration, easing: Easing.bezier(0.4, 0, 0.2, 1) })
      )
    );
    birdIn.set(withDelay(T.birdDelay, withSpring(1, { damping: 10, stiffness: 140 })));
    // Kanat çırpışı kalkışta hızlı, süzülürken yavaşlar (yavaşlayan faz = doğal "glide")
    flapPhase.set(
      withDelay(
        T.birdDelay,
        withTiming(5, {
          duration: T.flightDelay - T.birdDelay + T.flightDuration,
          easing: Easing.out(Easing.quad),
        })
      )
    );
    flight.set(
      withDelay(
        T.flightDelay,
        withTiming(1, { duration: T.flightDuration, easing: Easing.in(Easing.quad) })
      )
    );
    return () => {
      cancelAnimation(scrim);
      cancelAnimation(paperIn);
      cancelAnimation(seal);
      cancelAnimation(shock);
      cancelAnimation(stamp);
      cancelAnimation(fold);
      cancelAnimation(birdIn);
      cancelAnimation(flapPhase);
      cancelAnimation(flight);
    };
  }, [reduceMotion, scrim, paperIn, seal, shock, stamp, fold, birdIn, flapPhase, flight, finish]);

  // Dokununca hemen sona sar: arka plan hızla solar, ardından onComplete
  const skip = useCallback(() => {
    cancelAnimation(scrim);
    scrim.set(
      withTiming(0, { duration: 180 }, (done) => {
        "worklet";
        if (done) scheduleOnRN(finish);
      })
    );
  }, [scrim, finish]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.get() }));

  const paperStyle = useAnimatedStyle(() => {
    const p = paperIn.get();
    const f = fold.get();
    const s = stamp.get();
    return {
      opacity: interpolate(f, [0, 0.55, 1], [1, 1, 0], Extrapolation.CLAMP) * Math.min(1, p * 1.5),
      transform: [
        { translateY: (1 - p) * 70 + 3 * s },
        { scale: (0.55 + 0.45 * p) * (1 - 0.025 * s) },
        { scaleX: 1 - 0.82 * f },
        { scaleY: 1 - 0.35 * f },
        { rotate: `${45 * f}deg` },
      ],
    };
  });

  const sealStyle = useAnimatedStyle(() => {
    const s = seal.get();
    return {
      opacity: Math.min(1, s * 2.5),
      transform: [{ scale: 2.4 - 1.4 * s }, { rotate: `${-18 + 18 * s}deg` }],
    };
  });

  const shockStyle = useAnimatedStyle(() => {
    const k = shock.get();
    return {
      opacity: k > 0 ? 0.55 * (1 - k) : 0,
      transform: [{ scale: 1 + 2.6 * k }],
    };
  });

  const sealingTextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(seal.get(), [0, 0.35], [1, 0], Extrapolation.CLAMP),
  }));
  const sealedTextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(seal.get(), [0.35, 0.7], [0, 1], Extrapolation.CLAMP),
  }));

  const birdStyle = useAnimatedStyle(() => {
    const t = flight.get();
    const appear = birdIn.get();
    const pos = cubicBezierPoint(t, path.p0, path.p1, path.p2, path.p3);
    // t=0'da teğet sıfırlanabilir; başlangıç yönünü kararlı tutmak için küçük bir alt sınır
    const tangent = cubicBezierTangent(Math.max(t, 0.02), path.p0, path.p1, path.p2, path.p3);
    const heading = headingDegrees(tangent) + ORIGAMI_BIRD_HEAD_OFFSET;
    const rotation = heading * smoothstep(0, 0.22, t);
    // Havalanmadan önce kanat çırpışıyla uyumlu hafif bir "süzülme" salınımı
    const hover = -6 * flap.get() * (1 - smoothstep(0, 0.2, t));
    return {
      opacity: Math.min(1, appear * 2) * (1 - smoothstep(0.82, 1, t)),
      transform: [
        { translateX: pos.x },
        { translateY: pos.y + hover },
        { rotate: `${rotation}deg` },
        { scale: appear * (1 - 0.58 * Math.pow(t, 0.85)) },
      ],
    };
  });

  const captionStyle = useAnimatedStyle(() => ({
    opacity: scrim.get() * (1 - smoothstep(0.1, 0.5, flight.get())),
  }));

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={skip}
    >
      <View style={styles.root}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />

        {/* ─── 1. Mektup kâğıdı + mum mühür ─── */}
        <Animated.View pointerEvents="none" style={[styles.paperContainer, paperStyle]}>
          <View style={styles.letterSheet}>
            <View style={styles.letterHeader}>
              <View style={styles.stampCircle}>
                <Heart size={16} color="#FF4D6D" fill="#FF4D6D" />
              </View>
              <Text style={styles.letterTitle}>Sevgilime Özel...</Text>
            </View>

            <View style={styles.letterLinesWrapper}>
              <View style={styles.letterLine} />
              <View style={styles.letterLine} />
              <View style={styles.letterLine} />
              <View style={[styles.letterLine, { width: "65%" }]} />
            </View>

            <View style={styles.letterFooter}>
              <Animated.Text style={[styles.letterFooterText, { color: accentColor }, sealingTextStyle]}>
                Mühürleniyor... 💌
              </Animated.Text>
              <Animated.Text
                style={[styles.letterFooterText, styles.letterFooterOverlay, { color: accentColor }, sealedTextStyle]}
              >
                Mühürlendi ✨
              </Animated.Text>
            </View>

            <View style={styles.sealSpot}>
              <Animated.View style={[styles.shockRing, { borderColor: accentColor }, shockStyle]} />
              <Animated.View style={[styles.seal, sealStyle]}>
                <View style={styles.sealInner}>
                  <Heart size={18} color="#FFE3E8" fill="#FFE3E8" />
                </View>
              </Animated.View>
            </View>
          </View>
        </Animated.View>

        {/* ─── 2. Uçuş izi: yolu izleyen parıltı ve kalpler ─── */}
        {Array.from({ length: TRAIL_COUNT }, (_, index) => (
          <TrailParticle key={index} index={index} flight={flight} path={path} />
        ))}

        {/* ─── 3. Origami kuşu ─── */}
        <Animated.View pointerEvents="none" style={[styles.birdContainer, birdStyle]}>
          <OrigamiBird flap={flap} />
        </Animated.View>

        <Animated.Text pointerEvents="none" style={[styles.caption, captionStyle]}>
          Geleceğe emanet ediliyor... ✨
        </Animated.Text>

        {/* Ekrana dokunarak animasyon geçilebilir */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={skip}
          accessibilityRole="button"
          accessibilityLabel="Animasyonu geç"
        />
      </View>
    </Modal>
  );
}

/** Kuşun yolunu `index` kadar gecikmeyle izleyen, yola dik küçük salınımlı parıltı/kalp. */
function TrailParticle({
  index,
  flight,
  path,
}: {
  index: number;
  flight: SharedValue<number>;
  path: FlightPath;
}) {
  const lag = 0.045 * (index + 1);
  const isHeart = index % 2 === 1;

  const style = useAnimatedStyle(() => {
    const f = flight.get();
    const t = Math.min(1, Math.max(0, f - lag));
    const pos = cubicBezierPoint(t, path.p0, path.p1, path.p2, path.p3);
    const tan = cubicBezierTangent(Math.max(t, 0.02), path.p0, path.p1, path.p2, path.p3);
    const len = Math.sqrt(tan.x * tan.x + tan.y * tan.y) || 1;
    // yola dik birim vektör × zamanla değişen salınım
    const wobble = Math.sin(f * 14 + index * 1.7) * 9;
    const life = interpolate(f - lag, [0, 0.08, 0.5, 0.78], [0, 1, 0.65, 0], Extrapolation.CLAMP);
    return {
      opacity: f > lag ? life * (1 - index * 0.06) : 0,
      transform: [
        { translateX: pos.x + (-tan.y / len) * wobble },
        { translateY: pos.y + (tan.x / len) * wobble },
        { scale: 1 - index * 0.06 },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.particle, style]}>
      {isHeart ? (
        <Heart size={13} color="#FF85A1" fill="#FF85A1" />
      ) : (
        <Sparkles size={15} color={index % 4 === 0 ? "#FFD700" : "#FFFFFF"} />
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
    backgroundColor: "rgba(6, 5, 14, 0.94)",
  },

  /* MEKTUP KAĞIDI */
  paperContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  letterSheet: {
    width: 210,
    height: 250,
    backgroundColor: "#FFFDF9",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255, 77, 109, 0.25)",
    shadowColor: "#FF4D6D",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 12,
    justifyContent: "space-between",
  },
  letterHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 77, 109, 0.15)",
    paddingBottom: 10,
  },
  stampCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 77, 109, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  letterTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#2D1B2D",
    letterSpacing: -0.2,
  },
  letterLinesWrapper: {
    gap: 12,
    paddingVertical: 14,
  },
  letterLine: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(230, 200, 210, 0.45)",
    borderRadius: 2,
  },
  letterFooter: {
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 77, 109, 0.12)",
    paddingTop: 8,
    minHeight: 30,
  },
  letterFooterText: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
  },
  // İki metin aynı yerde çapraz solar
  letterFooterOverlay: {
    position: "absolute",
    top: 8,
  },

  /* MUM MÜHÜR */
  sealSpot: {
    position: "absolute",
    bottom: -16,
    right: 14,
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  seal: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#B3122F",
    borderWidth: 3,
    borderColor: "#7E0B21",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#B3122F",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 8,
  },
  sealInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  shockRing: {
    position: "absolute",
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2.5,
  },

  /* KUŞ & İZ */
  birdContainer: {
    position: "absolute",
    width: ORIGAMI_BIRD_SIZE,
    height: ORIGAMI_BIRD_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  particle: {
    position: "absolute",
  },
  caption: {
    position: "absolute",
    bottom: "18%",
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
});
