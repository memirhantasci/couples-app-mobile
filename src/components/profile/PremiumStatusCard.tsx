import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AlertTriangle, ChevronRight, Crown } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { AppTheme } from "@/lib/theme";
import { derivePremiumPhase } from "@/lib/premiumStatus";

interface PremiumStatusCardProps {
  theme: AppTheme;
  isPremium: boolean;
  premiumExpiresAt: string | null | undefined;
  /** Demo oturumunda Premium açık sayılır */
  isDemoMode?: boolean;
  onPress: () => void;
}

/**
 * Ayarlar ekranındaki Premium kısayolu: durumu tek bakışta gösterir ve Premium ekranına (abonelik yönetimi) götürür.
 * Yenileme süresi işlerken (14 gün) amber uyarı rengine döner ve kalan günü yazar.
 */
export function PremiumStatusCard({ theme, isPremium, premiumExpiresAt, isDemoMode, onPress }: PremiumStatusCardProps) {
  const { t } = useTranslation();
  const result = derivePremiumPhase({ isPremium, premiumExpiresAt });
  const phase = isDemoMode ? "active" : result.phase;
  const gold = theme.isLight ? "#A16207" : "#E6C055";
  const warn = phase === "grace";
  const tint = warn ? "#F59E0B" : phase === "active" || phase === "lifetime" ? gold : theme.accent;

  const title =
    phase === "grace"
      ? t("profile.premiumCard.grace.title")
      : phase === "expired"
        ? t("profile.premiumCard.expired.title")
        : phase === "free"
          ? t("profile.premiumCard.free.title")
          : t("profile.premiumCard.active.title");
  const sub =
    phase === "grace"
      ? t("profile.premiumCard.grace.sub", { days: result.graceDaysLeft ?? 14 })
      : phase === "expired"
        ? t("profile.premiumCard.expired.sub")
        : phase === "free"
          ? t("profile.premiumCard.free.sub")
          : phase === "lifetime"
            ? t("profile.premiumCard.lifetime.sub")
            : t("profile.premiumCard.active.sub");

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      style={[styles.card, { backgroundColor: theme.cardBg, borderColor: `${tint}55`, ...theme.cardShadow }]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[`${tint}30`, `${tint}00`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.iconTile, { backgroundColor: `${tint}26`, borderColor: `${tint}55` }]}>
        {warn ? <AlertTriangle size={22} color={tint} /> : <Crown size={22} color={tint} fill={`${tint}33`} />}
      </View>
      <View style={styles.texts}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.sub, { color: warn ? tint : theme.textSecondary }]} numberOfLines={2}>
          {sub}
        </Text>
      </View>
      <ChevronRight size={20} color={theme.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  sub: { fontSize: 12.5, lineHeight: 17, fontFamily: "Inter_500Medium" },
});
