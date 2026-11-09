import type { ReactNode } from "react";
import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Stop } from "react-native-svg";
import { Heart } from "lucide-react-native";
import { useStorageImage, type PrivateBucket } from "@/lib/storageImages";
import { caseLocale } from "@/lib/textCase";
import { WashiTape, WASHI_COLORS } from "@/components/memories/WashiTape";

// ─── Paylaşım Kartlarının Ortak Lüks Süsleri ─────────────────────────────────────
// Kartlar react-native-view-shot ile yakalanır. Android'de yakalama yazılım tuvaline çizilir: elevation /
// boxShadow gölgeleri ve donanım bitmap'leri orada çizilmez. Bu yüzden gölgeler yarı saydam katmanlarla,
// buzlu cam ışık degradesiyle taklit edilir; fotoğraflar React Native `Image` ile çizilir.

/** Tasarım biriminden kart ölçüsüne çevirir (kart 360×640 birimlik tuvale göre tasarlanır). */
export type StoryScale = (units: number) => number;

/** Ekran içi (kart dışı) kullanım için birebir ölçek. */
export const unitScale: StoryScale = (units) => units;

/** Altın varak tonları: tüm paylaşım kartlarında ve sertifikada ortak. */
export const GOLD = {
  light: "#FBE9B7",
  base: "#E2B85C",
  deep: "#B8862E",
  ink: "#F3D58B",
  soft: "rgba(243, 213, 139, 0.78)",
  line: "rgba(226, 184, 92, 0.5)",
  wash: "rgba(226, 184, 92, 0.08)",
} as const;

/** (x, y) merkezli, r yarıçaplı dört kollu parıltı yıldızı (logodaki yıldızın biçimi). */
export function sparklePath(x: number, y: number, r: number): string {
  const k = r * 0.14;
  return (
    `M ${x} ${y - r} Q ${x + k} ${y - k} ${x + r} ${y} Q ${x + k} ${y + k} ${x} ${y + r} ` +
    `Q ${x - k} ${y + k} ${x - r} ${y} Q ${x - k} ${y - k} ${x} ${y - r} Z`
  );
}

export { seeded } from "@/lib/seededRandom";

/** Küçük altın CoupleSky işareti: kalp çizgisi ve sağ üstünde parıltı (açılış logosunun yalın hali). */
export function GoldMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <SvgLinearGradient id="goldMark" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={GOLD.light} />
          <Stop offset="0.55" stopColor={GOLD.base} />
          <Stop offset="1" stopColor={GOLD.deep} />
        </SvgLinearGradient>
      </Defs>
      <Path
        d="M12 20.5 C5.5 15.6 2.6 12.4 2.6 8.7 C2.6 5.9 4.8 3.8 7.4 3.8 C9.3 3.8 10.9 4.9 12 6.6 C13.1 4.9 14.7 3.8 16.6 3.8 C19.2 3.8 21.4 5.9 21.4 8.7 C21.4 12.4 18.5 15.6 12 20.5 Z"
        fill="none"
        stroke="url(#goldMark)"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path d={sparklePath(18.2, 5.6, 3.6)} fill={GOLD.light} />
    </Svg>
  );
}

/** Uçlara doğru sönen ince altın çizgi. */
export function GoldLine({ fade, style }: { fade: "left" | "right" | "both"; style?: StyleProp<ViewStyle> }) {
  const clear = "rgba(226, 184, 92, 0)";
  const colors =
    fade === "left"
      ? ([clear, GOLD.base] as const)
      : fade === "right"
        ? ([GOLD.base, clear] as const)
        : ([clear, GOLD.base, clear] as const);
  return <LinearGradient colors={colors} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={style} />;
}

/** Ortasında altın baklava olan ayraç çizgisi. */
export function GoldRule({ s, width, style }: { s: StoryScale; width: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width, flexDirection: "row", alignItems: "center", gap: s(6) }, style]}>
      <GoldLine fade="left" style={{ flex: 1, height: s(0.9) }} />
      <View style={{ width: s(4.5), height: s(4.5), backgroundColor: GOLD.base, transform: [{ rotate: "45deg" }] }} />
      <GoldLine fade="right" style={{ flex: 1, height: s(0.9) }} />
    </View>
  );
}

/** Seyrek harfli, iki yanı parıltılı küçük altın başlık. */
export function GoldKicker({ s, children, color = GOLD.ink }: { s: StoryScale; children: string; color?: string }) {
  return (
    <Text
      style={{
        color,
        fontSize: s(9.5),
        fontFamily: "Inter_700Bold",
        letterSpacing: s(2.8),
        // Son harfin ardındaki harf aralığı metni sola kaydırır: aynı pay soldan verilerek ortalanır
        paddingLeft: s(2.8),
        textAlign: "center",
      }}
    >
      {`✦  ${children.toLocaleUpperCase(caseLocale())}  ✦`}
    </Text>
  );
}

