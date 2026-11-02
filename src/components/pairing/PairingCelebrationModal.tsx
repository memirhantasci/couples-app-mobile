import { useCallback, useEffect, useMemo, useRef } from "react";
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
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
import { Heart } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { useTheme } from "@/context/ThemeContext";
import { smoothstep } from "@/lib/bezier";
import { hapticHeartbeat, playCelebration } from "@/lib/soundEffects";

// Skia yalnızca native modül mevcutsa yüklenir (Expo Go vb. ortamlarda çökmesin);
// yoksa kutlama ışık bağı, yıldız tozu ve ∞ halkası olmadan avatar ve kalplerle oynar.
let SkiaLib: typeof import("@shopify/react-native-skia") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@shopify/react-native-skia");
  if (mod?.Skia && mod?.Canvas) SkiaLib = mod;
} catch {
  SkiaLib = null;
}

export interface PairingCelebrationModalProps {
  visible: boolean;
  myName?: string | null;
  partnerName?: string | null;
  myAvatarUrl?: string | null;
  partnerAvatarUrl?: string | null;
  /** Animasyon bittiğinde (ya da dokunularak geçildiğinde) tam bir kez çağrılır. */
  onComplete: () => void;
}

// ─── Zaman Çizelgesi (ms) ───────────────────────────────────────────────────────
// 0.0 sn  arka plan kararır, avatarlar ekranın iki yanından süzülür
// 0.5 sn  manyetik çekim: aralarında ışık bağı titreşir, iki kalp atışı titreşimi
// 1.25 sn avatarlar merkezde çarpışır, jöle gibi esner
// 1.33 sn yıldız tozu, minik kalpler ve şok halkası patlar, arp glissandosu çalar
// 1.6 sn  birleşen avatarların çevresinde ∞ çizilir, başlık belirir
// 3.2 sn  sahne söner → onComplete
const T = {
  scrimIn: 400,
  glideIn: 420,
  pullDelay: 450,
  pullDuration: 800,
  impact: 1250,
  burstDelay: 1330,
  burstDuration: 1150,
  infinityDelay: 1600,
  infinityDuration: 1250,
  titleDelay: 1650,
  subtitleDelay: 1850,
  exitDelay: 3200,
  exitDuration: 380,
} as const;
const HEARTBEATS_AT = [500, 950] as const;
const REDUCED_HOLD_MS = 2000;

const AVATAR = 88;
/** Birleşince avatar merkezlerinin sahne merkezine uzaklığı (≈%18 üst üste biner). */
const MERGED_X = AVATAR * 0.41;
const STAGE_H = 470;
const STAGE_CY = STAGE_H * 0.42;
const HEART_COUNT = 8;
const DUST_COUNT = 30;

const GOLD = "#F5C563";
const PINK = "#FF85A1";

