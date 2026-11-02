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

/** Ekranın ana eylemi için dolu vurgu renkli, üstten ışıklı geniş çağrı kartı. */
export function ActionCard({ icon: Icon, title, subtitle, onPress, theme }: ActionCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.accent, shadowColor: theme.accent, shadowOpacity: theme.isLight ? 0.28 : 0.1 },
        pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        // Açık temada üstten ışık, koyu temada dolgu rengini bastıran hafif koyulaştırma (göz almasın)
        colors={theme.isLight ? ["rgba(255,255,255,0.22)", "rgba(255,255,255,0)"] : ["rgba(0,0,0,0.12)", "rgba(0,0,0,0.30)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.iconTile}>
        <Icon size={22} color="#ffffff" strokeWidth={2.4} />
      </View>
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={20} color="rgba(255,255,255,0.85)" />
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
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: "#ffffff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  subtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
});