/** Çiftin baş harfleri: çift halkalı altın monogram. */
export function Monogram({
  s,
  initials,
  size = 44,
  ink = GOLD.ink,
  ring = GOLD.base,
}: {
  s: StoryScale;
  initials: string;
  size?: number;
  ink?: string;
  ring?: string;
}) {
  const d = s(size);
  return (
    <View
      style={{
        width: d,
        height: d,
        borderRadius: d / 2,
        borderWidth: s(1.2),
        borderColor: ring,
        backgroundColor: GOLD.wash,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          top: s(3),
          left: s(3),
          right: s(3),
          bottom: s(3),
          borderRadius: d / 2,
          borderWidth: s(0.6),
          borderColor: ring,
          opacity: 0.55,
        }}
      />
      <Text
        numberOfLines={1}
        style={{ color: ink, fontSize: s(size * 0.32), fontFamily: "PlayfairDisplay_400Regular_Italic", includeFontPadding: false }}
      >
        {initials}
      </Text>
    </View>
  );
}

/**
 * Dairesel altın folyo mühür: kenar boyunca çevrelenen yazı, iç halkalar ve ortada parıltı.
 * Yazı her harf ayrı döndürülerek çizilir (SVG textPath platformlar arasında tutarsız).
 */
export function FoilSeal({
  s,
  size,
  text,
  center,
  rotate = -12,
  ink = GOLD.ink,
}: {
  s: StoryScale;
  size: number;
  text: string;
  /** Ortadaki kısa yazı (ör. yıl); yoksa yalnızca parıltı */
  center?: string;
  rotate?: number;
  ink?: string;
}) {
  const d = s(size);
  const chars = Array.from(text);
  // Yazı bandı halkalar arasındadır; uzun metinlerde harfler sığsın diye punto küçülür
  const slot = (2 * Math.PI * 0.43 * d) / Math.max(chars.length, 1);
  const fontSize = Math.min(d * 0.082, slot * 1.25);

  return (
    <View style={{ width: d, height: d, transform: [{ rotate: `${rotate}deg` }] }}>
      <Svg width={d} height={d} viewBox="0 0 100 100">
        <Defs>
          <SvgLinearGradient id="foilSeal" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={GOLD.light} />
            <Stop offset="0.45" stopColor={GOLD.base} />
            <Stop offset="0.75" stopColor={GOLD.deep} />
            <Stop offset="1" stopColor={GOLD.light} />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={50} cy={50} r={48} fill={GOLD.wash} stroke="url(#foilSeal)" strokeWidth={2.4} />
        <Circle cx={50} cy={50} r={44.5} fill="none" stroke="url(#foilSeal)" strokeWidth={0.6} />
        <Circle cx={50} cy={50} r={31} fill="rgba(226, 184, 92, 0.12)" stroke="url(#foilSeal)" strokeWidth={1.2} />
        <Circle cx={50} cy={50} r={27.5} fill="none" stroke="url(#foilSeal)" strokeWidth={0.5} strokeDasharray="1 1.8" />
        <Path d={sparklePath(50, center ? 42 : 50, center ? 9 : 14)} fill="url(#foilSeal)" />
      </Svg>
      {chars.map((char, index) => (
        <View
          key={index}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: d * 0.07,
            width: d,
            height: d * 0.86,
            alignItems: "center",
            transform: [{ rotate: `${(index * 360) / chars.length}deg` }],
          }}
        >
          <Text style={{ color: ink, fontSize, lineHeight: fontSize * 1.2, fontFamily: "Inter_700Bold", includeFontPadding: false }}>
            {char}
          </Text>
        </View>
      ))}
      {center ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", paddingTop: d * 0.2 }]}>
          <Text style={{ color: ink, fontSize: d * 0.11, fontFamily: "Inter_800ExtraBold", letterSpacing: d * 0.01 }}>{center}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Buzlu cam istatistik rozeti (bulanıklaştırma yakalamada güvenilir olmadığından ışık degradesiyle). */
export function FrostedBadge({ s, glyph, value, caption }: { s: StoryScale; glyph: ReactNode; value: string; caption: string }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        borderRadius: s(16),
        overflow: "hidden",
        borderWidth: s(0.7),
        borderColor: "rgba(255, 255, 255, 0.24)",
        backgroundColor: "rgba(255, 255, 255, 0.07)",
        paddingVertical: s(11),
        paddingHorizontal: s(6),
      }}
    >
      <LinearGradient
        colors={["rgba(255, 255, 255, 0.17)", "rgba(255, 255, 255, 0.03)", "rgba(226, 184, 92, 0.07)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ height: s(24), justifyContent: "center" }}>{glyph}</View>
      <Text
        numberOfLines={2}
        style={{
          color: "#FFFFFF",
          fontSize: s(11.5),
          lineHeight: s(14.5),
          fontFamily: "Inter_600SemiBold",
          textAlign: "center",
          marginTop: s(5),
          minHeight: s(29),
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={2}
        style={{
          color: GOLD.soft,
          fontSize: s(7.4),
          lineHeight: s(10),
          fontFamily: "Inter_700Bold",
          letterSpacing: s(0.8),
          textAlign: "center",
          marginTop: s(3),
        }}
      >
        {caption.toLocaleUpperCase(caseLocale())}
      </Text>
    </View>
  );
}

/** Kartlardaki çift fotoğrafının kaynağı: özel bucket'taki yol ya da doğrudan adres (profil fotoğrafı, demo). */
export type StoryPhotoSource = { bucket: PrivateBucket; path: string } | { uri: string };

/**
 * Paylaşım kartındaki fotoğraf. Bilinçli olarak React Native `Image` kullanılır: expo-image Android'de görseli
 * donanım bitmap'i olarak çözebilir; yazılım tuvaline çizen view-shot onu çizemez ve dışa aktarma başarısız olur.
 */
export function StoryPhoto({ photo, style }: { photo: StoryPhotoSource; style?: StyleProp<ImageStyle> }) {
  const isDirect = "uri" in photo;
  const signed = useStorageImage(isDirect ? "photos" : photo.bucket, isDirect ? null : photo.path);
  const uri = isDirect ? photo.uri : signed?.uri;
  if (!uri) return null;
  return <Image source={{ uri }} style={style} resizeMode="cover" fadeDuration={0} />;
}

/** Fotoğraf yoksa çerçevenin içi: gül-mor geçiş ve ortada kalp. */
export function PhotoPlaceholder({ s, iconSize = 46 }: { s: StoryScale; iconSize?: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
      <LinearGradient colors={["#3A1029", "#22122E", "#1A0B16"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Heart size={s(iconSize)} color={GOLD.base} fill="rgba(226, 184, 92, 0.18)" strokeWidth={1.4} />
    </View>
  );
}

/**
 * Yakalamada da görünen yumuşak gölge: elevation / boxShadow yazılım tuvaline çizilmediğinden, kartın
 * altına kademeli kaydırılmış yarı saydam katmanlar konur. Sarmalanan öğeyle aynı köşe yuvarlaklığını alır.
 */
export function SoftShadow({ s, radius = 4 }: { s: StoryScale; radius?: number }) {
  return (
    <>
      <View
        pointerEvents="none"
        style={{ position: "absolute", left: s(3), right: -s(4), top: s(9), bottom: -s(9), borderRadius: s(radius + 4), backgroundColor: "rgba(0, 0, 0, 0.16)" }}
      />
      <View
        pointerEvents="none"
        style={{ position: "absolute", left: s(1), right: -s(2), top: s(4), bottom: -s(4), borderRadius: s(radius + 2), backgroundColor: "rgba(0, 0, 0, 0.26)" }}
      />
    </>
  );
}

/** Projedeki washi bandı kart ölçeğine büyütülmüş halde (bant 66×20 dp sabit çizildiği için). */
function StoryTape({ s, color, rotate, style }: { s: StoryScale; color: string; rotate: number; style: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[{ position: "absolute", width: 66, height: 20, zIndex: 3, transform: [{ scale: s(1.12) }] }, style]}>
      <WashiTape color={color} rotate={rotate} style={{ top: 0, left: 0 }} />
    </View>
  );
}

/** Hafif eğik, beyaz kenarlı Polaroid; üst köşelerine washi bant iliştirilmiş. */
export function Polaroid({
  s,
  width,
  photo,
  rotate = -3.5,
  caption,
}: {
  s: StoryScale;
  width: number;
  photo: StoryPhotoSource | null;
  rotate?: number;
  caption?: string | null;
}) {
  const pad = s(9);
  const side = width - pad * 2;
  return (
    <View style={{ width, transform: [{ rotate: `${rotate}deg` }] }}>
      <SoftShadow s={s} radius={3} />
      <View style={{ backgroundColor: "#FBF8F1", borderRadius: s(3), padding: pad, paddingBottom: s(36) }}>
        <View style={{ width: side, height: side, overflow: "hidden", backgroundColor: "#E9E1D3" }}>
          {photo ? <StoryPhoto photo={photo} style={StyleSheet.absoluteFill} /> : <PhotoPlaceholder s={s} />}
          {/* Fotoğraf kâğıdının parlaması */}
          <LinearGradient
            colors={["rgba(255, 255, 255, 0.18)", "rgba(255, 255, 255, 0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.6, y: 0.6 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
        {caption ? (
          <Text
            numberOfLines={1}
            style={{
              position: "absolute",
              left: pad,
              right: pad,
              bottom: s(10),
              textAlign: "center",
              color: "#5B4632",
              fontSize: s(12.5),
              fontFamily: "PlayfairDisplay_400Regular_Italic",
            }}
          >
            {caption}
          </Text>
        ) : null}
      </View>
      <StoryTape s={s} color={WASHI_COLORS.rose} rotate={-18} style={{ top: -s(8), left: -s(18) }} />
      <StoryTape s={s} color={WASHI_COLORS.kraft} rotate={16} style={{ top: -s(8), right: -s(18) }} />
    </View>
  );
}
