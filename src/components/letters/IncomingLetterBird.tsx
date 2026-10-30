import { useCallback, useEffect, useMemo } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Heart, Mail } from "lucide-react-native";
import { OrigamiBird, ORIGAMI_BIRD_HEAD_OFFSET, ORIGAMI_BIRD_SIZE } from "./OrigamiBird";
import { cubicBezierPoint, cubicBezierTangent, headingDegrees, smoothstep } from "@/lib/bezier";
import { hapticTap } from "@/lib/soundEffects";
import { dayjs } from "@/lib/date";
import type { ArrivedLetters } from "@/lib/letterArrival";
import { useTranslation } from "react-i18next";

interface IncomingLetterBirdProps {
  arrival: ArrivedLetters;
  /** Hapa dokunuldu: mektuplara git */
  onOpen: () => void;
  /** Hap kapandı (kaydırma, süre dolması ya da açılış sonrası) */
  onDismiss: () => void;
}

const FLIGHT_MS = 1800;
// Hap, kuşun dalış dibini geçip tünemeye yükseldiği sırada belirir; kuş tam üzerine konar
const PILL_DELAY_MS = 1350;
// Konunca kuşun duruşu: neredeyse dik (kanatlar yukarı). Yaklaşırken yön izler, son kısımda dikleşir.
const PERCH_ROTATION = 8;
const AUTO_DISMISS_MS = 9000;
const EXIT_MS = 340;
const RESUME_MS = 2500;
const DISMISS_DISTANCE = 26;
const DISMISS_VELOCITY = 520;
const HALF_BIRD = ORIGAMI_BIRD_SIZE / 2;

/**
 * Partnerinden mektup gelmişse uygulamaya girildiğinde oynar: kuş ekranın sol üst köşesinden
 * dalış yapıp süzülerek yükselir ve bir "mektup geldi" hapının üst kenarına konar, kanatlarını
 * kapatır. Hapa dokunmak mektuplara götürür; yukarı kaydırmak ya da beklemek kapatır.
 */
