import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, type SharedValue } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import type { AppTheme } from "@/lib/theme";
import { useFocusClock } from "@/hooks/useFocusClock";

export type EmptyIllustrationType = "letters" | "photos" | "memories";

/**
 * Boş listeler için yaşayan küçük sahneler. Çizimler durağan SVG'lerdir; hareket yalnızca onları taşıyan
 * katmanların dönüşümlerindedir (UI iş parçacığında, ekran odaktayken).
 */
export const EmptyIllustration = memo(function EmptyIllustration({
  type,
  theme,
}: {
  type: EmptyIllustrationType;
  theme: AppTheme;
}) {
  switch (type) {
    case "letters":
      return <SleepingCatScene theme={theme} />;
    case "photos":
      return <HangingPolaroidScene theme={theme} />;
    case "memories":
      return <CoffeeHeartScene theme={theme} />;
  }
});

const TAU = Math.PI * 2;

// ─── MEKTUP YOK: zarfın üstünde uyuyan kedi ─────────────────────────────────────
/** 4 sn'lik saat: kuyruk her turda bir kez sallanır, gövde iki kez (2 sn'de bir) nefes alır. */
const CAT_CYCLE_MS = 4000;
const CAT_W = 120;
const CAT_H = 68;
const CAT = {
  fur: "#F5B27A",
  belly: "#FBE3CB",
  stripe: "#E08A4A",
  ink: "#5B3A29",
  blush: "#F59E9E",
  ear: "#F7A8A8",
} as const;

