import type { ReactNode, RefObject } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Heart } from "lucide-react-native";

/** Instagram hikâyesi 9:16 (1080×1920). */
export const STORY_ASPECT = 9 / 16;

// Tasarım 360 birim genişliğe göre yazılır; kart ekranda hangi boyda çizilirse çizilsin aynı görünür
const DESIGN_WIDTH = 360;
// Instagram arayüzü hikâyenin üstten ~%13'ünü, alttan ~%18'ini örter: içerik bu güvenli bölgede kalır
const SAFE_TOP = 64;
const SAFE_BOTTOM = 96;
const SIDE_PADDING = 28;

/** Tasarım biriminden ekran ölçüsüne çevirir. */
export type StoryScale = (units: number) => number;

export interface StoryPalette {
  /** Arka plan degradesi (yukarıdan aşağı). */
  background: readonly [string, string, ...string[]];
  /** Üst ve alt ışımanın RGB'si, örn. "216, 88, 112". */
  glow: string;
  /** Süs kalplerinin rengi. */
  decor: string;
}

// Köşelere dağılmış küçük kalpler: orta bölgedeki metinlerle çakışmaz
const DECOR_HEARTS = [
  { x: 0.1, y: 0.05, size: 14, opacity: 0.2, rotate: -16 },
  { x: 0.84, y: 0.09, size: 20, opacity: 0.13, rotate: 14 },
  { x: 0.05, y: 0.58, size: 24, opacity: 0.09, rotate: -10 },
  { x: 0.9, y: 0.66, size: 13, opacity: 0.18, rotate: 18 },
  { x: 0.76, y: 0.93, size: 18, opacity: 0.12, rotate: -14 },
  { x: 0.16, y: 0.94, size: 12, opacity: 0.2, rotate: 10 },
] as const;

interface StoryCardProps {
  /** Ekranda kaplayacağı genişlik (dp); yükseklik 9:16 oranından türetilir. */
  width: number;
  /** Paylaşılırken görüntüsü alınan görünüm. */
  cardRef: RefObject<View | null>;
  palette: StoryPalette;
  /** Kartın arkasına tam boy çizilen süs (silik büyük ikon vb.). */
  backdrop?: ReactNode;
  /** Güvenli bölgeye yerleşen içerik; `s` tasarım birimini ekran ölçüsüne çevirir. */
  children: (s: StoryScale) => ReactNode;
}

/**
 * Instagram hikâyesi oranında (9:16) paylaşım kartı. Dış kap köşeleri yuvarlar; `cardRef` köşesiz iç görünümdedir,
 * böylece dışa aktarılan görsel tam ekran ve kenar boşluksuz olur.
 */
export function StoryCard({ width, cardRef, palette, backdrop, children }: StoryCardProps) {
  const height = (width * 16) / 9;
  const unit = width / DESIGN_WIDTH;
  const s: StoryScale = (units) => units * unit;

  return (
    <View style={{ width, height, borderRadius: s(28), overflow: "hidden" }}>
      <View ref={cardRef} collapsable={false} style={{ width, height }}>
        <LinearGradient colors={palette.background} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={[`rgba(${palette.glow}, 0.36)`, `rgba(${palette.glow}, 0)`]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: s(300) }}
        />
        <LinearGradient
          colors={[`rgba(${palette.glow}, 0)`, `rgba(${palette.glow}, 0.24)`]}
          style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: s(260) }}
        />

        {DECOR_HEARTS.map((heart, index) => (
          <View
            key={index}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: width * heart.x,
              top: height * heart.y,
              opacity: heart.opacity,
              transform: [{ rotate: `${heart.rotate}deg` }],
            }}
          >
            <Heart size={s(heart.size)} color={palette.decor} fill={palette.decor} />
          </View>
        ))}

        {backdrop}

        <View
          style={{
            flex: 1,
            paddingTop: s(SAFE_TOP),
            paddingBottom: s(SAFE_BOTTOM),
            paddingHorizontal: s(SIDE_PADDING),
          }}
        >
          {children(s)}
        </View>
      </View>
    </View>
  );
}
