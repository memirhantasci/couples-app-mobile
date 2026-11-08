import type { ReactNode, RefObject } from "react";
import { PixelRatio, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { SITE_DOMAIN } from "@/constants/brand";
import { GOLD, GoldLine, GoldMark, seeded, sparklePath, type StoryScale } from "./storyDecor";

export type { StoryScale } from "./storyDecor";

/** Instagram hikâyesi 9:16 (1080×1920). */
export const STORY_ASPECT = 9 / 16;

// Tasarım 360×640 birimlik tuvale göre yazılır; kart hangi boyda gösterilirse gösterilsin aynı görünür
const DESIGN_WIDTH = 360;
const DESIGN_HEIGHT = 640;
// Instagram arayüzü hikâyenin üstten ~%12'sini (profil çubuğu), alttan ~%15'ini (mesaj çubuğu) örter:
// içerik ve CoupleSky imzası bu güvenli bölgede kalır
const SAFE_TOP = 78;
const SAFE_BOTTOM = 96;
const SIDE_PADDING = 28;

/** Altbilgideki indirme çağrısı: "App Store · Google Play · couplesky.app" */
const STORY_CTA_TEXT = `App Store · Google Play · ${SITE_DOMAIN}`;

// Kart, tam 1080×1920 piksel tutacak boyda (dp) çizilir ve ekranda yalnızca küçültülerek gösterilir. Böylece
// dışa aktarma 1:1 yakalanır; ekrandaki önizlemeyi büyütmekten doğan bulanıklık olmaz. Küçültme, yakalanan
// görünümün değil üstündeki sarmalayıcının dönüşümüdür (view-shot görünümü kendi düzen boyutunda çizer).
const EXPORT_WIDTH = 1080 / PixelRatio.get();
const EXPORT_HEIGHT = 1920 / PixelRatio.get();

/** Köşe ışımalarının tonu; altın varak her tonda vardır. */
export type StoryTone = "rose" | "azure";

const TONES: Record<StoryTone, { glow: string; nebula: string }> = {
  rose: { glow: "#D85870", nebula: "#7C3AED" },
  azure: { glow: "#4F7DBE", nebula: "#6366F1" },
};

// Yıldız tozu: sabit tohumla dağıtılır, her paylaşımda aynı gökyüzü
const DUST = Array.from({ length: 88 }, (_, i) => ({
  cx: seeded(i, 1) * DESIGN_WIDTH,
  cy: seeded(i, 2) * DESIGN_HEIGHT,
  r: 0.35 + seeded(i, 3) ** 2 * 1.15,
  opacity: 0.12 + seeded(i, 4) * 0.55,
  gold: seeded(i, 5) > 0.72,
}));

const SPARKLES = [
  { x: 54, y: 112, r: 6.5, opacity: 0.75 },
  { x: 318, y: 190, r: 5, opacity: 0.6 },
  { x: 302, y: 470, r: 6, opacity: 0.55 },
  { x: 36, y: 396, r: 4.5, opacity: 0.6 },
  { x: 196, y: 40, r: 4, opacity: 0.5 },
] as const;

interface StoryCardProps {
  /** Ekranda kaplayacağı genişlik (dp); yükseklik 9:16 oranından türetilir. */
  width: number;
  /** Paylaşılırken görüntüsü alınan görünüm: tam 1080×1920 piksellik kart. */
  cardRef: RefObject<View | null>;
  tone?: StoryTone;
  /** Güvenli bölgeye yerleşen içerik; `s` tasarım birimini kart ölçüsüne çevirir. */
  children: (s: StoryScale) => ReactNode;
}

/**
 * Instagram hikâyesi oranında (9:16) lüks paylaşım zemini: derin kozmik gece, köşelerden süzülen altın ve gül
 * ışıması, yıldız tozu, ince çift altın çerçeve ve en altta altın CoupleSky imzası. Dış kap önizlemenin köşelerini
 * yuvarlar; `cardRef` köşesiz iç görünümdedir, böylece dışa aktarılan görsel tam ekran ve kenar boşluksuz olur.
 */
export function StoryCard({ width, cardRef, tone = "rose", children }: StoryCardProps) {
  const height = (width * 16) / 9;
  const unit = EXPORT_WIDTH / DESIGN_WIDTH;
  const s: StoryScale = (units) => units * unit;
  const colors = TONES[tone];

  return (
    <View style={{ width, height, borderRadius: (28 * width) / DESIGN_WIDTH, overflow: "hidden", backgroundColor: "#0A0A0C" }}>
      <View
        collapsable={false}
        style={{ width: EXPORT_WIDTH, height: EXPORT_HEIGHT, transformOrigin: "left top", transform: [{ scale: width / EXPORT_WIDTH }] }}
      >
        <View ref={cardRef} collapsable={false} style={{ width: EXPORT_WIDTH, height: EXPORT_HEIGHT, backgroundColor: "#0A0A0C" }}>
          <LinearGradient colors={["#0A0A0C", "#120A16", "#160B1E"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />

          <Svg width={EXPORT_WIDTH} height={EXPORT_HEIGHT} viewBox={`0 0 ${DESIGN_WIDTH} ${DESIGN_HEIGHT}`} style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="storyNebula" cx={180} cy={290} r={260} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={colors.nebula} stopOpacity={0.13} />
                <Stop offset="1" stopColor={colors.nebula} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="storyGoldTop" cx={312} cy={24} r={300} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={GOLD.base} stopOpacity={0.34} />
                <Stop offset="0.5" stopColor={GOLD.base} stopOpacity={0.08} />
                <Stop offset="1" stopColor={GOLD.base} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="storyGlowTop" cx={16} cy={30} r={210} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={colors.glow} stopOpacity={0.2} />
                <Stop offset="1" stopColor={colors.glow} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="storyGlowBottom" cx={34} cy={622} r={330} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={colors.glow} stopOpacity={0.36} />
                <Stop offset="0.55" stopColor={colors.glow} stopOpacity={0.1} />
                <Stop offset="1" stopColor={colors.glow} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="storyGoldBottom" cx={344} cy={600} r={190} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={GOLD.base} stopOpacity={0.16} />
                <Stop offset="1" stopColor={GOLD.base} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={DESIGN_WIDTH} height={DESIGN_HEIGHT} fill="url(#storyNebula)" />
            <Rect x={0} y={0} width={DESIGN_WIDTH} height={DESIGN_HEIGHT} fill="url(#storyGoldTop)" />
            <Rect x={0} y={0} width={DESIGN_WIDTH} height={DESIGN_HEIGHT} fill="url(#storyGlowTop)" />
            <Rect x={0} y={0} width={DESIGN_WIDTH} height={DESIGN_HEIGHT} fill="url(#storyGlowBottom)" />
            <Rect x={0} y={0} width={DESIGN_WIDTH} height={DESIGN_HEIGHT} fill="url(#storyGoldBottom)" />

            {DUST.map((dot, index) => (
              <Circle key={index} cx={dot.cx} cy={dot.cy} r={dot.r} fill={dot.gold ? GOLD.light : "#FFFFFF"} opacity={dot.opacity} />
            ))}
            {SPARKLES.map((sparkle, index) => (
              <Path key={index} d={sparklePath(sparkle.x, sparkle.y, sparkle.r)} fill={GOLD.light} opacity={sparkle.opacity} />
            ))}

            {/* İnce çift altın çerçeve */}
            <Rect x={13} y={13} width={334} height={614} rx={20} fill="none" stroke={GOLD.base} strokeOpacity={0.38} strokeWidth={0.7} />
            <Rect x={17} y={17} width={326} height={606} rx={17} fill="none" stroke={GOLD.base} strokeOpacity={0.16} strokeWidth={0.5} />
          </Svg>

          <View style={{ flex: 1, paddingTop: s(SAFE_TOP), paddingBottom: s(SAFE_BOTTOM), paddingHorizontal: s(SIDE_PADDING) }}>
            <View style={{ flex: 1 }}>{children(s)}</View>
            <StoryFooter s={s} />
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Altın CoupleSky imzası, "Certified on CoupleSky" onay çizgisi ve indirme çağrısı. Görsele gömülü bir bağlantı
 * dokunulamaz; bu yüzden çağrı, izleyicinin arayıp bulabileceği düz metindir: alan adı (iki platforma da
 * yönlendiren sayfa) ve mağaza adları. Dil bağımsızdır, çeviri gerektirmez.
 */
function StoryFooter({ s }: { s: StoryScale }) {
  return (
    <View style={{ alignItems: "center", paddingTop: s(8) }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}>
        <GoldMark size={s(14)} />
        <Text style={{ color: GOLD.ink, fontSize: s(10), fontFamily: "Inter_700Bold", letterSpacing: s(3.6), paddingLeft: s(3.6) }}>
          COUPLESKY
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: s(8), marginTop: s(5) }}>
        <GoldLine fade="left" style={{ width: s(42), height: s(0.8) }} />
        <Text style={{ color: GOLD.soft, fontSize: s(9.5), fontFamily: "PlayfairDisplay_400Regular_Italic" }}>Certified on CoupleSky</Text>
        <GoldLine fade="right" style={{ width: s(42), height: s(0.8) }} />
      </View>
      <Text
        numberOfLines={1}
        style={{ color: GOLD.soft, fontSize: s(8.4), lineHeight: s(11), fontFamily: "Inter_600SemiBold", letterSpacing: s(0.9), marginTop: s(6), opacity: 0.85 }}
      >
        {STORY_CTA_TEXT}
      </Text>
    </View>
  );
}