/** Parçacıklar her gösterimde aynı dağılsın diye sabit tohumlu sözde rastgele sayı (0..1). */
function seeded(index: number, salt: number): number {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function PairingCelebrationModal({ visible, ...rest }: PairingCelebrationModalProps) {
  // İçerik yalnızca görünürken mount edilir: her gösterim sıfırdan, temiz durumla başlar
  if (!visible) return null;
  return <CelebrationScene {...rest} />;
}

function CelebrationScene({
  myName,
  partnerName,
  myAvatarUrl,
  partnerAvatarUrl,
  onComplete,
}: Omit<PairingCelebrationModalProps, "visible">) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const centerX = screenW / 2;
  // Ekranın dışından başlar, yarı yolda kısa bir "süzülme" noktasına gelir, sonra birleşir
  const startX = centerX + AVATAR;
  const hoverX = screenW * 0.3;
  // ∞'un iki ilmeği birleşen çiftin iki yanını sarar; dar ekranda kenara taşmaz
  const infinityA = Math.min(AVATAR * 1.9, (screenW - 36) / 2);

  const scrim = useSharedValue(0);
  const approach = useSharedValue(0);
  const squash = useSharedValue(0);
  const heartPop = useSharedValue(0);
  const burst = useSharedValue(0);
  const bloom = useSharedValue(0);
  const orbit = useSharedValue(0);
  const title = useSharedValue(0);
  const subtitle = useSharedValue(0);
  const exit = useSharedValue(0);
  const clock = useSharedValue(0);
  const completed = useSharedValue(false);

  /** Avatar merkezlerinin sahne merkezine yatay uzaklığı. */
  const spread = useDerivedValue(() =>
    interpolate(approach.get(), [0, 0.5, 1], [startX, hoverX, MERGED_X], Extrapolation.CLAMP)
  );

  // Ekran arkada yeniden çizildikçe (ör. eşleşme yoklaması) yeni bir onComplete gelse de
  // zaman çizelgesi baştan başlamasın: en güncel geri çağrı ref'ten okunur
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const finish = useCallback(() => {
    if (completed.get()) return;
    completed.set(true);
    onCompleteRef.current();
  }, [completed]);

  useEffect(() => {
    // Güvenlik ağı: animasyon geri çağrısı gelmezse eşleşme akışı yine de devam etsin
    const safety = setTimeout(finish, T.exitDelay + T.exitDuration + 1500);

    if (reduceMotion) {
      // Hareket azaltma: sahne doğrudan son karesiyle belirir, kısa bir bekleme ve solma
      approach.set(1);
      heartPop.set(1);
      bloom.set(0.5);
      orbit.set(1);
      title.set(1);
      subtitle.set(1);
      scrim.set(withTiming(1, { duration: 200 }));
      exit.set(
        withDelay(
          REDUCED_HOLD_MS,
          withTiming(1, { duration: 250 }, (done) => {
            "worklet";
            if (done) scheduleOnRN(finish);
          })
        )
      );
      const sound = setTimeout(() => playCelebration(), 200);
      return () => {
        clearTimeout(safety);
        clearTimeout(sound);
      };
    }

    scrim.set(withTiming(1, { duration: T.scrimIn, easing: Easing.out(Easing.quad) }));
    clock.set(withTiming(1, { duration: T.exitDelay + T.exitDuration, easing: Easing.linear }));
    // Önce süzülerek gelir, ardından hızlanarak birbirine çekilir (mıknatıs hissi)
    approach.set(
      withSequence(
        withTiming(0.5, { duration: T.glideIn, easing: Easing.out(Easing.cubic) }),
        withDelay(
          T.pullDelay - T.glideIn,
          withTiming(1, { duration: T.pullDuration, easing: Easing.in(Easing.cubic) })
        )
      )
    );
    // Çarpışma: kısa bir sıkışma, ardından yaylı jöle esnemesi
    squash.set(
      withDelay(
        T.impact,
        withSequence(withTiming(1, { duration: 70 }), withSpring(0, { damping: 10, stiffness: 120 }))
      )
    );
    heartPop.set(withDelay(T.impact + 60, withSpring(1, { damping: 9, stiffness: 160 })));
    bloom.set(
      withDelay(
        T.impact,
        withSequence(withTiming(1, { duration: 180 }), withTiming(0.5, { duration: 900 }))
      )
    );
    burst.set(
      withDelay(T.burstDelay, withTiming(1, { duration: T.burstDuration, easing: Easing.linear }))
    );
    orbit.set(
      withDelay(
        T.infinityDelay,
        withTiming(1.7, { duration: T.exitDelay - T.infinityDelay, easing: Easing.inOut(Easing.quad) })
      )
    );
    title.set(withDelay(T.titleDelay, withSpring(1, { damping: 14, stiffness: 140 })));
    subtitle.set(withDelay(T.subtitleDelay, withTiming(1, { duration: 420 })));
    exit.set(
      withDelay(
        T.exitDelay,
        withTiming(1, { duration: T.exitDuration, easing: Easing.in(Easing.quad) }, (done) => {
          "worklet";
          if (done) scheduleOnRN(finish);
        })
      )
    );

    const timers = [
      ...HEARTBEATS_AT.map((at) => setTimeout(() => hapticHeartbeat(), at)),
      setTimeout(() => playCelebration(), T.burstDelay),
    ];
    return () => {
      clearTimeout(safety);
      timers.forEach(clearTimeout);
      cancelAnimation(scrim);
      cancelAnimation(clock);
      cancelAnimation(approach);
      cancelAnimation(squash);
      cancelAnimation(heartPop);
      cancelAnimation(bloom);
      cancelAnimation(burst);
      cancelAnimation(orbit);
      cancelAnimation(title);
      cancelAnimation(subtitle);
      cancelAnimation(exit);
    };
  }, [reduceMotion, scrim, clock, approach, squash, heartPop, bloom, burst, orbit, title, subtitle, exit, finish]);

  // Dokununca hemen sona sar: sahne hızla söner, ardından onComplete
  const skip = useCallback(() => {
    cancelAnimation(exit);
    exit.set(
      withTiming(1, { duration: 200 }, (done) => {
        "worklet";
        if (done) scheduleOnRN(finish);
      })
    );
  }, [exit, finish]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.get() }));
  const stageStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.get() }));

  const leftAvatarStyle = useAvatarStyle(-1, spread, approach, squash);
  const rightAvatarStyle = useAvatarStyle(1, spread, approach, squash);

  const heartStyle = useAnimatedStyle(() => {
    const p = heartPop.get();
    return { opacity: Math.min(1, p * 2), transform: [{ scale: p }] };
  });

  const titleStyle = useAnimatedStyle(() => {
    const p = title.get();
    return {
      opacity: Math.min(1, p),
      transform: [{ translateY: (1 - p) * 16 }, { scale: 0.94 + 0.06 * p }],
    };
  });
  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitle.get(),
    transform: [{ translateY: (1 - subtitle.get()) * 8 }],
  }));

  const meLabel = myName?.trim() || t("common.you");
  const partnerLabel = partnerName?.trim() || t("common.partnerFallback");

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

        <Animated.View pointerEvents="none" style={[styles.stage, { width: screenW }, stageStyle]}>
          {SkiaLib ? (
            <CelebrationCanvas
              width={screenW}
              centerX={centerX}
              infinityA={infinityA}
              accent={theme.accent}
              spread={spread}
              approach={approach}
              burst={burst}
              bloom={bloom}
              orbit={orbit}
              clock={clock}
              showComet={!reduceMotion}
            />
          ) : null}

          {Array.from({ length: HEART_COUNT }, (_, index) => (
            <BurstHeart key={index} index={index} burst={burst} centerX={centerX} accent={theme.accent} />
          ))}

          <Animated.View style={[styles.avatarSlot, { left: centerX - AVATAR / 2 }, leftAvatarStyle]}>
            <UserAvatar uri={myAvatarUrl} name={myName} size={AVATAR} borderColor="#FFFFFF" borderWidth={3} />
          </Animated.View>
          <Animated.View style={[styles.avatarSlot, { left: centerX - AVATAR / 2 }, rightAvatarStyle]}>
            <UserAvatar uri={partnerAvatarUrl} name={partnerName} size={AVATAR} borderColor="#FFFFFF" borderWidth={3} />
          </Animated.View>

          <Animated.View
            style={[styles.heartBadge, { left: centerX - HEART_BADGE / 2, backgroundColor: theme.accent }, heartStyle]}
          >
            <Heart size={17} color="#FFFFFF" fill="#FFFFFF" />
          </Animated.View>

          <View style={styles.titleBlock}>
            <Animated.Text style={[styles.title, titleStyle]} accessibilityRole="header">
              {t("setup.pairing.celebration.title")}
            </Animated.Text>
            <Animated.Text style={[styles.subtitle, subtitleStyle]} numberOfLines={1}>
              {t("setup.pairing.celebration.names", { me: meLabel, partner: partnerLabel })}
            </Animated.Text>
          </View>
        </Animated.View>

        {/* Ekrana dokunarak kutlama geçilebilir */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={skip}
          accessibilityRole="button"
          accessibilityLabel={t("setup.pairing.celebration.skip")}
        />
      </View>
    </Modal>
  );
}

