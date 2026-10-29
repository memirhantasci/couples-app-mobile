import React, { memo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Heart } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import { CALENDAR_COLORS } from "./calendarColors";
import { useTranslation } from "react-i18next";

interface NoteMemoryCardProps {
  text: string;
  authorName: string;
  avatarUrl?: string | null;
  /** "HH:mm" biçiminde, yoksa gösterilmez. */
  time?: string | null;
  /** Notu yazan kişi kullanıcının kendisi mi? (avatar rengi ve imza tonu değişir) */
  isMe: boolean;
  theme: AppTheme;
  isLight: boolean;
}

const SERIF = Platform.select({ ios: "Georgia", android: "serif", default: "serif" });

/**
 * Takvimdeki "Günün Notları" için hatıra defteri sayfası görünümlü kart:
 * yumuşak gül tonlu zemin, iri süslü tırnak işaretleri, zarif serif yazı ve
 * minik avatarlı imza satırı. Kaba bir kenar çizgisi yok; derinlik hafif bir gölgeden gelir.
 */
export const NoteMemoryCard = memo(function NoteMemoryCard({
  text,
  authorName,
  avatarUrl,
  time,
  isMe,
  theme,
  isLight,
}: NoteMemoryCardProps) {
  const { t } = useTranslation();
  const rose = CALENDAR_COLORS.note;
  const tint = isMe ? ["#F59E0B", "#F472B6"] : ["#F472B6", "#A78BFA"];
  const initial = (authorName.trim().charAt(0) || "♥").toUpperCase();

  return (
    <View
      style={[
        styles.shadow,
        {
          shadowColor: rose,
          shadowOpacity: isLight ? 0.16 : 0.28,
          backgroundColor: theme.cardBg,
          borderColor: isLight ? "rgba(236,72,153,0.16)" : "rgba(244,114,182,0.2)",
        },
      ]}
    >
      <View style={styles.clip}>
        {/* Sayfa zemini: sol üstten yayılan sıcak gül ışıltısı */}
        <LinearGradient
          colors={
            isLight
              ? ["rgba(253,164,175,0.28)", "rgba(255,255,255,0)"]
              : ["rgba(244,114,182,0.2)", "rgba(244,114,182,0)"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 0.9 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Süslü açılış tırnağı */}
        <Text style={[styles.quoteOpen, { color: rose }]} pointerEvents="none">
          “
        </Text>

        <Text style={[styles.noteText, { color: theme.text }]}>{text}</Text>

        {/* Kapanış tırnağı */}
        <Text style={[styles.quoteClose, { color: rose }]} pointerEvents="none">
          ”
        </Text>

        {/* Kalpli ince ayraç */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: isLight ? "rgba(236,72,153,0.18)" : "rgba(244,114,182,0.22)" }]} />
          <Heart size={11} color={rose} fill={rose} />
          <View style={[styles.dividerLine, { backgroundColor: isLight ? "rgba(236,72,153,0.18)" : "rgba(244,114,182,0.22)" }]} />
        </View>

        {/* İmza: avatar · isim · saat */}
        <View style={styles.signatureRow}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={tint as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={styles.avatarInitial}>{initial}</Text>
            </LinearGradient>
          )}

          <View style={styles.signatureText}>
            <Text style={[styles.author, { color: theme.text }]} numberOfLines={1}>
              {authorName}
            </Text>
            <Text style={[styles.byline, { color: theme.textMuted }]} numberOfLines={1}>
              {isMe ? t("calendar.note.yours") : t("calendar.note.fromPartner")}
            </Text>
          </View>

          {!!time && (
            <View style={[styles.timePill, { backgroundColor: isLight ? "rgba(236,72,153,0.08)" : "rgba(255,255,255,0.07)" }]}>
              <Text style={[styles.timeText, { color: theme.textSecondary }]}>{time}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 22,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 4,
  },
  clip: {
    borderRadius: 21,
    overflow: "hidden",
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 16,
  },
  quoteOpen: {
    position: "absolute",
    top: -6,
    left: 12,
    fontSize: 78,
    lineHeight: 96,
    fontFamily: SERIF,
    opacity: 0.28,
  },
  quoteClose: {
    position: "absolute",
    right: 14,
    bottom: 48,
    fontSize: 52,
    lineHeight: 64,
    fontFamily: SERIF,
    opacity: 0.18,
  },
  noteText: {
    fontSize: 16,
    lineHeight: 25,
    fontFamily: SERIF,
    fontStyle: "italic",
    letterSpacing: 0.1,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    marginBottom: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth * 2,
    borderRadius: 1,
  },
  signatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarInitial: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  signatureText: {
    flex: 1,
    minWidth: 0,
  },
  author: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  byline: {
    fontSize: 10.5,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  timePill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  timeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
