import type { RefObject } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StoryCard } from "./StoryCard";
import { GOLD, GoldKicker, GoldRule, Monogram, PhotoPlaceholder, StoryPhoto, type StoryPhotoSource } from "./storyDecor";

const ARCH_WIDTH = 212;
const ARCH_HEIGHT = 250;

interface MilestoneStoryCardProps {
  width: number;
  cardRef: RefObject<View | null>;
  /** Küçük altın başlık (ör. "YILDÖNÜMÜMÜZ") */
  kicker: string;
  /** Büyük altın ibare: "1. Yılımız" / "#500 Gün" */
  headline: string;
  /** İbarenin altındaki italik satır (birlikte geçen gün sayısı ya da anının adı) */
  subtitle: string | null;
  /** "12 Şubat 2025 · İlk günümüz" */
  dateLine: string | null;
  names: string | null;
  initials: string | null;
  cover: StoryPhotoSource | null;
}

/** Yıldönümünün sinematik 9:16 hikâye kartı: altın kemer çerçevede çift fotoğrafı ve üzerinde büyük altın ibare. */
export function MilestoneStoryCard({
  width,
  cardRef,
  kicker,
  headline,
  subtitle,
  dateLine,
  names,
  initials,
  cover,
}: MilestoneStoryCardProps) {
  return (
    <StoryCard width={width} cardRef={cardRef}>
      {(s) => {
        const archRadius = s(ARCH_WIDTH / 2);
        return (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <GoldKicker s={s}>{kicker}</GoldKicker>

            {/* Altın kemer çerçeve: dış altın kenar, ince iç çizgi ve alta doğru sinematik kararma */}
            <View
              style={{
                marginTop: initials ? s(30) : s(16),
                width: s(ARCH_WIDTH),
                height: s(ARCH_HEIGHT),
                borderTopLeftRadius: archRadius,
                borderTopRightRadius: archRadius,
                borderBottomLeftRadius: s(16),
                borderBottomRightRadius: s(16),
                borderWidth: s(1.4),
                borderColor: GOLD.base,
                padding: s(5),
              }}
            >
              <View
                style={{
                  flex: 1,
                  overflow: "hidden",
                  borderTopLeftRadius: archRadius - s(5),
                  borderTopRightRadius: archRadius - s(5),
                  borderBottomLeftRadius: s(12),
                  borderBottomRightRadius: s(12),
                  backgroundColor: "#1A0B16",
                }}
              >
                {cover ? <StoryPhoto photo={cover} style={StyleSheet.absoluteFill} /> : <PhotoPlaceholder s={s} iconSize={54} />}
                <LinearGradient
                  colors={["rgba(10, 10, 12, 0)", "rgba(10, 10, 12, 0.12)", "rgba(14, 8, 18, 0.94)"]}
                  locations={[0, 0.5, 1]}
                  style={StyleSheet.absoluteFill}
                />
              </View>
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: s(2.4),
                  left: s(2.4),
                  right: s(2.4),
                  bottom: s(2.4),
                  borderTopLeftRadius: archRadius - s(2.4),
                  borderTopRightRadius: archRadius - s(2.4),
                  borderBottomLeftRadius: s(14),
                  borderBottomRightRadius: s(14),
                  borderWidth: s(0.5),
                  borderColor: GOLD.line,
                }}
              />
              {initials ? (
                <View style={{ position: "absolute", top: -s(19), alignSelf: "center" }}>
                  <View style={{ backgroundColor: "#120A16", borderRadius: s(20) }}>
                    <Monogram s={s} initials={initials} size={38} />
                  </View>
                </View>
              ) : null}
            </View>

            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
              style={{
                marginTop: -s(36),
                maxWidth: s(300),
                color: GOLD.ink,
                fontSize: s(44),
                lineHeight: s(52),
                fontFamily: "PlayfairDisplay_700Bold",
                textAlign: "center",
                textShadowColor: "rgba(0, 0, 0, 0.65)",
                textShadowOffset: { width: 0, height: s(2) },
                textShadowRadius: s(10),
              }}
            >
              {headline}
            </Text>
            {subtitle ? (
              <Text
                numberOfLines={2}
                style={{
                  marginTop: s(4),
                  maxWidth: s(280),
                  color: "rgba(255, 255, 255, 0.88)",
                  fontSize: s(14),
                  lineHeight: s(20),
                  fontFamily: "PlayfairDisplay_400Regular_Italic",
                  textAlign: "center",
                }}
              >
                {subtitle}
              </Text>
            ) : null}

            <GoldRule s={s} width={s(132)} style={{ marginTop: s(12) }} />

            {dateLine ? (
              <Text style={{ marginTop: s(10), color: GOLD.soft, fontSize: s(10), fontFamily: "Inter_600SemiBold", letterSpacing: s(0.6) }}>
                {dateLine}
              </Text>
            ) : null}
            {names ? (
              <Text
                numberOfLines={1}
                style={{ marginTop: s(6), color: "#FFFFFF", fontSize: s(16), lineHeight: s(22), fontFamily: "PlayfairDisplay_400Regular_Italic" }}
              >
                {names}
              </Text>
            ) : null}
          </View>
        );
      }}
    </StoryCard>
  );
}
