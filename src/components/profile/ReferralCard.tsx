import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight, Gift, Sparkles } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { AppTheme } from "@/lib/theme";

interface ReferralCardProps {
  theme: AppTheme;
  /** Ödül süresi (sunucudaki referral_reward_period) */
  rewardDays: number;
  onPress: () => void;
}

/**
 * Ayarlar ekranındaki "Çift Arkadaşlarımızı Davet Et" hediye kartı: davet penceresini (ReferralModal) açar.
 * Tema rengini kullanır (arayüz bütünlüğü); Premium kartından dolu yerine yarı saydam ikon karesiyle ayrışır.
 */
export function ReferralCard({ theme, rewardDays, onPress }: ReferralCardProps) {
  const { t } = useTranslation();
  const title = t("referral.card.title");
  const sub = t("referral.card.sub", { days: rewardDays });

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      accessibilityHint={t("referral.card.a11y")}
      style={[styles.card, { backgroundColor: theme.cardBg, borderColor: `${theme.accent}40`, ...theme.cardShadow }]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[`${theme.accent}22`, `${theme.accent}0D`, `${theme.accent}00`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Sparkles pointerEvents="none" size={14} color={`${theme.accent}99`} style={styles.sparkleTop} />
      <Sparkles pointerEvents="none" size={10} color={`${theme.accent}77`} style={styles.sparkleBottom} />

      <View style={[styles.iconTile, { backgroundColor: `${theme.accent}26`, borderColor: `${theme.accent}55` }]}>
        <Gift size={22} color={theme.accent} />
      </View>
      <View style={styles.texts}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          {title}
        </Text>
        <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={2}>
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
  sparkleTop: { position: "absolute", top: 10, right: 44 },
  sparkleBottom: { position: "absolute", bottom: 12, right: 70 },
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
