import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  Extrapolation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient as SvgGradient, Line, Path, Stop } from "react-native-svg";
import { Heart, Sparkles, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { dayjs } from "@/lib/date";
import { smoothstep } from "@/lib/bezier";
import { isSealBroken, isSealBrokenCached, rememberBrokenSeal } from "@/lib/letterSeals";
import { playStampDrop } from "@/lib/soundEffects";
import type { AppTheme } from "@/lib/theme";

/** Okunmaya hazır (çözülmüş) gelen mektup. */
export interface ReadableLetter {
  id: number;
  title: string;
  /** Çözülmüş düz metin */
  content: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  /** Yazıldığı an (ISO) */
  createdAt: string;
  /** Açılış günü (YYYY-MM-DD) */
  unlockDate?: string | null;
}

export interface LetterReadingModalProps {
  visible: boolean;
  letter: ReadableLetter | null;
  theme: AppTheme;
  onClose: () => void;
}

// ─── Zaman Çizelgesi (ms, mühre dokunulduğu andan itibaren) ─────────────────────
// 0      mühür ikiye ayrılıp savrulur, tok mühür sesi + titreşim, zarf hafifçe sarsılır
// 180    üçgen kapak 3B olarak yukarı katlanır
// 650    mektup kâğıdı zarftan yukarı süzülür
// 1120   zarf aşağı düşüp söner, kâğıt açılarak ekranı kaplar
// 1650   metin belirir, gül yaprakları ve ışıltılar yükselir
const T = {
  riseIn: 520,
  crackDuration: 560,
  flapDelay: 180,
  flapDuration: 540,
  pullDelay: 650,
  pullDuration: 560,
  unfoldDelay: 1120,
  unfoldDuration: 620,
  contentDelay: 1560,
  petalsDelay: 1450,
  petalsDuration: 2300,
  closeDuration: 220,
} as const;

// "Mührü Tekrar Kır": açılış tersine oynar (kâğıt katlanıp zarfa girer, kapak kapanır, mühür birleşir)
const R = {
  contentOut: 180,
  foldDelay: 120,
  foldDuration: 520,
  tuckDelay: 560,
  tuckDuration: 420,
  closeFlapDelay: 900,
  closeFlapDuration: 460,
  mendDelay: 1250,
  mendDuration: 420,
} as const;

const SEAL = 58;
/** Mührün düzensiz mum kenarı dahil kapladığı kutu. */
const SEAL_BOX = SEAL + 10;
const PETAL_COUNT = 6;

type Phase = "sealed" | "opening" | "open" | "resealing";

export function LetterReadingModal({ visible, letter, theme, onClose }: LetterReadingModalProps) {
  // İçerik yalnızca görünürken mount edilir: her açılış temiz durumla başlar
  if (!visible || !letter) return null;
  return <SealGate key={letter.id} letter={letter} theme={theme} onClose={onClose} />;
}

/**
 * Mührün daha önce kırılıp kırılmadığına göre sahneyi mühürlü zarfla ya da doğrudan açık kâğıtla
 * başlatır. Hafıza liste ekranında önceden yüklendiği için cevap neredeyse her zaman ilk karede hazırdır.
 */
function SealGate({ letter, theme, onClose }: { letter: ReadableLetter; theme: AppTheme; onClose: () => void }) {
  const [sealBroken, setSealBroken] = useState<boolean | null>(() => isSealBrokenCached(letter.id));

  useEffect(() => {
    if (sealBroken !== null) return;
    let alive = true;
    isSealBroken(letter.id).then((broken) => {
      if (alive) setSealBroken(broken);
    });
    return () => {
      alive = false;
    };
  }, [sealBroken, letter.id]);

  if (sealBroken === null) return null;
  return <ReadingScene letter={letter} theme={theme} onClose={onClose} startOpen={sealBroken} />;
}

function ReadingScene({
  letter,
  theme,
  onClose,
  startOpen,
}: {
  letter: ReadableLetter;
  theme: AppTheme;
  onClose: () => void;
  /** Mühür daha önce kırıldı: ritüel atlanır, mektup açık kâğıtla gelir. */
  startOpen: boolean;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const opensDirectly = reduceMotion || startOpen;
  const [phase, setPhase] = useState<Phase>(opensDirectly ? "open" : "sealed");

  // ─── Geometri ───
  const envW = Math.min(screenW - 64, 320);
  const envH = Math.round(envW * 0.66);
  const flapH = Math.round(envH * 0.58);
  const envCenterY = screenH * 0.56;
  const envTop = envCenterY - envH / 2;
  const peekW = envW - 28;
  const peekH = envH - 14;
  const pullDistance = envH * 0.62;

  const sheetTop = insets.top + 64;
  const sheetW = screenW - 32;
  const sheetH = Math.max(320, screenH - sheetTop - insets.bottom - 28);
  // Kâğıt, zarftan çıkan önizlemenin tam yerinde ve boyutunda başlar, oradan açılarak büyür
  const unfoldFromY = envTop + 8 - pullDistance - sheetTop;
  const unfoldFromScaleX = peekW / sheetW;
  const unfoldFromScaleY = peekH / sheetH;

  const paper = useMemo(() => paperPalette(theme), [theme]);

  // ─── Animasyon değerleri ───
  const scrim = useSharedValue(0);
  const rise = useSharedValue(opensDirectly ? 1 : 0);
  const hint = useSharedValue(0);
  const jolt = useSharedValue(0);
  const crack = useSharedValue(0);
  const flap = useSharedValue(0);
  const pull = useSharedValue(0);
  const unfold = useSharedValue(opensDirectly ? 1 : 0);
  const contentIn = useSharedValue(opensDirectly ? 1 : 0);
  const petals = useSharedValue(0);
  const out = useSharedValue(0);

  // Mühürlü zarfın bekleme hâli: dokunma ipucu yavaşça yanıp söner
  const startHint = useCallback(
    (delay: number) => {
      hint.set(
        withDelay(
          delay,
          withRepeat(
            withSequence(withTiming(1, { duration: 900 }), withTiming(0.4, { duration: 900 })),
            -1,
            true
          )
        )
      );
    },
    [hint]
  );

  useEffect(() => {
    scrim.set(withTiming(1, { duration: reduceMotion ? 180 : 260 }));
    if (opensDirectly) return;
    rise.set(withSpring(1, { damping: 14, stiffness: 120 }));
    startHint(T.riseIn);
    return () => {
      cancelAnimation(rise);
      cancelAnimation(hint);
    };
  }, [reduceMotion, opensDirectly, scrim, rise, hint, startHint]);

  const markOpen = useCallback(() => setPhase("open"), []);

  // ─── Mührü kır ───
  const breakSeal = useCallback(() => {
    if (phase !== "sealed") return;
    setPhase("opening");
    rememberBrokenSeal(letter.id);
    // Tek, tok kırılma titreşimi: playStampDrop sesle birlikte hapticStamp'i kendisi verir;
    // burada ayrıca bir haptik çağrılmaz
    playStampDrop();

    cancelAnimation(hint);
    hint.set(withTiming(0, { duration: 160 }));
    jolt.set(withSequence(withTiming(1, { duration: 70 }), withSpring(0, { damping: 8, stiffness: 260 })));
    crack.set(withTiming(1, { duration: T.crackDuration, easing: Easing.out(Easing.cubic) }));
    flap.set(
      withDelay(T.flapDelay, withTiming(1, { duration: T.flapDuration, easing: Easing.inOut(Easing.cubic) }))
    );
    pull.set(
      withDelay(T.pullDelay, withTiming(1, { duration: T.pullDuration, easing: Easing.out(Easing.cubic) }))
    );
    unfold.set(
      withDelay(
        T.unfoldDelay,
        withTiming(1, { duration: T.unfoldDuration, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }, (done) => {
          "worklet";
          if (done) scheduleOnRN(markOpen);
        })
      )
    );
    contentIn.set(withDelay(T.contentDelay, withTiming(1, { duration: 420 })));
    petals.set(
      withDelay(T.petalsDelay, withTiming(1, { duration: T.petalsDuration, easing: Easing.out(Easing.quad) }))
    );
  }, [phase, letter.id, hint, jolt, crack, flap, pull, unfold, contentIn, petals, markOpen]);

  // ─── Mührü tekrar kır: açılış tersine oynar, ardından mühür yeniden kırılmayı bekler ───
  const finishReseal = useCallback(() => {
    setPhase("sealed");
    startHint(0);
  }, [startHint]);

  const reseal = useCallback(() => {
    if (phase !== "open") return;
    setPhase("resealing");
    cancelAnimation(petals);
    petals.set(0);
    // Mektup doğrudan açıldıysa zarf hiç açılmadı: kâğıt görünürken (zarf gizli) "açılmış" konuma alınır
    rise.set(1);
    crack.set(1);
    flap.set(1);
    pull.set(1);
    const ease = Easing.inOut(Easing.cubic);
    contentIn.set(withTiming(0, { duration: R.contentOut }));
    unfold.set(withDelay(R.foldDelay, withTiming(0, { duration: R.foldDuration, easing: ease })));
    pull.set(withDelay(R.tuckDelay, withTiming(0, { duration: R.tuckDuration, easing: ease })));
    flap.set(withDelay(R.closeFlapDelay, withTiming(0, { duration: R.closeFlapDuration, easing: ease })));
    crack.set(
      withDelay(
        R.mendDelay,
        withTiming(0, { duration: R.mendDuration, easing: Easing.out(Easing.cubic) }, (done) => {
          "worklet";
          if (done) scheduleOnRN(finishReseal);
        })
      )
    );
  }, [phase, petals, rise, crack, flap, pull, contentIn, unfold, finishReseal]);

  // ─── Kapat: her şey yumuşakça söner, ardından onClose ───
  const close = useCallback(() => {
    cancelAnimation(out);
    out.set(
      withTiming(1, { duration: reduceMotion ? 150 : T.closeDuration }, (done) => {
        "worklet";
        if (done) scheduleOnRN(onClose);
      })
    );
  }, [out, reduceMotion, onClose]);

  // ─── Stiller ───
  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - out.get() }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.get() }));

  const envelopeStyle = useAnimatedStyle(() => {
    const r = rise.get();
    const u = unfold.get();
    return {
      opacity: Math.min(1, r * 1.6) * (1 - smoothstep(0.05, 0.6, u)),
      transform: [
        { translateY: (1 - r) * 90 + u * envH * 0.9 },
        { scale: (0.9 + 0.1 * r) * (1 - 0.03 * jolt.get()) },
      ],
    };
  });

  // Üçgen kapak menteşesi etrafında 0→180° döner. Tek parça çizilseydi açık kapak çıkan kâğıdın
  // önünde kalırdı; bu yüzden 90°'de (kenardan görünürken) iki yüze ayrılır: ilk yarıda mühürlü ön
  // yüz dikleşir, ikinci yarıda astar yüzü zarfın arkasında aynı dönüşle yatar.
  const frontFlapStyle = useAnimatedStyle(() => {
    const f = flap.get();
    return {
      opacity: f < 0.5 ? 1 : 0,
      transform: [{ perspective: 900 }, { rotateX: `${Math.min(90, f * 180)}deg` }],
    };
  });
  const backFlapStyle = useAnimatedStyle(() => {
    const f = flap.get();
    return {
      opacity: f >= 0.5 ? 1 : 0,
      transform: [{ perspective: 900 }, { rotateX: `${Math.min(0, f * 180 - 180)}deg` }],
    };
  });

  const peekStyle = useAnimatedStyle(() => ({
    // Açılan kâğıt tam bu karede devralır
    opacity: unfold.get() > 0 ? 0 : 1,
    transform: [{ translateY: -pullDistance * pull.get() }],
  }));

  const sheetStyle = useAnimatedStyle(() => {
    const u = unfold.get();
    return {
      opacity: u > 0 ? 1 : 0,
      transform: [
        { translateY: unfoldFromY * (1 - u) },
        { scaleX: unfoldFromScaleX + (1 - unfoldFromScaleX) * u },
        { scaleY: unfoldFromScaleY + (1 - unfoldFromScaleY) * u },
      ],
    };
  });
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentIn.get(),
    transform: [{ translateY: (1 - contentIn.get()) * 10 }],
  }));

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hint.get() * Math.min(1, rise.get()) * (1 - smoothstep(0, 0.3, flap.get())),
  }));

  const writtenOn = dayjs(letter.createdAt).locale(i18n.language).format("D MMMM YYYY");
  const openedOn = letter.unlockDate
    ? dayjs(letter.unlockDate).locale(i18n.language).format("D MMMM YYYY")
    : null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      <Animated.View style={[styles.root, rootStyle]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, scrimStyle]}>
          <BlurView
            intensity={Platform.OS === "ios" ? 45 : 90}
            tint={theme.blurTint}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: theme.isLight ? "rgba(255, 240, 245, 0.45)" : "rgba(6, 4, 10, 0.62)" },
            ]}
          />
        </Animated.View>

        {/* ─── 1. Mühürlü zarf ─── */}
        <Animated.View
          pointerEvents={phase === "sealed" ? "auto" : "none"}
          style={[styles.envelope, { width: envW, height: envH, left: (screenW - envW) / 2, top: envTop }, envelopeStyle]}
        >
          {/* Açılmış kapak (astar yüzü): zarfın ve kâğıdın arkasında yükselir */}
          <Animated.View style={[styles.backFlap, { top: -flapH, width: envW, height: flapH }, backFlapStyle]}>
            <Svg width={envW} height={flapH}>
              <Path d={flapPath(envW, flapH, "up")} fill={ENVELOPE.inner} />
              <Path d={flapPath(envW, flapH, "up")} fill={theme.accent} fillOpacity={0.28} />
              <Path d={flapPath(envW, flapH, "up")} fill="none" stroke={ENVELOPE.edge} strokeWidth={1} />
            </Svg>
          </Animated.View>

          <View style={[styles.envelopeBack, { width: envW, height: envH }]} />

          {/* Zarfın içindeki kâğıt */}
          <Animated.View style={[styles.peek, { width: peekW, height: peekH }, peekStyle]}>
            <LinearGradient colors={paper.gradient} style={[StyleSheet.absoluteFill, styles.peekPaper]} />
            <Text style={[styles.peekTitle, { color: paper.ink }]} numberOfLines={1}>
              {letter.title}
            </Text>
            {[0.92, 1, 0.84, 0.66].map((width, index) => (
              <View key={index} style={[styles.peekLine, { width: `${width * 100}%`, backgroundColor: paper.rule }]} />
            ))}
          </Animated.View>

          {/* Ön cep: V kesikli gövde ve kıvrım çizgileri */}
          <Svg width={envW} height={envH} style={StyleSheet.absoluteFill}>
            <Defs>
              <SvgGradient id="envFront" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={ENVELOPE.frontTop} />
                <Stop offset="1" stopColor={ENVELOPE.frontBottom} />
              </SvgGradient>
            </Defs>
            <Path d={pocketPath(envW, envH)} fill="url(#envFront)" />
            <Line x1={0} y1={envH} x2={envW * 0.5} y2={envH * 0.5} stroke={ENVELOPE.fold} strokeWidth={1} />
            <Line x1={envW} y1={envH} x2={envW * 0.5} y2={envH * 0.5} stroke={ENVELOPE.fold} strokeWidth={1} />
            <Path d={pocketPath(envW, envH)} fill="none" stroke={ENVELOPE.edge} strokeWidth={1} />
          </Svg>

          {/* Kapalı kapak (mühürlü ön yüz) */}
          <Animated.View style={[styles.frontFlap, { width: envW, height: flapH }, frontFlapStyle]}>
            <Svg width={envW} height={flapH + 4}>
              <Defs>
                <SvgGradient id="envFlap" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={ENVELOPE.flapTop} />
                  <Stop offset="1" stopColor={ENVELOPE.flapBottom} />
                </SvgGradient>
              </Defs>
              <Path d={flapPath(envW, flapH, "down")} fill="url(#envFlap)" />
              <Path d={flapPath(envW, flapH, "down")} fill="none" stroke={ENVELOPE.edge} strokeWidth={1} />
            </Svg>
          </Animated.View>

          <Pressable
            onPress={breakSeal}
            disabled={phase !== "sealed"}
            hitSlop={24}
            style={[styles.sealHit, { left: envW / 2 - SEAL_BOX / 2, top: flapH - SEAL_BOX / 2 - 14 }]}
            accessibilityRole="button"
            accessibilityLabel={t("letters.reading.breakSealA11y")}
          >
            <WaxSeal crack={crack} />
          </Pressable>
        </Animated.View>

        {phase !== "open" ? (
          <Animated.Text
            pointerEvents="none"
            style={[styles.hint, { top: envTop + envH + 34, color: theme.isLight ? theme.textSecondary : "rgba(255,255,255,0.82)" }, hintStyle]}
          >
            {t("letters.reading.tapSeal")}
          </Animated.Text>
        ) : null}

        {/* ─── 2. Açılan mektup kâğıdı ─── */}
        <Animated.View
          pointerEvents={phase === "open" ? "auto" : "none"}
          style={[
            styles.sheet,
            // Zemin rengi Android gölgesi (elevation) için gerekli; asıl doku üstteki degrade
            {
              top: sheetTop,
              left: 16,
              width: sheetW,
              height: sheetH,
              backgroundColor: paper.gradient[1],
              shadowColor: paper.shadow,
            },
            sheetStyle,
          ]}
        >
          <LinearGradient colors={paper.gradient} style={[StyleSheet.absoluteFill, styles.sheetPaper]} />
          <View pointerEvents="none" style={[styles.sheetFrame, { borderColor: paper.frame }]} />

          <Animated.View style={[styles.sheetContent, contentStyle]}>
            <ScrollView contentContainerStyle={styles.sheetScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.senderRow}>
                <UserAvatar
                  uri={letter.senderAvatarUrl}
                  name={letter.senderName}
                  size={42}
                  borderColor={theme.accent}
                  borderWidth={1.5}
                />
                <View style={styles.senderText}>
                  <Text style={[styles.senderName, { color: paper.ink }]} numberOfLines={1}>
                    {t("letters.card.from", { personName: letter.senderName })}
                  </Text>
                  <Text style={[styles.senderDate, { color: paper.inkSoft }]}>
                    {t("letters.reading.writtenOn", { date: writtenOn })}
                  </Text>
                </View>
              </View>

              <View style={styles.ornament}>
                <View style={[styles.ornamentLine, { backgroundColor: paper.rule }]} />
                <Heart size={12} color={theme.accent} fill={theme.accent} />
                <View style={[styles.ornamentLine, { backgroundColor: paper.rule }]} />
              </View>

              <Text style={[styles.letterTitle, { color: paper.ink }]} accessibilityRole="header">
                {letter.title}
              </Text>
              <Text style={[styles.letterBody, { color: paper.ink }]} selectable>
                {letter.content}
              </Text>

              <Text style={[styles.signature, { color: theme.accent }]}>
                {t("letters.reading.signature", { name: letter.senderName })}
              </Text>
              {openedOn ? (
                <Text style={[styles.footerNote, { color: paper.inkSoft }]}>
                  {t("letters.card.openingDate", { date: openedOn })}
                </Text>
              ) : null}
            </ScrollView>
          </Animated.View>
        </Animated.View>

        {/* ─── 3. Yükselen gül yaprakları ve ışıltılar ─── */}
        {reduceMotion
          ? null
          : Array.from({ length: PETAL_COUNT }, (_, index) => (
              <Petal key={index} index={index} progress={petals} screenW={screenW} screenH={screenH} />
            ))}

        {/* Ritüel zorunlu değil, ama dileyen o anı yeniden yaşayabilir */}
        {phase === "open" && !reduceMotion ? (
          <Pressable
            onPress={reseal}
            hitSlop={6}
            style={[
              styles.resealBtn,
              {
                top: insets.top + 12,
                backgroundColor: theme.isLight ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.12)",
                borderColor: theme.isLight ? theme.cardBorder : "rgba(255,255,255,0.18)",
              },
            ]}
            accessibilityRole="button"
          >
            <Text style={[styles.resealText, { color: theme.isLight ? theme.text : "#FFFFFF" }]}>
              {t("letters.reading.reseal")}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={close}
          hitSlop={10}
          style={[
            styles.closeBtn,
            {
              top: insets.top + 12,
              backgroundColor: theme.isLight ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.12)",
              borderColor: theme.isLight ? theme.cardBorder : "rgba(255,255,255,0.18)",
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.close")}
        >
          <X size={20} color={theme.isLight ? theme.text : "#FFFFFF"} />
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

/** Kalp damgalı, parlak mum mühür. Kırılınca iki yarısı dışa savrulur, mum kırıntıları saçılır. */
function WaxSeal({ crack }: { crack: SharedValue<number> }) {
  const reduceMotion = useReducedMotion();
  // Mühre basma isteği: kırılmadan önce hafifçe "nefes alır"
  const idle = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    idle.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(idle);
  }, [reduceMotion, idle]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: (0.18 + 0.22 * idle.get()) * (crack.get() > 0 ? 0 : 1),
    transform: [{ scale: 1.05 + 0.12 * idle.get() }],
  }));

  const leftStyle = useSealHalfStyle(-1, crack);
  const rightStyle = useSealHalfStyle(1, crack);

  return (
    <View style={styles.sealBox}>
      <Animated.View style={[styles.sealGlow, glowStyle]} />
      <Animated.View style={[styles.sealHalf, { left: 0 }, leftStyle]}>
        <SealFace offsetX={0} />
      </Animated.View>
      <Animated.View style={[styles.sealHalf, { left: SEAL_BOX / 2 }, rightStyle]}>
        <SealFace offsetX={-SEAL_BOX / 2} />
      </Animated.View>
      {[0, 1, 2, 3].map((index) => (
        <WaxCrumb key={index} index={index} crack={crack} />
      ))}
    </View>
  );
}

