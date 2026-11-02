import { memo, useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
} from "react-native-reanimated";
import Svg, { Line, Path } from "react-native-svg";

const W = 66;
const H = 20;
/** Makasla kesilmiş uçların diş sayısı */
const TEETH = 5;

/** Yarı saydam pastel bant tonları: pudra pembe ve kraft/krem */
export const WASHI_COLORS = {
  rose: "#F3C6D1",
  kraft: "#EAD6B8",
} as const;

/** Sol ve sağ kenarı tırtıklı (zikzak) bant gövdesi. */
function tapePath(): string {
  const step = H / TEETH;
  const depth = 3;
  let d = `M ${depth} 0 L ${W - depth} 0`;
  // Sağ kenar: yukarıdan aşağı zikzak
  for (let i = 0; i < TEETH; i++) {
    d += ` L ${W} ${step * i + step / 2} L ${W - depth} ${step * (i + 1)}`;
  }
  d += ` L ${depth} ${H}`;
  // Sol kenar: aşağıdan yukarı zikzak
  for (let i = TEETH; i > 0; i--) {
    d += ` L 0 ${step * i - step / 2} L ${depth} ${step * (i - 1)}`;
  }
  return `${d} Z`;
}
const PATH = tapePath();

interface WashiTapeProps {
  color?: string;
  /** Derece cinsinden eğim (ör. -12 / +12) */
  rotate?: number;
  style?: StyleProp<ViewStyle>;
}

/** Fotoğrafı anı defterine tutturan yarı saydam, uçları tırtıklı tekil washi bant. */
export const WashiTape = memo(function WashiTape({ color = WASHI_COLORS.rose, rotate = 0, style }: WashiTapeProps) {
  return (
    <View pointerEvents="none" style={[styles.wrap, { transform: [{ rotate: `${rotate}deg` }] }, style]}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path d={PATH} fill={color} opacity={0.82} />
        {/* İnce çapraz doku çizgileri: kâğıt bant hissi */}
        {[14, 30, 46].map((x) => (
          <Line key={x} x1={x} y1={H} x2={x + 8} y2={0} stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={2} />
        ))}
      </Svg>
    </View>
  );
});

export interface WashiCornerPairProps {
  /**
   * Yalnızca yeni fotoğraf seçildiğinde true olur:
   * Bant parmakla hafifçe kâğıda yapıştırılıyormuş gibi tek seferlik yumuşakça oturur.
   * Düzenleme modunda veya form doldurulurken kesinlikle hareket etmez (0 titreme).
   */
  animate?: boolean;
}

/**
 * Fotoğrafın sol ve sağ üst köşesini tutan washi bant çifti.
 * Yaylanarak ileri geri oynamaz; tek seferde, elle yapıştırma hissiyle oturur ve sabit kalır.
 */
export const WashiCornerPair = memo(function WashiCornerPair({ animate = false }: WashiCornerPairProps) {
  const reduceMotion = useReducedMotion();
  const press = useSharedValue(animate && !reduceMotion ? 0 : 1);

  useEffect(() => {
    if (animate && !reduceMotion) {
      press.set(0);
      press.set(withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }));
    } else {
      press.set(1);
    }
  }, [animate, reduceMotion, press]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = press.get();
    return {
      opacity: 0.35 + 0.65 * p,
      transform: [
        { translateY: (1 - p) * -5 },
        { scale: 1.04 - 0.04 * p },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, animatedStyle]}>
      <WashiTape color={WASHI_COLORS.rose} rotate={-12} style={styles.tapeLeft} />
      <WashiTape color={WASHI_COLORS.kraft} rotate={12} style={styles.tapeRight} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    width: W,
    height: H,
    zIndex: 3,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  tapeLeft: {
    top: -8,
    left: -6,
  },
  tapeRight: {
    top: -8,
    right: -6,
  },
});
