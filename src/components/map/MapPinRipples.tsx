import { useCallback } from "react";
import { Platform, StyleSheet } from "react-native";
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useFocusEffect } from "expo-router";

// Skia yalnızca native modül mevcutsa yüklenir (Expo Go vb. ortamlarda çökmesin); yoksa dalga çizilmez.
let SkiaLib: typeof import("@shopify/react-native-skia") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@shopify/react-native-skia");
  if (mod?.Skia && mod?.Canvas) SkiaLib = mod;
} catch {
  SkiaLib = null;
}

// ─── Pinlerde Nabız Gibi Atan Kalp Radarı ────────────────────────────────────
// İşaretçiler performans için dondurulmuş bitmap olarak çizilir (tracksViewChanges=false); içlerine
// sürekli animasyon koymak Android'de her karede tüm pinleri yeniden çizdirirdi. Bunun yerine dalgalar
// haritanın üstündeki tek bir Skia katmanında, her pinin ucunda yere yayılan basık halkalar olarak çizilir.
// Harita kayarken gizlenir, durunca pinlerin yeni ekran konumlarıyla yeniden belirir.

export interface RipplePoint {
  x: number;
  y: number;
  /** 0..1: pinler aynı anda atmasın diye her birinin dalgası farklı fazda başlar */
  phase: number;
}

export type RipplePinType = "photo" | "note" | "meeting";

/** Aynı anda dalga çizilen en fazla pin (ekrandakilerden merkeze en yakın olanlar). */
export const MAX_RIPPLES = 24;
const RIPPLE_MS = 1800;
const BASE_RX = 15;
/** Halka yere yatık bir elips: pinin arkasındaki zemine yayılıyormuş gibi görünür */
const FLATTEN = 0.42;
const MAX_SCALE = 2.2;

// iOS'ta (Apple Maps) özel işaretçi görünümü koordinata ORTALANIR; Android'de (Google) alt ucu
// koordinattadır. Dalga her iki platformda da pinin ucundan yayılsın diye iOS'ta yarım boy kadar aşağı alınır.
const PIN_HALF_HEIGHT: Record<RipplePinType, number> = { photo: 31, note: 22, meeting: 17 };

export function rippleTipOffset(type: RipplePinType): number {
  return Platform.OS === "ios" ? PIN_HALF_HEIGHT[type] : 0;
}

/** Pin anahtarından sabit bir faz: aynı pin her yeniden konumlandırmada aynı ritimde atar. */
export function ripplePhase(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % 997;
  return hash / 997;
}

interface MapPinRipplesProps {
  points: SharedValue<RipplePoint[]>;
  /** 0..1: harita kayarken 0 */
  visible: SharedValue<number>;
  color: string;
}

export function MapPinRipples(props: MapPinRipplesProps) {
  const reduceMotion = useReducedMotion();
  // Hareket azaltma: dalganın son karesi görünmez bir halkadır
  if (!SkiaLib || reduceMotion) return null;
  return <RippleCanvas {...props} />;
}

function RippleCanvas({ points, visible, color }: MapPinRipplesProps) {
  const Skia = SkiaLib!;
  const clock = useSharedValue(0);

  // Yalnızca harita ekranı odaktayken atar
  useFocusEffect(
    useCallback(() => {
      clock.set(0);
      clock.set(withRepeat(withTiming(1, { duration: RIPPLE_MS, easing: Easing.linear }), -1, false));
      return () => cancelAnimation(clock);
    }, [clock])
  );

  return (
    <Skia.Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: MAX_RIPPLES }, (_, index) => (
        <Ripple key={index} index={index} points={points} visible={visible} clock={clock} color={color} />
      ))}
    </Skia.Canvas>
  );
}

function Ripple({
  index,
  points,
  visible,
  clock,
  color,
}: {
  index: number;
  points: SharedValue<RipplePoint[]>;
  visible: SharedValue<number>;
  clock: SharedValue<number>;
  color: string;
}) {
  const Skia = SkiaLib!;

  const rect = useDerivedValue(() => {
    const point = points.get()[index];
    if (!point) return { x: -100, y: -100, width: 0, height: 0 };
    const t = (clock.get() + point.phase) % 1;
    const rx = BASE_RX * (1 + (MAX_SCALE - 1) * t);
    const ry = rx * FLATTEN;
    return { x: point.x - rx, y: point.y - ry, width: rx * 2, height: ry * 2 };
  });

  const opacity = useDerivedValue(() => {
    const point = points.get()[index];
    if (!point) return 0;
    const t = (clock.get() + point.phase) % 1;
    return 0.5 * (1 - t) * visible.get();
  });

  return (
    <Skia.Group opacity={opacity}>
      <Skia.Oval rect={rect} color={color} opacity={0.3} />
      <Skia.Oval rect={rect} color={color} style="stroke" strokeWidth={1.6} />
    </Skia.Group>
  );
}