/** side: -1 sol yarı, +1 sağ yarı. Kırılınca dışa savrulur, dönerek düşer ve söner. */
function useSealHalfStyle(side: -1 | 1, crack: SharedValue<number>) {
  return useAnimatedStyle(() => {
    const c = crack.get();
    return {
      opacity: 1 - smoothstep(0.45, 1, c),
      transform: [
        { translateX: side * 26 * c },
        { translateY: 46 * c * c - 6 * c },
        { rotate: `${side * 34 * c}deg` },
      ],
    };
  });
}

const WAX = "#A3132F";
const WAX_DARK = "#740A20";
const WAX_BLOBS = [0, 52, 118, 170, 236, 300];

/** Mührün tamamı; yarım kutuda `offsetX` ile kaydırılarak sol ya da sağ yarısı görünür. */
function SealFace({ offsetX }: { offsetX: number }) {
  return (
    <View style={[styles.sealFace, { left: offsetX }]}>
      {/* Düzensiz mum kenarı */}
      {WAX_BLOBS.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <View
            key={deg}
            style={[
              styles.waxBlob,
              {
                left: SEAL_BOX / 2 + Math.cos(rad) * (SEAL / 2 - 3) - 7,
                top: SEAL_BOX / 2 + Math.sin(rad) * (SEAL / 2 - 3) - 7,
              },
            ]}
          />
        );
      })}
      <View style={styles.sealDisc}>
        <View style={styles.sealInner}>
          {/* Kabartma: açık bir gölge üstüne koyu damga */}
          <View style={styles.embossHighlight}>
            <Heart size={20} color="rgba(255, 190, 200, 0.45)" fill="rgba(255, 190, 200, 0.45)" />
          </View>
          <Heart size={20} color={WAX_DARK} fill={WAX_DARK} />
        </View>
        <View style={styles.sealGloss} />
      </View>
    </View>
  );
}

