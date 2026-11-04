import { useEffect, useRef, useState } from "react";
import { Image, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
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
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { PlayfairDisplay_400Regular_Italic } from "@expo-google-fonts/playfair-display/400Regular_Italic";
import { useAuth } from "@/context/AuthContext";
import { useLanguageReady } from "@/hooks/useLanguageReady";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { getHapticFeedbackEnabled, hapticStamp, hapticTap } from "@/lib/soundEffects";

// ─── Açılış Animasyonu: "İki ruh, tek gökyüzü" ─────────────────────────────────
// İlk kare native splash'ın (app.json → expo-splash-screen) birebir aynısıdır: koyu zemin, ortada logo.
// Native splash ancak bu kare çizildikten sonra, üstte kısa bir solmayla kalkar; arada göz kırpması olmaz.
// Gökyüzü kararır, iki yıldız iki yandan kavis çizerek süzülür ve logodaki parıltının olduğu noktada
// birleşir: parlama, titreşim, dışa yayılan kırmızı şok dalgası; logo yeniden ışır.
// Kurulumdan sonraki ilk açılışta tam sürüm, sonraki soğuk açılışlarda kısa sürüm oynar. Sıcak açılışta
// (arka plandan dönüş) JS ağacı yeniden kurulmadığından hiç oynamaz.
// Oturum ve dil bu sırada arka planda çözülür; perde ancak ikisi de bitince (animasyon + oturum) solar.

/** Native splash'ın kalkarken solma süresi (kök layout `SplashScreen.setOptions` ile uygular). */
export const NATIVE_SPLASH_FADE_MS = 220;

const FULL_SEEN_KEY = "@has_seen_full_splash";
/** Oturum çözümü takılırsa (ör. çok yavaş ağ) perde en geç bu sürede kalkar. */
const MAX_WAIT_MS = 4000;
/** Logo görselinin yüklendi bildirimi gelmezse native splash yine de bu sürede kalkar. */
const IMAGE_FALLBACK_MS = 800;
const REDUCED_EXIT_MS = 260;

// Native splash ile birebir aynı ölçüler (app.json: backgroundColor, imageWidth)
const BG = "#0A0A0C";
const LOGO = 220;
/** Android 12+ splash ikonu 192dp çaplı bir daireyle maskeler; ilk karede aynı kesit gösterilir. */
const ANDROID_MASK = 192;
const ANDROID_MASK_RING = 26;
const HAS_ANDROID_MASK = Platform.OS === "android" && Platform.Version >= 31;
/** Logodaki parıltının merkeze uzaklığı (512px görselde ≈(310, 205) → 220dp ölçeğinde). */
const MERGE = { x: 23, y: -22 } as const;

const RED = "#C8213F";

interface Timeline {
  dimAt: number;
  dimDuration: number;
  /** Kararınca logonun opaklığı ve ölçeği. */
  dimOpacity: number;
  dimScale: number;
  starsAt: number;
  starsInDuration: number;
  travelAt: number;
  travelDuration: number;
  /** Yıldızların başlangıç uzaklığı (tam yolun oranı). */
  spread: number;
  waveScale: number;
  waveDuration: number;
  /** Logonun ardındaki kırmızı halenin yoğunluğu. */
  bloom: number;
  skyStars: boolean;
  wordmarkAt: number | null;
  /** Animasyonun en kısa süresi; oturum da hazırsa perde bu anda solmaya başlar. */
  end: number;
  exitDuration: number;
  haptic: () => Promise<void>;
}

// ─── Zaman Çizelgesi (ms, native splash kalktıktan sonra) ─────────────────────
// Tam sürüm (ilk açılış):
// 0.0 sn   ilk kare = native splash; native splash üstte solarak kalkar
// 0.12 sn  arka planda yıldız tozu belirir
// 0.2 sn   logo kararır ve hafifçe geri çekilir
// 0.3 sn   iki yıldız iki yandan zıt kavisler çizerek süzülür
// 1.18 sn  logodaki parıltıda birleşirler: parlama, titreşim, kırmızı şok dalgası, logo yeniden ışır
// 1.38 sn  "CoupleSky" yazısı yükselerek belirir
// 1.9 sn   oturum da hazırsa perde solarak uygulamaya geçer
const FULL: Timeline = {
  dimAt: 200,
  dimDuration: 520,
  dimOpacity: 0.3,
  dimScale: 0.94,
  starsAt: 240,
  starsInDuration: 300,
  travelAt: 300,
  travelDuration: 880,
  spread: 1,
  waveScale: 4,
  waveDuration: 820,
  bloom: 1,
  skyStars: true,
  wordmarkAt: 1380,
  end: 1900,
  exitDuration: 420,
  haptic: hapticStamp,
};

// Kısa sürüm (sonraki soğuk açılışlar): aynı hikâye, yıldızlar logonun hemen yanından başlar
// 0.47 sn birleşme, 0.76 sn perde solar
const SHORT: Timeline = {
  dimAt: 60,
  dimDuration: 260,
  dimOpacity: 0.55,
  dimScale: 0.97,
  starsAt: 80,
  starsInDuration: 140,
  travelAt: 110,
  travelDuration: 360,
  spread: 0.26,
  waveScale: 2.6,
  waveDuration: 560,
  bloom: 0.6,
  skyStars: false,
  wordmarkAt: null,
  end: 760,
  exitDuration: 320,
  haptic: hapticTap,
};

/** Yavaş başlar, birleşme noktasına tam durmadan varır (hafif çarpışma hissi). */
const TRAVEL_EASING = Easing.bezier(0.42, 0, 0.78, 0.92);

interface StarPath {
  /** Birleşme noktasına göre; x ekran genişliğinin oranı, y dp. */
  from: { x: number; y: number };
  via: { x: number; y: number };
  core: string;
  glow: string;
}

// Biri sol alttan yukarı kavisle, diğeri sağ üstten aşağı kavisle gelir: zıt yönlerden birbirine dolanırlar
const STARS: readonly StarPath[] = [
  {
    from: { x: -0.42, y: 120 },
    via: { x: -0.3, y: -90 },
    core: "#FFF4E2",
    glow: "0px 0px 8px 2px rgba(255, 232, 200, 0.95), 0px 0px 22px 6px rgba(255, 190, 140, 0.4)",
  },
  {
    from: { x: 0.36, y: -150 },
    via: { x: 0.36, y: 70 },
    core: "#FFE8F0",
    glow: "0px 0px 8px 2px rgba(255, 214, 228, 0.95), 0px 0px 22px 6px rgba(232, 72, 108, 0.5)",
  },
];
const STAR_SIZE = 6;
/**
 * Yıldızın ardındaki iz noktaları: yol üzerinde biraz geriden gelir, küçülerek söner.
 * Çizim sırasıyla: kuyruk önce, baş (lag 0) en son ki izlerin üstünde kalsın.
 */
const TRAIL = [
  { lag: 0.11, size: 0.5, opacity: 0.16 },
  { lag: 0.07, size: 0.65, opacity: 0.3 },
  { lag: 0.035, size: 0.8, opacity: 0.5 },
  { lag: 0, size: 1, opacity: 1 },
] as const;

const SKY_COUNT = 22;

/** Yıldız tozu her açılışta aynı dağılsın diye sabit tohumlu sözde rastgele sayı (0..1). */
function seeded(index: number, salt: number): number {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const SKY = Array.from({ length: SKY_COUNT }, (_, i) => ({
  left: `${(seeded(i, 1) * 100).toFixed(2)}%` as `${number}%`,
  top: `${(seeded(i, 2) * 100).toFixed(2)}%` as `${number}%`,
  size: 1 + seeded(i, 3) * 1.8,
  base: 0.25 + seeded(i, 4) * 0.55,
  freq: 0.5 + seeded(i, 5),
  phase: seeded(i, 6) * Math.PI * 2,
}));

/** Aynı JS oturumunda perde bir kez oynar (ör. Android etkinliği yeniden yaratılınca tekrar oynamasın). */
const launchState = { completed: false };

/**
 * Soğuk açılışta native splash'ı devralan açılış perdesi. Ağacın en üstünde, tüm host'lardan sonra çizilir;
 * native splash'ı gizlemek yalnızca bu bileşenin işidir.
 */
export function LaunchAnimation() {
  const [skip] = useState(() => launchState.completed);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (skip) SplashScreen.hide();
  }, [skip]);

  if (skip || finished) return null;
  return <LaunchScene onFinished={() => setFinished(true)} />;
}