function SleepingCatScene({ theme }: { theme: AppTheme }) {
  const reduceMotion = useReducedMotion();
  const clock = useFocusClock(CAT_CYCLE_MS, !reduceMotion);

  const bodyStyle = useAnimatedStyle(() => {
    const breath = 0.5 - 0.5 * Math.cos(TAU * 2 * clock.get());
    return { transform: [{ translateY: -2 * breath }, { scaleY: 1 + 0.06 * breath }] };
  });
  const headStyle = useAnimatedStyle(() => {
    const breath = 0.5 - 0.5 * Math.cos(TAU * 2 * clock.get());
    return { transform: [{ translateY: -1.2 * breath }] };
  });
  const tailStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${5 * Math.sin(TAU * clock.get())}deg` }],
  }));

  return (
    <View style={cat.scene}>
      <VintageEnvelope accent={theme.accent} />
      <View style={cat.body}>
        <Animated.View style={[cat.layer, cat.bodyOrigin, bodyStyle]}>
          <CatBody />
        </Animated.View>
        <Animated.View style={[cat.layer, cat.tailOrigin, tailStyle]}>
          <CatTail />
        </Animated.View>
        <Animated.View style={[cat.layer, headStyle]}>
          <CatHead />
        </Animated.View>
      </View>
      <SleepyZ clock={clock} phase={0} size={12} color={theme.textMuted} />
      <SleepyZ clock={clock} phase={0.5} size={15} color={theme.textMuted} />
    </View>
  );
}

/** Kedinin başından süzülüp kaybolan "z". */
function SleepyZ({ clock, phase, size, color }: { clock: SharedValue<number>; phase: number; size: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const p = (clock.get() + phase) % 1;
    return {
      opacity: 0.8 * Math.sin(Math.PI * p),
      transform: [{ translateX: 14 * p }, { translateY: -20 * p }, { scale: 0.7 + 0.5 * p }],
    };
  });
  return <Animated.Text style={[cat.z, { fontSize: size, color }, style]}>z</Animated.Text>;
}

const VintageEnvelope = memo(function VintageEnvelope({ accent }: { accent: string }) {
  return (
    <Svg width={156} height={92} viewBox="0 0 156 92" style={cat.envelope}>
      <Rect x={1} y={1} width={154} height={90} rx={10} fill="#F4E4C8" stroke="#D8BF94" strokeWidth={1.5} />
      <Path d="M3 88 L60 46 M153 88 L96 46" stroke="#E5D2AE" strokeWidth={1.2} fill="none" />
      <Path d="M3 6 L78 50 L153 6" stroke="#D8BF94" strokeWidth={1.5} fill="none" strokeLinejoin="round" />
      <Circle cx={78} cy={52} r={9.5} fill={accent} />
      <Circle cx={78} cy={52} r={6.6} fill="none" stroke="#FFFFFF" strokeOpacity={0.35} />
      <Path
        d="M78 56 C74.5 53.2 73.2 51.6 73.2 50.1 C73.2 48.8 74.2 47.8 75.5 47.8 C76.5 47.8 77.4 48.4 78 49.3 C78.6 48.4 79.5 47.8 80.5 47.8 C81.8 47.8 82.8 48.8 82.8 50.1 C82.8 51.6 81.5 53.2 78 56 Z"
        fill="#FFFFFF"
        opacity={0.85}
      />
      <Rect x={120} y={62} width={24} height={20} rx={2} fill="#FFF8EC" stroke={accent} strokeOpacity={0.6} strokeDasharray="2 2" />
    </Svg>
  );
});

const CatBody = memo(function CatBody() {
  return (
    <Svg width={CAT_W} height={CAT_H} viewBox={`0 0 ${CAT_W} ${CAT_H}`}>
      <Ellipse cx={64} cy={38} rx={42} ry={21} fill={CAT.fur} />
      <Ellipse cx={60} cy={47} rx={30} ry={9} fill={CAT.belly} opacity={0.65} />
      {["M58 18.5 Q61.5 24 57.5 29", "M70 17.5 Q73.5 24.5 69.5 30", "M82 20 Q85 26.5 81 31", "M93 25 Q95 30 92 33.5"].map(
        (d) => (
          <Path key={d} d={d} stroke={CAT.stripe} strokeWidth={2.6} strokeLinecap="round" fill="none" />
        )
      )}
    </Svg>
  );
});

const CatTail = memo(function CatTail() {
  return (
    <Svg width={CAT_W} height={CAT_H} viewBox={`0 0 ${CAT_W} ${CAT_H}`}>
      <Path d="M100 44 C116 48 115 62 97 61.5 C85 61 73 60.5 63 58.5" stroke={CAT.fur} strokeWidth={8} strokeLinecap="round" fill="none" />
      <Path d="M72 60.3 C68.5 59.9 65.5 59.3 63 58.5" stroke={CAT.stripe} strokeWidth={8} strokeLinecap="round" fill="none" />
    </Svg>
  );
});

const CatHead = memo(function CatHead() {
  return (
    <Svg width={CAT_W} height={CAT_H} viewBox={`0 0 ${CAT_W} ${CAT_H}`}>
      <Path d="M15.5 31 L17 14.5 L28.5 24.5 Z" fill={CAT.fur} />
      <Path d="M31.5 23.5 L42.5 13 L45.5 29 Z" fill={CAT.fur} />
      <Path d="M18.6 27.5 L19.4 18.8 L25.4 24.4 Z" fill={CAT.ear} />
      <Path d="M34.4 23.6 L41.4 17.2 L43.2 26.6 Z" fill={CAT.ear} />
      <Circle cx={30} cy={38} r={17} fill={CAT.fur} />
      <Path d="M26 23.5 L27.2 27.5 M30.5 22.5 L30.5 27 M35 23.5 L33.8 27.5" stroke={CAT.stripe} strokeWidth={1.6} strokeLinecap="round" />
      <Ellipse cx={30} cy={44.5} rx={8.5} ry={5.8} fill={CAT.belly} />
      <Path d="M20 37.5 Q23.5 41 27 37.5 M33 37.5 Q36.5 41 40 37.5" stroke={CAT.ink} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <Path d="M28.5 42.2 H31.5 L30 44 Z" fill="#E77F8E" />
      <Path d="M30 44 Q28.6 46.2 27 45.4 M30 44 Q31.4 46.2 33 45.4" stroke={CAT.ink} strokeWidth={1} strokeLinecap="round" fill="none" />
      <Circle cx={19.5} cy={43.5} r={2.6} fill={CAT.blush} opacity={0.55} />
      <Circle cx={40.5} cy={43.5} r={2.6} fill={CAT.blush} opacity={0.55} />
      <Ellipse cx={37} cy={56.5} rx={6.2} ry={3.8} fill={CAT.belly} stroke={CAT.stripe} strokeOpacity={0.5} strokeWidth={0.8} />
      <Ellipse cx={47.5} cy={58} rx={6.2} ry={3.8} fill={CAT.belly} stroke={CAT.stripe} strokeOpacity={0.5} strokeWidth={0.8} />
    </Svg>
  );
});

const cat = StyleSheet.create({
  scene: {
    width: 200,
    height: 136,
  },
  envelope: {
    position: "absolute",
    left: 22,
    top: 44,
  },
  // Gövdenin alt kenarı zarfın üst kısmına 15 px biner: kedi zarfın üstünde kıvrılmış yatar
  body: {
    position: "absolute",
    left: 40,
    top: 0,
    width: CAT_W,
    height: CAT_H,
  },
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  // Gövde zarfa oturduğu yerden yukarı doğru nefes alır; kuyruk gövdeden çıktığı yerin çevresinde sallanır
  bodyOrigin: {
    transformOrigin: "50% 87%",
  },
  tailOrigin: {
    transformOrigin: "83% 65%",
  },
  z: {
    position: "absolute",
    left: 80,
    top: 6,
    fontFamily: "Inter_700Bold",
  },
});

// ─── FOTOĞRAF YOK: ipe mandallanmış, rüzgârda sallanan boş polaroid ────────────
/** Bir tam salınım: 1.8 sn sola, 1.8 sn sağa. */
const SWING_CYCLE_MS = 3600;
const GOLD = "#F5C563";
const MOTES = [
  { x: 62, y: 112, dx: -20, dy: -72, phase: 0 },
  { x: 138, y: 104, dx: 22, dy: -66, phase: 0.33 },
  { x: 116, y: 64, dx: 12, dy: -58, phase: 0.66 },
] as const;

function HangingPolaroidScene({ theme }: { theme: AppTheme }) {
  const reduceMotion = useReducedMotion();
  const clock = useFocusClock(SWING_CYCLE_MS, !reduceMotion);

  const swingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${3 * Math.sin(TAU * clock.get())}deg` }],
  }));

  return (
    <View style={polaroid.scene}>
      <Svg width={200} height={34} viewBox="0 0 200 34" style={StyleSheet.absoluteFill}>
        <Path d="M0 8 Q100 30 200 8" stroke="#B98B5E" strokeWidth={1.6} fill="none" />
      </Svg>
      {MOTES.map((mote, index) => (
        <GoldMote key={index} clock={clock} {...mote} />
      ))}
      <Animated.View style={[polaroid.group, swingStyle]}>
        <View style={polaroid.frame}>
          <View style={[polaroid.photo, { backgroundColor: theme.isLight ? "#EEF0F4" : "#E7E2EE" }]}>
            <LinearGradient
              colors={[`${theme.accent}26`, "rgba(255,255,255,0)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[polaroid.photoFrame, { borderColor: `${theme.accent}40` }]} />
          </View>
          <View style={polaroid.caption} />
        </View>
        <Clothespin />
      </Animated.View>
    </View>
  );
}

/** Çerçevenin arkasından süzülüp yukarı uçan minik altın ışık tozu. */
function GoldMote({
  clock,
  x,
  y,
  dx,
  dy,
  phase,
}: {
  clock: SharedValue<number>;
  x: number;
  y: number;
  dx: number;
  dy: number;
  phase: number;
}) {
  const style = useAnimatedStyle(() => {
    const p = (clock.get() + phase) % 1;
    return {
      opacity: 0.9 * Math.sin(Math.PI * p),
      transform: [{ translateX: dx * p }, { translateY: dy * p }, { scale: 1 - 0.4 * p }],
    };
  });
  return <Animated.View style={[polaroid.mote, { left: x - 3, top: y - 3 }, style]} />;
}

const Clothespin = memo(function Clothespin() {
  return (
    <Svg width={12} height={26} viewBox="0 0 12 26" style={polaroid.pin}>
      <Rect x={1} y={0} width={10} height={26} rx={2} fill="#D9A86C" />
      <Rect x={1} y={0} width={10} height={3} rx={1.5} fill="#E6BC85" />
      <Rect x={5.4} y={0} width={1.2} height={26} fill="#B98549" />
      <Circle cx={6} cy={11} r={3} fill="none" stroke="#9CA3AF" strokeWidth={1.3} />
    </Svg>
  );
});

const polaroid = StyleSheet.create({
  scene: {
    width: 200,
    height: 150,
  },
  // Mandalın ipe tutunduğu nokta (ipin ortası) salınımın merkezi
  group: {
    position: "absolute",
    left: 54,
    top: 12,
    width: 92,
    height: 124,
    transformOrigin: "50% 6%",
  },
  frame: {
    position: "absolute",
    top: 14,
    left: 0,
    width: 92,
    height: 108,
    borderRadius: 4,
    padding: 7,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
  photo: {
    height: 74,
    borderRadius: 2,
    overflow: "hidden",
  },
  photoFrame: {
    ...StyleSheet.absoluteFill,
    margin: 6,
    borderRadius: 2,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  caption: {
    alignSelf: "center",
    marginTop: 10,
    width: 40,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#E5E7EB",
  },
  pin: {
    position: "absolute",
    left: 40,
    top: 0,
  },
  mote: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GOLD,
  },
});

// ─── ANI YOK: yan yana iki fincan ve aralarından yükselen kalp buharı ─────────
const STEAM_CYCLE_MS = 3000;
const STEAM_PINK = "#F472B6";

function CoffeeHeartScene({ theme }: { theme: AppTheme }) {
  const reduceMotion = useReducedMotion();
  const clock = useFocusClock(STEAM_CYCLE_MS, !reduceMotion);

  return (
    <View style={coffee.scene}>
      <HeartSteam clock={clock} phase={0} />
      <HeartSteam clock={clock} phase={0.5} />
      <View style={[coffee.cup, coffee.cupLeft]}>
        <CoffeeCup fill="#FFF4EA" ink="#5B3A29" />
      </View>
      <View style={[coffee.cup, coffee.cupRight]}>
        <CoffeeCup fill={theme.accent} ink="#FFFFFF" />
      </View>
    </View>
  );
}

/** Fincanların arasından kıvrılarak yükselip sönen ince pembe kalp dumanı. */
function HeartSteam({ clock, phase }: { clock: SharedValue<number>; phase: number }) {
  const style = useAnimatedStyle(() => {
    const p = (clock.get() + phase) % 1;
    return {
      opacity: 0.7 * Math.min(1, p * 5) * (1 - p),
      transform: [{ translateX: 3 * Math.sin(TAU * p) }, { translateY: -30 * p }],
    };
  });
  return (
    <Animated.View style={[coffee.steam, style]}>
      <Svg width={28} height={44} viewBox="0 0 28 44">
        <Path
          d="M14 16 C10 9 2 10 3 17 C4 22 10 25 14 29 C18 25 24 22 25 17 C26 10 18 9 14 16 Z"
          stroke={STEAM_PINK}
          strokeWidth={2}
          strokeLinejoin="round"
          fill="none"
        />
        <Path d="M14 29 C10 33 18 37 14 43" stroke={STEAM_PINK} strokeWidth={2} strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}

/** Gülümseyen fincan; kulpu sağda (soldaki fincan aynalanarak çizilir). */
const CoffeeCup = memo(function CoffeeCup({ fill, ink }: { fill: string; ink: string }) {
  return (
    <Svg width={70} height={62} viewBox="0 0 70 62">
      <Ellipse cx={33} cy={57} rx={30} ry={4.6} fill="#E9DCCD" />
      <Path d="M56.5 25 C67.5 25 67.5 41 54 42" stroke={fill} strokeWidth={4.6} strokeLinecap="round" fill="none" />
      <Path d="M9 20 H57 C57 41 49 52 33 52 C17 52 9 41 9 20 Z" fill={fill} />
      <Ellipse cx={33} cy={20} rx={24} ry={5} fill={fill} stroke="rgba(0,0,0,0.08)" strokeWidth={1} />
      <Ellipse cx={33} cy={20.6} rx={20.5} ry={3.6} fill="#6B4130" />
      <Ellipse cx={33} cy={20.2} rx={12} ry={1.8} fill="#A0694B" opacity={0.8} />
      <Path d="M25 33 Q27.5 35.5 30 33 M36 33 Q38.5 35.5 41 33" stroke={ink} strokeWidth={1.5} strokeLinecap="round" fill="none" />
      <Path d="M30.5 37.5 Q33 39.5 35.5 37.5" stroke={ink} strokeWidth={1.3} strokeLinecap="round" fill="none" />
      <Circle cx={23.5} cy={37} r={2.2} fill={CAT.blush} opacity={0.6} />
      <Circle cx={42.5} cy={37} r={2.2} fill={CAT.blush} opacity={0.6} />
    </Svg>
  );
});

const coffee = StyleSheet.create({
  scene: {
    width: 200,
    height: 130,
  },
  steam: {
    position: "absolute",
    left: 86,
    top: 44,
  },
  cup: {
    position: "absolute",
    top: 68,
  },
  // Fincanlar birbirine hafifçe eğilir; soldakinin kulpu dışa (sola) bakar
  cupLeft: {
    left: 26,
    transform: [{ rotate: "4deg" }, { scaleX: -1 }],
  },
  cupRight: {
    left: 104,
    transform: [{ rotate: "-4deg" }],
  },
});
