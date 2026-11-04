import { memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight, MoonStar } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";

interface StarHibernationCardProps {
  /** Yıldızın uyanması için kalan gün (bilinmiyorsa null) */
  daysLeft: number | null;
  onPress: () => void;
}

/**
 * Ana sayfadaki sakin bilgi kartı: Premium'u biten çiftin yıldızı kış uykusundayken (grace_period) kalan günü
 * gösterir ve dokunulunca kış uykusu penceresini açar. Gökyüzüne girmeyen çift de uykuyu fark eder.
 * Dikkat çekmek yerine yumuşak bir indigo tonu kullanır; hareket yoktur.
 */
export const StarHibernationCard = memo(function StarHibernationCard({ daysLeft, onPress }: StarHibernationCardProps) {
  const { t } = useTranslation();
  const { theme, isLight } = useTheme();

  const accent = isLight ? "#4F46E5" : "#A5B4FC";
  const subtitle =
    daysLeft !== null ? t("home.hibernation.daysLeft", { count: daysLeft }) : t("home.hibernation.hint");

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t("home.hibernation.title")}. ${subtitle}`}
      style={[
        styles.wrap,
        { borderColor: isLight ? "rgba(79, 70, 229, 0.18)" : "rgba(165, 180, 252, 0.2)" },
      ]}
    >
      <LinearGradient
        colors={isLight ? ["rgba(99, 102, 241, 0.10)", "rgba(167, 139, 250, 0.05)"] : ["rgba(99, 102, 241, 0.16)", "rgba(109, 40, 217, 0.07)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <LinearGradient
          colors={isLight ? ["#6366F1", "#A78BFA"] : ["#312E81", "#6D28D9"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconCircle}
        >
          <MoonStar size={18} color="#E0E7FF" />
        </LinearGradient>

        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {t("home.hibernation.title")}
          </Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={2}>
            {subtitle}
            {daysLeft !== null ? ` · ${t("home.hibernation.hint")}` : ""}
          </Text>
        </View>

        <ChevronRight size={18} color={accent} />
      </LinearGradient>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  gradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  sub: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