/** side: -1 sol (ben), +1 sağ (partner). Yaklaşırken birbirine eğilir, çarpışınca jöle gibi esner. */
function useAvatarStyle(
  side: -1 | 1,
  spread: SharedValue<number>,
  approach: SharedValue<number>,
  squash: SharedValue<number>
) {
  return useAnimatedStyle(() => {
    const s = squash.get();
    const lean = interpolate(approach.get(), [0.5, 0.92, 1], [0, 1, 0], Extrapolation.CLAMP);
    return {
      transform: [
        // Sıkışırken birbirine biraz daha gömülür, yay geri tepince ayrılır
        { translateX: side * (spread.get() - AVATAR * 0.05 * s) },
        { rotate: `${-side * 7 * lean}deg` },
        { scaleX: 1 - 0.14 * s },
        { scaleY: 1 + 0.1 * s },
      ],
    };
  });
}

/** Çarpışma noktasından yukarı doğru yelpaze gibi açılan minik kalp. */
function BurstHeart({
  index,
  burst,
  centerX,
  accent,
}: {
  index: number;
  burst: SharedValue<number>;
  centerX: number;
  accent: string;
}) {
  const spec = useMemo(() => {
    const angle = ((-90 + (index - (HEART_COUNT - 1) / 2) * 23 + (seeded(index, 1) - 0.5) * 14) * Math.PI) / 180;
    return {
      dx: Math.cos(angle),
      dy: Math.sin(angle),
      dist: 110 + seeded(index, 2) * 70,
      spin: (seeded(index, 3) - 0.5) * 70,
      size: 11 + Math.round(seeded(index, 4) * 7),
      color: index % 3 === 0 ? GOLD : index % 3 === 1 ? PINK : accent,
    };
  }, [index, accent]);

  const style = useAnimatedStyle(() => {
    const p = burst.get();
    const travel = 1 - Math.pow(1 - p, 3);
    return {
      opacity: p > 0 ? smoothstep(0, 0.08, p) * (1 - smoothstep(0.55, 1, p)) : 0,
      transform: [
        { translateX: spec.dx * spec.dist * travel },
        // Kalpler süzülür: yerçekimi yerine hafif bir kaldırma
        { translateY: spec.dy * spec.dist * travel - 18 * p },
        { rotate: `${spec.spin * p}deg` },
        { scale: 0.5 + 0.6 * smoothstep(0, 0.25, p) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.particle, { left: centerX - spec.size / 2, top: STAGE_CY - spec.size / 2 }, style]}>
      <Heart size={spec.size} color={spec.color} fill={spec.color} />
    </Animated.View>
  );
}

interface CelebrationCanvasProps {
  width: number;
  centerX: number;
  infinityA: number;
  accent: string;
  spread: SharedValue<number>;
  approach: SharedValue<number>;
  burst: SharedValue<number>;
  bloom: SharedValue<number>;
  orbit: SharedValue<number>;
  clock: SharedValue<number>;
  showComet: boolean;
}

/** Skia katmanı: avatarlar arası ışık bağı, birleşme ışıması, yıldız tozu, şok halkası ve ∞ halkası. */
function CelebrationCanvas({
  width,
  centerX,
  infinityA,
  accent,
  spread,
  approach,
  burst,
  bloom,
  orbit,
  clock,
  showComet,
}: CelebrationCanvasProps) {
  const Skia = SkiaLib!;
  const cy = STAGE_CY;

  // ∞ (Bernoulli lemniskatı): çizim ve üzerinde dolaşan ışık aynı noktaları kullanır.
  // Her noktanın yol uzunluğuna göre konumu (f) ışığın çizgi ucuyla birlikte gitmesini sağlar.
  const infinity = useMemo(() => {
    const steps = 120;
    const raw: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * Math.PI * 2;
      const sin = Math.sin(theta);
      const cos = Math.cos(theta);
      const k = 1 + sin * sin;
      raw.push({ x: centerX + (infinityA * cos) / k, y: cy + (infinityA * sin * cos) / k });
    }
    const lengths = [0];
    for (let i = 1; i < raw.length; i++) {
      lengths.push(lengths[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y));
    }
    const total = lengths[lengths.length - 1];
    const track = raw.map((p, i) => ({ x: p.x, y: p.y, f: lengths[i] / total }));
    const svg = raw.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    return { svg, track };
  }, [centerX, infinityA, cy]);

  // Yıldız tozu: üç renk grubu, her biri tek bir Points çizimi (parçacık başına bileşen yok)
  const dust = useMemo(() => {
    const groups: { dx: number; dy: number; dist: number }[][] = [[], [], []];
    for (let i = 0; i < DUST_COUNT; i++) {
      const angle = (i / DUST_COUNT) * Math.PI * 2 + seeded(i, 5) * 0.5;
      groups[i % 3].push({
        dx: Math.cos(angle),
        dy: Math.sin(angle),
        dist: 90 + seeded(i, 6) * 120,
      });
    }
    return groups;
  }, []);

  // Skia noktaları worklet'ten düz { x, y } nesnesi olarak verilir
  const p1 = useDerivedValue(() => ({ x: centerX - spread.get() + AVATAR / 2, y: cy }));
  const p2 = useDerivedValue(() => ({ x: centerX + spread.get() - AVATAR / 2, y: cy }));
  const strandOpacity = useDerivedValue(() => {
    const visible = interpolate(approach.get(), [0.5, 0.6, 0.92, 1], [0, 1, 1, 0], Extrapolation.CLAMP);
    // Işık bağı titreşir: hızlı, düzensiz bir parıltı
    const c = clock.get() * 40;
    const shimmer = 0.62 + 0.25 * Math.sin(c * 1.7) + 0.13 * Math.sin(c * 4.3);
    return visible * shimmer;
  });

  const bloomOpacity = useDerivedValue(() => bloom.get());

  const dustProjector = (group: { dx: number; dy: number; dist: number }[]) => {
    "worklet";
    const p = burst.get();
    const travel = 1 - Math.pow(1 - p, 3);
    return group.map((d) => ({
      x: centerX + d.dx * d.dist * travel,
      y: cy + d.dy * d.dist * travel + 34 * p * p,
    }));
  };
  const goldDust = useDerivedValue(() => dustProjector(dust[0]));
  const pinkDust = useDerivedValue(() => dustProjector(dust[1]));
  const whiteDust = useDerivedValue(() => dustProjector(dust[2]));
  const dustOpacity = useDerivedValue(() => {
    const p = burst.get();
    return p > 0 ? 1 - smoothstep(0.5, 1, p) : 0;
  });

  const shockR = useDerivedValue(() => 20 + 175 * (1 - Math.pow(1 - burst.get(), 3)));
  const shockOpacity = useDerivedValue(() => {
    const p = burst.get();
    return p > 0 ? 0.75 * (1 - p) : 0;
  });
  const shockWidth = useDerivedValue(() => 0.6 + 3.4 * (1 - burst.get()));

  const infinityEnd = useDerivedValue(() => Math.min(1, orbit.get()));
  const infinityOpacity = useDerivedValue(() => {
    const o = orbit.get();
    // Çizim bitince hafifçe "nefes alan" bir ışıma
    const breathe = o >= 1 ? 0.85 + 0.15 * Math.sin((o - 1) * Math.PI * 4) : 1;
    return smoothstep(0, 0.08, o) * breathe;
  });

  const track = infinity.track;
  const comet = useDerivedValue(() => {
    const u = orbit.get() % 1;
    let i = 1;
    while (i < track.length - 1 && track[i].f < u) i++;
    const a = track[i - 1];
    const b = track[i];
    const span = b.f - a.f || 1;
    const k = (u - a.f) / span;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  });
  const cometOpacity = useDerivedValue(() => {
    const o = orbit.get();
    return o > 0 && o < 1.7 ? smoothstep(0, 0.06, o) * (1 - smoothstep(1.5, 1.7, o)) : 0;
  });

  return (
    <Skia.Canvas style={{ position: "absolute", left: 0, top: 0, width, height: STAGE_H }} pointerEvents="none">
      {/* Birleşme ışıması: çiftin arkasında yumuşak bir hale */}
      <Skia.Circle cx={centerX} cy={cy} r={AVATAR * 1.45} opacity={bloomOpacity}>
        <Skia.RadialGradient
          c={{ x: centerX, y: cy }}
          r={AVATAR * 1.45}
          colors={[`${accent}AA`, `${accent}33`, `${accent}00`]}
          positions={[0, 0.55, 1]}
        />
      </Skia.Circle>

      {/* ∞ halkası: geniş pembe ışıma + ince altın çizgi */}
      <Skia.Group opacity={infinityOpacity}>
        <Skia.Path
          path={infinity.svg}
          start={0}
          end={infinityEnd}
          style="stroke"
          strokeWidth={9}
          strokeCap="round"
          strokeJoin="round"
          color={accent}
          opacity={0.55}
        >
          <Skia.BlurMask blur={8} style="normal" />
        </Skia.Path>
        <Skia.Path
          path={infinity.svg}
          start={0}
          end={infinityEnd}
          style="stroke"
          strokeWidth={2.4}
          strokeCap="round"
          strokeJoin="round"
          color={GOLD}
        />
      </Skia.Group>
      {showComet ? (
        <Skia.Group opacity={cometOpacity}>
          <Skia.Circle c={comet} r={9} color={GOLD} opacity={0.6}>
            <Skia.BlurMask blur={7} style="normal" />
          </Skia.Circle>
          <Skia.Circle c={comet} r={3.2} color="#FFFFFF" />
        </Skia.Group>
      ) : null}

      {/* Manyetik çekim sırasında avatarlar arasında titreşen ışık bağı */}
      <Skia.Group opacity={strandOpacity}>
        <Skia.Line p1={p1} p2={p2} color={PINK} strokeWidth={7} strokeCap="round" style="stroke">
          <Skia.BlurMask blur={6} style="normal" />
        </Skia.Line>
        <Skia.Line p1={p1} p2={p2} color="#FFF4D6" strokeWidth={1.6} strokeCap="round" style="stroke" />
      </Skia.Group>

      {/* Çarpışma: şok halkası ve dışa saçılan yıldız tozu */}
      <Skia.Circle
        cx={centerX}
        cy={cy}
        r={shockR}
        style="stroke"
        strokeWidth={shockWidth}
        color={GOLD}
        opacity={shockOpacity}
      />
      <Skia.Group opacity={dustOpacity}>
        <Skia.Points points={goldDust} mode="points" strokeWidth={4} strokeCap="round" color={GOLD} />
        <Skia.Points points={pinkDust} mode="points" strokeWidth={3.4} strokeCap="round" color={PINK} />
        <Skia.Points points={whiteDust} mode="points" strokeWidth={2.4} strokeCap="round" color="#FFFFFF" />
      </Skia.Group>
    </Skia.Canvas>
  );
}

const HEART_BADGE = 36;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrim: {
    backgroundColor: "rgba(8, 5, 14, 0.95)",
  },
  stage: {
    height: STAGE_H,
  },
  avatarSlot: {
    position: "absolute",
    top: STAGE_CY - AVATAR / 2,
    width: AVATAR,
    height: AVATAR,
  },
  heartBadge: {
    position: "absolute",
    top: STAGE_CY - HEART_BADGE / 2,
    width: HEART_BADGE,
    height: HEART_BADGE,
    borderRadius: HEART_BADGE / 2,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  particle: {
    position: "absolute",
  },
  titleBlock: {
    position: "absolute",
    top: STAGE_CY + AVATAR / 2 + 52,
    left: 24,
    right: 24,
    alignItems: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontFamily: "PlayfairDisplay_700Bold",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
    textAlign: "center",
  },
});
