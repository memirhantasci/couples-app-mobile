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

const ROSE = "#EC4899";
const GOLD = "#F59E0B";

/**
 * Ayarlar ekranındaki "Çift Arkadaşlarımızı Davet Et" hediye kartı: davet penceresini (ReferralModal) açar.
 * Gül-altın parıltısı Premium kartının altın tonundan ayrışır.
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
      style={[styles.card, { backgroundColor: theme.cardBg, borderColor: `${ROSE}55`, ...theme.cardShadow }]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[`${ROSE}2E`, `${GOLD}14`, `${GOLD}00`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Sparkles pointerEvents="none" size={14} color={`${GOLD}AA`} style={styles.sparkleTop} />
      <Sparkles pointerEvents="none" size={10} color={`${ROSE}99`} style={styles.sparkleBottom} />

      <LinearGradient colors={[ROSE, GOLD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconTile}>
        <Gift size={22} color="#FFFFFF" />
      </LinearGradient>
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
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ROSE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  texts: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  sub: { fontSize: 12.5, lineHeight: 17, fontFamily: "Inter_500Medium" },
});