export function IncomingLetterBird({ arrival, onOpen, onDismiss }: IncomingLetterBirdProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const pillWidth = Math.min(screenW - 32, 380);
  const pillLeft = (screenW - pillWidth) / 2;
  const pillTop = insets.top + 60;
  const perchX = screenW / 2;
  const perchY = pillTop - 8;

  // Mutlak ekran koordinatları: sol üst köşenin dışından başlar, aşağı dalar, yukarı süzülüp konar
  const path = useMemo(
    () => ({
      p0: { x: -90, y: perchY - 80 },
      p1: { x: screenW * 0.22, y: perchY + 90 },
      p2: { x: perchX - 70, y: perchY + 55 },
      p3: { x: perchX, y: perchY },
    }),
    [screenW, perchX, perchY]
  );

  const flight = useSharedValue(reduceMotion ? 1 : 0);
  const flapPhase = useSharedValue(0);
  const settle = useSharedValue(0);
  const pillIn = useSharedValue(reduceMotion ? 1 : 0);
  const exit = useSharedValue(0);
  const dragY = useSharedValue(0);
  const closed = useSharedValue(false);

  // Konmadan önce çırpar, yaklaştıkça kanatlar sakinleşip kapanır
  const flap = useDerivedValue(() => {
    const osc = 0.5 + 0.5 * Math.sin(flapPhase.get() * 2 * Math.PI);
    const rest = smoothstep(0.82, 1, flight.get());
    return osc * (1 - rest) + 0.18 * rest;
  });

  const finish = useCallback(() => {
    if (closed.get()) return;
    closed.set(true);
    onDismiss();
  }, [closed, onDismiss]);

  const startExit = useCallback(
    (afterMs: number) => {
      exit.set(
        withDelay(
          afterMs,
          withTiming(
            1,
            { duration: reduceMotion ? 160 : EXIT_MS, easing: Easing.in(Easing.cubic) },
            (done) => {
              "worklet";
              if (done) scheduleOnRN(finish);
            }
          )
        )
      );
    },
    [exit, reduceMotion, finish]
  );

  const exitNow = useCallback(() => {
    cancelAnimation(exit);
    startExit(0);
  }, [exit, startExit]);

  // Kaydırma sürerken otomatik kapanma durur
  const holdExit = useCallback(() => {
    cancelAnimation(exit);
  }, [exit]);

  const resumeExit = useCallback(() => {
    if (closed.get()) return;
    startExit(RESUME_MS);
  }, [closed, startExit]);

  const handleOpen = useCallback(() => {
    onOpen();
    exitNow();
  }, [onOpen, exitNow]);

  useEffect(() => {
    if (!reduceMotion) {
      flight.set(withTiming(1, { duration: FLIGHT_MS, easing: Easing.out(Easing.cubic) }));
      flapPhase.set(withTiming(6, { duration: FLIGHT_MS, easing: Easing.out(Easing.quad) }));
      pillIn.set(withDelay(PILL_DELAY_MS, withSpring(1, { damping: 14, stiffness: 160 })));
      // Konma anında minik bir sıçrayış
      settle.set(
        withDelay(
          FLIGHT_MS,
          withSequence(
            withSpring(1, { damping: 6, stiffness: 260 }),
            withSpring(0, { damping: 12, stiffness: 180 })
          )
        )
      );
    }
    startExit(PILL_DELAY_MS + AUTO_DISMISS_MS);

    const landed = setTimeout(hapticTap, reduceMotion ? 0 : FLIGHT_MS);
    // Güvenlik ağı: animasyon geri çağrısı gelmezse hap yine de kapansın
    const safety = setTimeout(finish, PILL_DELAY_MS + AUTO_DISMISS_MS + EXIT_MS + 1500);
    return () => {
      clearTimeout(landed);
      clearTimeout(safety);
    };
  }, [reduceMotion, flight, flapPhase, pillIn, settle, startExit, finish]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetY([-8, 8])
      .onStart(() => {
        "worklet";
        scheduleOnRN(holdExit);
      })
      .onUpdate((event) => {
        "worklet";
        dragY.set(Math.min(0, event.translationY));
      })
      .onEnd((event) => {
        "worklet";
        if (event.translationY < -DISMISS_DISTANCE || event.velocityY < -DISMISS_VELOCITY) {
          scheduleOnRN(exitNow);
        } else {
          dragY.set(withSpring(0));
          scheduleOnRN(resumeExit);
        }
      });

    const tap = Gesture.Tap().onEnd((_event, success) => {
      "worklet";
      if (success) scheduleOnRN(handleOpen);
    });

    return Gesture.Race(pan, tap);
  }, [dragY, holdExit, exitNow, resumeExit, handleOpen]);

  const birdStyle = useAnimatedStyle(() => {
    const t = flight.get();
    const pos = cubicBezierPoint(t, path.p0, path.p1, path.p2, path.p3);
    const tangent = cubicBezierTangent(Math.max(t, 0.02), path.p0, path.p1, path.p2, path.p3);
    const headingRotation = headingDegrees(tangent) + ORIGAMI_BIRD_HEAD_OFFSET;
    // Son %40'ta yön izlemeyi bırakıp dikleşir (konmadan önce "yükselip dengeye gelme")
    const rotation =
      headingRotation + (PERCH_ROTATION - headingRotation) * smoothstep(0.6, 1, t);
    const hop = settle.get();
    const e = exit.get();
    return {
      opacity: smoothstep(0, 0.1, t) * (1 - e),
      transform: [
        { translateX: pos.x - HALF_BIRD },
        { translateY: pos.y - HALF_BIRD - 6 * hop - e * 120 + dragY.get() },
        { rotate: `${rotation}deg` },
        // Yaklaşırken büyük (kameraya yakın), konunca küçülür
        { scale: (0.62 - 0.2 * smoothstep(0.5, 1, t)) * (1 + 0.12 * hop) },
      ],
    };
  });

  const pillStyle = useAnimatedStyle(() => {
    const p = pillIn.get();
    const e = exit.get();
    return {
      opacity: Math.min(1, p * 1.4) * (1 - e),
      transform: [
        { translateY: (1 - p) * -26 - e * 140 + dragY.get() },
        { scale: 0.94 + 0.06 * Math.min(1, p) },
      ],
    };
  });

  const senderTag = t("letters.bird.wroteToYou", { name: arrival.senderName ?? t("common.partnerFallback") });
  const title =
    arrival.count > 1
      ? t("letters.bird.manyNew", { total: arrival.count, plus: arrival.hasMore ? "+" : "" })
      : t("letters.bird.oneNew");
  const subtitle = arrival.locked && arrival.unlockDate
    ? t("letters.bird.opensOn", { date: dayjs(arrival.unlockDate).locale(i18n.language).format("D MMMM YYYY") })
    : t("letters.bird.ready");

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          accessible
          accessibilityRole="button"
          accessibilityLabel={t("letters.bird.a11y", { senderTag, title, subtitle })}
          // Ekran okuyucuyla "etkinleştir" jesti RNGH Tap'ini tetiklemez; aynı eylem burada da bağlı
          onAccessibilityTap={handleOpen}
          style={[styles.shadowWrap, { top: pillTop, left: pillLeft, width: pillWidth }, pillStyle]}
        >
          <LinearGradient
            colors={["#F5C563", "#B8365A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.border}
          >
            <View style={styles.pill}>
              <View style={styles.waxSeal}>
                <View style={styles.waxSealInner}>
                  <Mail size={16} color="#FFEBB8" strokeWidth={2.5} />
                </View>
                <View style={styles.heartDot}>
                  <Heart size={8} color="#FF5C77" fill="#FF5C77" />
                </View>
              </View>
              <View style={styles.textCol}>
                <Text style={styles.tag} numberOfLines={1}>
                  {senderTag}
                </Text>
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </GestureDetector>

      {/* Kuş hapın üstünde çizilir; dokunuşları engellemez */}
      <Animated.View pointerEvents="none" style={[styles.bird, birdStyle]}>
        <OrigamiBird flap={flap} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9990,
    elevation: 9990,
  },
  // Gölgeyi taşıyan katman: overflow verilmez (iOS'ta gölgeyi keserdi)
  shadowWrap: {
    position: "absolute",
    borderRadius: 24,
    backgroundColor: "#1B0E16",
    shadowColor: "#F5C563",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  border: {
    borderRadius: 24,
    padding: 1.3,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 22.7,
    backgroundColor: "#1B0E16",
  },
  textCol: {
    flex: 1,
  },
  tag: {
    color: "#F5C563",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    marginTop: 1,
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  waxSeal: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#2B0B15",
    borderWidth: 1.6,
    borderColor: "#F5C563",
    alignItems: "center",
    justifyContent: "center",
  },
  waxSealInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#781C37",
    alignItems: "center",
    justifyContent: "center",
  },
  heartDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  // Android'de elevation z-sırasını belirler: kuş, elevation'ı 12 olan hapın üstünde kalsın
  bird: {
    position: "absolute",
    top: 0,
    left: 0,
    width: ORIGAMI_BIRD_SIZE,
    height: ORIGAMI_BIRD_SIZE,
    elevation: 20,
    zIndex: 20,
  },
});
