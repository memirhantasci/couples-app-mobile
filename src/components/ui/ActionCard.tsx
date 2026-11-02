import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight, type LucideIcon } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";

interface ActionCardProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onPress: () => void;
  theme: AppTheme;
}

/**
 * Ekranın ana eylemi için geniş çağrı kartı.
 * Açık temada dolu vurgu rengi; koyu temada göz almasın diye dolgu yok: kart yüzeyi üzerinde
 * vurgu tonlu ikon karosu (parlak dolu zemin koyu zeminde neon gibi parlıyordu).
 */
export function ActionCard({ icon: Icon, title, subtitle, onPress, theme }: ActionCardProps) {
  const filled = theme.isLight;
  const titleColor = filled ? "#ffffff" : theme.text;
  const subtitleColor = filled ? "rgba(255,255,255,0.82)" : theme.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        filled
          ? { backgroundColor: theme.accent, shadowColor: theme.accent, shadowOpacity: 0.28, elevation: 6 }
          : { backgroundColor: theme.cardBg, shadowOpacity: 0 },
        pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
      ]}
    >
      {filled ? (
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={[styles.iconTile, { backgroundColor: filled ? "rgba(255,255,255,0.22)" : theme.pillAccentBg }]}>
        <Icon size={22} color={filled ? "#ffffff" : theme.accent} strokeWidth={2.2} />
      </View>
      <View style={styles.texts}>
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: subtitleColor }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={20} color={filled ? "rgba(255,255,255,0.85)" : theme.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 26,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 0,
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
});