function WaxCrumb({ index, crack }: { index: number; crack: SharedValue<number> }) {
  const angle = ((-150 + index * 40) * Math.PI) / 180;
  const dist = 34 + (index % 2) * 14;
  const style = useAnimatedStyle(() => {
    const c = crack.get();
    return {
      opacity: c > 0 ? 1 - smoothstep(0.4, 0.9, c) : 0,
      transform: [
        { translateX: Math.cos(angle) * dist * c },
        { translateY: Math.sin(angle) * dist * c + 50 * c * c },
        { scale: 1 - 0.5 * c },
      ],
    };
  });
  return <Animated.View style={[styles.crumb, style]} />;
}

/** Kâğıt açılınca arkadan yükselen kuru gül yaprağı ya da ışıltı. */
function Petal({
  index,
  progress,
  screenW,
  screenH,
}: {
  index: number;
  progress: SharedValue<number>;
  screenW: number;
  screenH: number;
}) {
  const isSparkle = index % 3 === 2;
  const spec = useMemo(
    () => ({
      x: screenW * (0.12 + 0.76 * ((index * 0.37) % 1)),
      startY: screenH * (0.7 + 0.08 * (index % 3)),
      lift: screenH * (0.38 + 0.06 * (index % 4)),
      sway: 14 + (index % 3) * 8,
      spin: (index % 2 === 0 ? 1 : -1) * (120 + index * 25),
      delay: (index % 4) * 0.08,
      color: index % 2 === 0 ? "#C2576B" : "#D98A96",
    }),
    [index, screenW, screenH]
  );

  const style = useAnimatedStyle(() => {
    const raw = progress.get();
    const p = Math.min(1, Math.max(0, (raw - spec.delay) / (1 - spec.delay)));
    return {
      opacity: raw > 0 && raw < 1 ? interpolate(p, [0, 0.15, 0.7, 1], [0, 0.9, 0.7, 0], Extrapolation.CLAMP) : 0,
      transform: [
        { translateX: spec.x + Math.sin(p * Math.PI * 2.2 + index) * spec.sway },
        { translateY: spec.startY - spec.lift * p },
        { rotate: `${spec.spin * p}deg` },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.petalSlot, style]}>
      {isSparkle ? (
        <Sparkles size={16} color="#E6C055" />
      ) : (
        <View style={[styles.petal, { backgroundColor: spec.color }]} />
      )}
    </Animated.View>
  );
}

// ─── Zarf çizimi ─────────────────────────────────────────────────────────────────

const ENVELOPE = {
  inner: "#CDB591",
  frontTop: "#F3E6CC",
  frontBottom: "#E8D5B3",
  flapTop: "#F6EBD6",
  flapBottom: "#EAD8B8",
  fold: "rgba(120, 88, 52, 0.16)",
  edge: "rgba(110, 78, 45, 0.28)",
} as const;

/** Üçgen kapak, yuvarlatılmış uçla. "down": kapalı (uç aşağıda), "up": açık (uç yukarıda). */
function flapPath(w: number, h: number, direction: "up" | "down"): string {
  const tip = 16;
  if (direction === "down") {
    return `M0 0 L${w} 0 L${w / 2 + tip} ${h - tip * 0.7} Q${w / 2} ${h + 2} ${w / 2 - tip} ${h - tip * 0.7} Z`;
  }
  return `M0 ${h} L${w} ${h} L${w / 2 + tip} ${tip * 0.7} Q${w / 2} -2 ${w / 2 - tip} ${tip * 0.7} Z`;
}

/** Ön cep: üst kenarı V biçiminde kesik, alt köşeleri yuvarlatılmış gövde. */
function pocketPath(w: number, h: number): string {
  const r = 10;
  return `M0 0 L${w / 2} ${h * 0.54} L${w} 0 L${w} ${h - r} Q${w} ${h} ${w - r} ${h} L${r} ${h} Q0 ${h} 0 ${h - r} Z`;
}

interface PaperPalette {
  gradient: readonly [string, string, string];
  ink: string;
  inkSoft: string;
  rule: string;
  frame: string;
  shadow: string;
}

/** Fildişi parşömen. Koyu temalarda gece gözü yormasın diye bir ton daha loş. */
function paperPalette(theme: AppTheme): PaperPalette {
  const base = {
    ink: "#3B2A2E",
    inkSoft: "#7A6460",
    rule: "rgba(150, 110, 70, 0.22)",
    frame: "rgba(150, 110, 70, 0.2)",
    shadow: theme.isLight ? "#9F7A4A" : "#000000",
  };
  return theme.isLight
    ? { ...base, gradient: ["#FFFDF6", "#FBF3E2", "#F4E7CE"] }
    : { ...base, gradient: ["#F3EBDC", "#EADFCA", "#DFD1B6"] };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  /* ZARF */
  envelope: {
    position: "absolute",
  },
  envelopeBack: {
    position: "absolute",
    left: 0,
    top: 0,
    borderRadius: 10,
    backgroundColor: ENVELOPE.inner,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 10,
  },
  backFlap: {
    position: "absolute",
    left: 0,
    transformOrigin: "bottom",
  },
  frontFlap: {
    position: "absolute",
    left: 0,
    top: 0,
    transformOrigin: "top",
  },
  peek: {
    position: "absolute",
    left: 14,
    top: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 9,
  },
  peekPaper: {
    borderRadius: 6,
  },
  peekTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 14,
    marginBottom: 4,
  },
  peekLine: {
    height: 3,
    borderRadius: 2,
  },

  /* MUM MÜHÜR */
  sealHit: {
    position: "absolute",
    width: SEAL_BOX,
    height: SEAL_BOX,
  },
  sealBox: {
    width: SEAL_BOX,
    height: SEAL_BOX,
  },
  sealGlow: {
    position: "absolute",
    left: 0,
    top: 0,
    width: SEAL_BOX,
    height: SEAL_BOX,
    borderRadius: SEAL_BOX / 2,
    backgroundColor: "#FFD27A",
  },
  sealHalf: {
    position: "absolute",
    top: 0,
    width: SEAL_BOX / 2,
    height: SEAL_BOX,
    overflow: "hidden",
  },
  sealFace: {
    position: "absolute",
    top: 0,
    width: SEAL_BOX,
    height: SEAL_BOX,
  },
  waxBlob: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: WAX,
  },
  sealDisc: {
    position: "absolute",
    left: (SEAL_BOX - SEAL) / 2,
    top: (SEAL_BOX - SEAL) / 2,
    width: SEAL,
    height: SEAL,
    borderRadius: SEAL / 2,
    backgroundColor: WAX,
    borderWidth: 2.5,
    borderColor: WAX_DARK,
    alignItems: "center",
    justifyContent: "center",
  },
  sealInner: {
    width: SEAL - 18,
    height: SEAL - 18,
    borderRadius: (SEAL - 18) / 2,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  embossHighlight: {
    position: "absolute",
    top: 11,
    left: 11,
  },
  sealGloss: {
    position: "absolute",
    top: 7,
    left: 12,
    width: 16,
    height: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.32)",
    transform: [{ rotate: "-28deg" }],
  },
  crumb: {
    position: "absolute",
    left: SEAL_BOX / 2 - 3,
    top: SEAL_BOX / 2 - 3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: WAX,
  },
  hint: {
    position: "absolute",
    left: 24,
    right: 24,
    textAlign: "center",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },

  /* MEKTUP KÂĞIDI */
  sheet: {
    position: "absolute",
    borderRadius: 14,
    transformOrigin: "top",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 16,
  },
  sheetPaper: {
    borderRadius: 14,
  },
  sheetFrame: {
    position: "absolute",
    top: 9,
    left: 9,
    right: 9,
    bottom: 9,
    borderRadius: 9,
    borderWidth: 1,
  },
  sheetContent: {
    flex: 1,
  },
  sheetScroll: {
    paddingHorizontal: 28,
    paddingTop: 30,
    paddingBottom: 36,
  },
  senderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  senderText: {
    flex: 1,
  },
  senderName: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  senderDate: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  ornament: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 20,
  },
  ornamentLine: {
    flex: 1,
    height: 1,
  },
  letterTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontFamily: "PlayfairDisplay_700Bold",
    marginBottom: 14,
  },
  letterBody: {
    fontSize: 16,
    lineHeight: 27,
    fontFamily: "Inter_400Regular",
  },
  signature: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    textAlign: "right",
    marginTop: 28,
  },
  footerNote: {
    fontSize: 11.5,
    fontFamily: "Inter_500Medium",
    textAlign: "right",
    marginTop: 10,
  },

  /* YAPRAKLAR */
  petalSlot: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  petal: {
    width: 11,
    height: 15,
    borderTopLeftRadius: 11,
    borderBottomRightRadius: 11,
    borderTopRightRadius: 2,
    borderBottomLeftRadius: 2,
    opacity: 0.9,
  },

  resealBtn: {
    position: "absolute",
    right: 16 + 40 + 8,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  resealText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  closeBtn: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