function LaunchScene({ onFinished }: { onFinished: () => void }) {
  const { isLoading } = useAuth();
  const languageReady = useLanguageReady();
  const [fontLoaded] = useFonts({ PlayfairDisplay_400Regular_Italic });
  const reduceMotion = useReducedMotion();
  const { width: screenW } = useWindowDimensions();

  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [animDone, setAnimDone] = useState(false);
  const [capReached, setCapReached] = useState(false);

  const progress = useSharedValue(0);
  const clock = useSharedValue(0);
  const sky = useSharedValue(0);
  const dim = useSharedValue(0);
  const starsIn = useSharedValue(0);
  const travel = useSharedValue(0);
  const merged = useSharedValue(0);
  const burst = useSharedValue(0);
  const pop = useSharedValue(0);
  const wave = useSharedValue(0);
  const echo = useSharedValue(0);
  const bloom = useSharedValue(0);
  const mask = useSharedValue(0);
  const wordmark = useSharedValue(0);
  const fontGate = useSharedValue(0);
  const exit = useSharedValue(0);

  // Promise.all([oturum + dil, en kısa animasyon süresi]): ikisi de bitmeden perde kalkmaz
  const ready = !isLoading && languageReady;
  const canExit = capReached || (started && (animDone || reduceMotion) && ready);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(FULL_SEEN_KEY).then((seen) => {
      if (active) setTimeline(seen ? SHORT : FULL);
    });
    // Birleşme anındaki titreşim gecikmesin: tercih şimdiden önbelleğe alınır
    getHapticFeedbackEnabled();
    const imageFallback = setTimeout(() => setImageReady(true), IMAGE_FALLBACK_MS);
    const cap = setTimeout(() => setCapReached(true), MAX_WAIT_MS);
    return () => {
      active = false;
      clearTimeout(imageFallback);
      clearTimeout(cap);
    };
  }, []);

  // Logo yüklendikten sonraki karede ilk kare çizilmiş olur; native splash ancak o zaman (üstte solarak) kalkar.
  // Android'de native splash tutulduğu sürece içerik hiç çizilmez, bu yüzden görsel önceden hazır olmalı.
  useEffect(() => {
    if (!imageReady || !timeline) return;
    const frame = requestAnimationFrame(() => {
      SplashScreen.hide();
      setStarted(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [imageReady, timeline]);

  // Yazı tipi geç yüklenirse yazı sistem fontuyla görünüp sonra değişmesin: yüklenince belirir
  useEffect(() => {
    if (fontLoaded) fontGate.set(withTiming(1, { duration: 180 }));
  }, [fontLoaded, fontGate]);

  useEffect(() => {
    // Hareket azaltma: perde ilk karede durur, oturum hazır olunca yalnızca solar
    if (!started || !timeline || reduceMotion) return;
    const T = timeline;
    const mergeAt = T.travelAt + T.travelDuration;
    if (T === FULL) AsyncStorage.setItem(FULL_SEEN_KEY, "1");

    clock.set(withTiming(MAX_WAIT_MS / 1000, { duration: MAX_WAIT_MS, easing: Easing.linear }));
    if (T.skyStars) {
      sky.set(withDelay(120, withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) })));
    }
    // Gökyüzü yıldızları beklerken kararır, birleşmeyle yeniden ışır
    dim.set(
      withSequence(
        withDelay(T.dimAt, withTiming(1, { duration: T.dimDuration, easing: Easing.inOut(Easing.quad) })),
        withDelay(
          mergeAt - T.dimAt - T.dimDuration,
          withTiming(0, { duration: 260, easing: Easing.out(Easing.quad) })
        )
      )
    );
    starsIn.set(
      withDelay(T.starsAt, withTiming(1, { duration: T.starsInDuration, easing: Easing.out(Easing.quad) }))
    );
    travel.set(withDelay(T.travelAt, withTiming(1, { duration: T.travelDuration, easing: TRAVEL_EASING })));
    merged.set(withDelay(mergeAt, withTiming(1, { duration: 120 })));
    burst.set(withDelay(mergeAt - 16, withTiming(1, { duration: 620, easing: Easing.linear })));
    // Birleşmede logo kalp atışı gibi kısa bir esneme yapar
    pop.set(
      withDelay(
        mergeAt,
        withSequence(
          withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }),
          withSpring(0, { damping: 11, stiffness: 170 })
        )
      )
    );
    wave.set(withDelay(mergeAt, withTiming(1, { duration: T.waveDuration, easing: Easing.out(Easing.cubic) })));
    echo.set(
      withDelay(mergeAt + 120, withTiming(1, { duration: T.waveDuration, easing: Easing.out(Easing.cubic) }))
    );
    bloom.set(
      withDelay(
        mergeAt,
        withSequence(
          withTiming(1, { duration: 160 }),
          withTiming(0, { duration: 900, easing: Easing.out(Easing.quad) })
        )
      )
    );
    // Android'de native maskenin kestiği yumuşak kenar, birleşmeyle açılır
    if (HAS_ANDROID_MASK) {
      mask.set(withDelay(mergeAt, withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) })));
    }
    if (T.wordmarkAt !== null) {
      wordmark.set(withDelay(T.wordmarkAt, withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) })));
    }
    progress.set(
      withTiming(1, { duration: T.end, easing: Easing.linear }, (done) => {
        "worklet";
        if (done) scheduleOnRN(setAnimDone, true);
      })
    );

    const haptic = setTimeout(T.haptic, mergeAt);
    return () => {
      clearTimeout(haptic);
      cancelAnimation(progress);
      cancelAnimation(clock);
      cancelAnimation(sky);
      cancelAnimation(dim);
      cancelAnimation(starsIn);
      cancelAnimation(travel);
      cancelAnimation(merged);
      cancelAnimation(burst);
      cancelAnimation(pop);
      cancelAnimation(wave);
      cancelAnimation(echo);
      cancelAnimation(bloom);
      cancelAnimation(mask);
      cancelAnimation(wordmark);
    };
  }, [
    started,
    timeline,
    reduceMotion,
    progress,
    clock,
    sky,
    dim,
    starsIn,
    travel,
    merged,
    burst,
    pop,
    wave,
    echo,
    bloom,
    mask,
    wordmark,
  ]);

  const exitStartedRef = useRef(false);
  const exitSafetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (exitSafetyRef.current) clearTimeout(exitSafetyRef.current);
  }, []);
  useEffect(() => {
    if (!canExit || exitStartedRef.current) return;
    exitStartedRef.current = true;
    launchState.completed = true;
    // Güvenlik ağıyla kalkılıyorsa native splash hâlâ açık olabilir
    SplashScreen.hide();
    const duration = reduceMotion || !timeline ? REDUCED_EXIT_MS : timeline.exitDuration;
    exit.set(
      withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }, (done) => {
        "worklet";
        if (done) scheduleOnRN(onFinished);
      })
    );
    // Güvenlik ağı: animasyon geri çağrısı gelmezse perde yarı saydam kalıp ekranı örtmesin. Bağımlılık
    // değişince temizlenmesin diye ref'te tutulur (etki yeniden çalışınca erken döner).
    exitSafetyRef.current = setTimeout(onFinished, duration + 1000);
  }, [canExit, reduceMotion, timeline, exit, onFinished]);

  const dimOpacity = timeline?.dimOpacity ?? 1;
  const dimScale = timeline?.dimScale ?? 1;
  const waveScale = timeline?.waveScale ?? 1;
  const bloomPeak = timeline?.bloom ?? 0;
  const spread = timeline?.spread ?? 1;

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.get() }));
  // Perde solarken içerik hafifçe öne gelir: uygulamanın içine doğru süzülme hissi
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.05 * exit.get() }] }));
  const logoWrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(dim.get(), [0, 1], [1, dimScale]) * (1 + 0.05 * pop.get()) }],
  }));
  const logoImageStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dim.get(), [0, 1], [1, dimOpacity]),
  }));
  const maskStyle = useAnimatedStyle(() => ({
    opacity: 1 - mask.get(),
    transform: [{ scale: 1 + 0.22 * mask.get() }],
  }));
  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bloom.get() * bloomPeak,
    transform: [{ scale: interpolate(wave.get(), [0, 1], [0.75, 1.3]) }],
  }));
  const waveStyle = useAnimatedStyle(() => {
    const p = wave.get();
    return {
      opacity: interpolate(p, [0, 0.06, 1], [0, 0.9, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(p, [0, 1], [0.12, waveScale]) }],
    };
  });
  const echoStyle = useAnimatedStyle(() => {
    const p = echo.get();
    return {
      opacity: interpolate(p, [0, 0.06, 1], [0, 0.45, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(p, [0, 1], [0.12, waveScale * 0.8]) }],
    };
  });
  const flashStyle = useAnimatedStyle(() => {
    const b = burst.get();
    return {
      opacity: interpolate(b, [0, 0.1, 1], [0, 1, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(b, [0, 0.12, 1], [0.4, 1.5, 2.4], Extrapolation.CLAMP) }],
    };
  });
  // Birleşen yıldız, logodaki dört kollu parıltıya dönüşür
  const flareStyle = useAnimatedStyle(() => {
    const b = burst.get();
    return {
      opacity: interpolate(b, [0, 0.08, 0.7], [0, 1, 0], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(b, [0, 0.15, 0.7], [0.2, 1.25, 0.5], Extrapolation.CLAMP) },
        { rotate: `${b * 25}deg` },
      ],
    };
  });
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmark.get() * fontGate.get(),
    transform: [{ translateY: (1 - wordmark.get()) * 10 }],
  }));

  return (
    <Animated.View style={[styles.root, rootStyle, { pointerEvents: canExit ? "none" : "auto" }]}>
      <StatusBar style="light" />
      {SKY.map((star, i) => (
        <SkyStar key={i} star={star} sky={sky} clock={clock} />
      ))}
      <Animated.View style={[StyleSheet.absoluteFill, contentStyle]}>
        <View style={styles.anchor}>
          <Animated.View style={[styles.bloom, bloomStyle]} />
          <Animated.View style={[styles.logoWrap, logoWrapStyle]}>
            <Animated.View style={logoImageStyle}>
              <Image
                source={require("../../../assets/images/splash-icon.png")}
                style={styles.logo}
                resizeMode="contain"
                fadeDuration={0}
                onLoad={() => setImageReady(true)}
                onError={() => setImageReady(true)}
              />
            </Animated.View>
            {HAS_ANDROID_MASK && <Animated.View style={[styles.mask, maskStyle]} />}
          </Animated.View>
          <Animated.View style={[styles.wave, echoStyle]} />
          <Animated.View style={[styles.wave, waveStyle]} />
          {STARS.map((path, s) =>
            TRAIL.map((trail) => (
              <Spark
                key={`${s}-${trail.lag}`}
                path={path}
                trail={trail}
                spread={spread}
                screenW={screenW}
                travel={travel}
                starsIn={starsIn}
                merged={merged}
              />
            ))
          )}
          <Animated.View style={[styles.flash, flashStyle]} />
          <Animated.View style={[styles.flare, flareStyle]}>
            <View style={styles.flareBarH} />
            <View style={styles.flareBarV} />
          </Animated.View>
          {fontLoaded && (
            <Animated.Text allowFontScaling={false} style={[styles.wordmark, wordmarkStyle]}>
              CoupleSky
            </Animated.Text>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function Spark({
  path,
  trail,
  spread,
  screenW,
  travel,
  starsIn,
  merged,
}: {
  path: StarPath;
  trail: (typeof TRAIL)[number];
  spread: number;
  screenW: number;
  travel: SharedValue<number>;
  starsIn: SharedValue<number>;
  merged: SharedValue<number>;
}) {
  const fromX = path.from.x * screenW * spread;
  const fromY = path.from.y * spread;
  const viaX = path.via.x * screenW * spread;
  const viaY = path.via.y * spread;
  const size = STAR_SIZE * trail.size;
  const isHead = trail.lag === 0;

  const style = useAnimatedStyle(() => {
    // Birleşme noktasında biten ikinci derece Bézier eğrisi (bitiş noktası 0,0)
    const t = Math.max(0, travel.get() - trail.lag);
    const u = 1 - t;
    return {
      opacity: starsIn.get() * (1 - merged.get()) * trail.opacity,
      transform: [
        { translateX: u * u * fromX + 2 * u * t * viaX },
        { translateY: u * u * fromY + 2 * u * t * viaY },
        // Birbirine yaklaştıkça parlaklaşır
        { scale: isHead ? 1 + 0.35 * t * t : 1 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.star,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          left: MERGE.x - size / 2,
          top: MERGE.y - size / 2,
          backgroundColor: path.core,
          boxShadow: isHead ? path.glow : undefined,
        },
        style,
      ]}
    />
  );
}

function SkyStar({
  star,
  sky,
  clock,
}: {
  star: (typeof SKY)[number];
  sky: SharedValue<number>;
  clock: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    opacity:
      sky.get() * star.base * (0.65 + 0.35 * Math.sin(clock.get() * Math.PI * 2 * star.freq + star.phase)),
  }));
  return (
    <Animated.View
      style={[
        styles.skyStar,
        { left: star.left, top: star.top, width: star.size, height: star.size, borderRadius: star.size / 2 },
        style,
      ]}
    />
  );
}

const WAVE = 120;
const BLOOM = 250;
const FLASH = 34;
const FLARE = 56;

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: BG,
  },
  // Ekranın tam ortasındaki sıfır boyutlu çapa: tüm katmanlar logonun merkezine göre yerleşir
  anchor: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 0,
    height: 0,
  },
  logoWrap: {
    position: "absolute",
    left: -LOGO / 2,
    top: -LOGO / 2,
    width: LOGO,
    height: LOGO,
  },
  logo: {
    width: LOGO,
    height: LOGO,
  },
  // Zemin renginde halka: iç çapı native maskeyle aynı, dışı logonun saydam kenarını aşar
  mask: {
    position: "absolute",
    left: (LOGO - ANDROID_MASK) / 2 - ANDROID_MASK_RING,
    top: (LOGO - ANDROID_MASK) / 2 - ANDROID_MASK_RING,
    width: ANDROID_MASK + ANDROID_MASK_RING * 2,
    height: ANDROID_MASK + ANDROID_MASK_RING * 2,
    borderRadius: ANDROID_MASK / 2 + ANDROID_MASK_RING,
    borderWidth: ANDROID_MASK_RING,
    borderColor: BG,
  },
  bloom: {
    position: "absolute",
    left: -BLOOM / 2,
    top: -BLOOM / 2,
    width: BLOOM,
    height: BLOOM,
    borderRadius: BLOOM / 2,
    backgroundColor: "rgba(200, 33, 63, 0.28)",
    boxShadow: "0px 0px 70px 30px rgba(200, 33, 63, 0.32)",
    opacity: 0,
  },
  wave: {
    position: "absolute",
    left: MERGE.x - WAVE / 2,
    top: MERGE.y - WAVE / 2,
    width: WAVE,
    height: WAVE,
    borderRadius: WAVE / 2,
    borderWidth: 1.5,
    borderColor: RED,
    boxShadow: "0px 0px 14px 2px rgba(200, 33, 63, 0.75), inset 0px 0px 10px 1px rgba(200, 33, 63, 0.5)",
    opacity: 0,
  },
  star: {
    position: "absolute",
    opacity: 0,
  },
  flash: {
    position: "absolute",
    left: MERGE.x - FLASH / 2,
    top: MERGE.y - FLASH / 2,
    width: FLASH,
    height: FLASH,
    borderRadius: FLASH / 2,
    backgroundColor: "#FFF6F8",
    boxShadow: "0px 0px 24px 10px rgba(255, 190, 208, 0.75)",
    opacity: 0,
  },
  flare: {
    position: "absolute",
    left: MERGE.x - FLARE / 2,
    top: MERGE.y - FLARE / 2,
    width: FLARE,
    height: FLARE,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0,
  },
  flareBarH: {
    position: "absolute",
    width: FLARE,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#FFF6F0",
    boxShadow: "0px 0px 6px 1px rgba(255, 220, 200, 0.9)",
  },
  flareBarV: {
    position: "absolute",
    width: 2,
    height: FLARE,
    borderRadius: 1,
    backgroundColor: "#FFF6F0",
    boxShadow: "0px 0px 6px 1px rgba(255, 220, 200, 0.9)",
  },
  wordmark: {
    position: "absolute",
    left: -150,
    top: LOGO / 2 + 14,
    width: 300,
    textAlign: "center",
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 32,
    letterSpacing: 0.6,
    color: "#F6EAF0",
    textShadowColor: "rgba(200, 33, 63, 0.55)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
    opacity: 0,
  },
  skyStar: {
    position: "absolute",
    backgroundColor: "#F3E6FF",
    opacity: 0,
  },
});
