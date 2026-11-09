import { Text, View, type TextStyle } from "react-native";

interface PosterLineProps {
  /** Satır kutusunun gerçek ölçüleri */
  width: number;
  height: number;
  marginTop: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  letterSpacing?: number;
  /** Uzun metin bu orana kadar küçülür */
  minimumFontScale?: number;
  style?: TextStyle;
  children: string;
}

/**
 * Yüksekliği sabit, tek satırlık poster yazısı: uzun metin küçülür, satır büyümez, dikey bütçe bozulmaz.
 * Paylaşılan görsel cihazın yazı büyüklüğü ayarına bağlı olmasın diye allowFontScaling kapalıdır.
 */
export function PosterLine({ width, height, marginTop, fontSize, fontFamily, color, letterSpacing, minimumFontScale = 0.55, style, children }: PosterLineProps) {
  return (
    <View style={{ width, height, marginTop, justifyContent: "center" }}>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={minimumFontScale}
        style={[{ fontSize, lineHeight: height, fontFamily, color, letterSpacing, textAlign: "center", includeFontPadding: false }, style]}
      >
        {children}
      </Text>
    </View>
  );
}

/** Boş ya da yalnızca boşluktan oluşan isteğe bağlı metni yok sayar. */
export function cleanLine(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
