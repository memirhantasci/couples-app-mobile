import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight, Play } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { AppTheme } from "@/lib/theme";

/** Premium olmayan bir kullanıcının mektup mühürlemek için ihtiyaç duyduğu token (bkz. letters.tsx → save_letter). */
export const LETTER_TOKEN_COST = 100;

interface Props {
  theme: AppTheme;
  tokenBalance: number;
  onPress: () => void;
}

/**
 * Mektuplar sayfasının üstündeki "reklam izle, mektup hakkı kazan" kartı. Mektup mühürlemek token ister;
 * kart bakiyeyi mektup bedeline göre gösterir ve ödüllü reklam penceresini açar. Tema rengini kullanır.
 */
export function LetterAdCard({ theme, tokenBalance, onPress }: Props) {
  const { t } = useTranslation();
  const progress = Math.min(1, Math.max(0, tokenBalance / LETTER_TOKEN_COST));
  const enough = tokenBalance >= LETTER_TOKEN_COST;
  const title = enough ? t("letters.adCard.readyTitle") : t("letters.adCard.title");
  const sub = enough
    ? t("letters.adCard.readySub")
    : t("letters.adCard.sub", { balance: tokenBalance, cost: LETTER_TOKEN_COST });

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      style={[styles.card, { backgroundColor: theme.cardBg, borderColor: `${theme.accent}40`, ...theme.cardShadow }]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[`${theme.accent}22`, `${theme.accent}00`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.iconTile, { backgroundColor: `${theme.accent}26`, borderColor: `${theme.accent}55` }]}>
        <Play size={20} color={theme.accent} fill={`${theme.accent}55`} />
      </View>
      <View style={styles.texts}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={2}>
          {sub}
        </Text>
        <View style={[styles.track, { backgroundColor: `${theme.accent}22` }]}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: theme.accent }]} />
        </View>
      </View>
      <View style={[styles.badge, { backgroundColor: theme.accent }]}>
        <Text style={styles.badgeText}>+25</Text>
      </View>
      <ChevronRight size={18} color={theme.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  iconTile: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  texts: { flex: 1, gap: 3 },
  title: { fontSize: 14.5, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  sub: { fontSize: 12, lineHeight: 16, fontFamily: "Inter_500Medium" },
  track: { height: 5, borderRadius: 3, overflow: "hidden", marginTop: 3 },
  fill: { height: 5, borderRadius: 3 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  badgeText: { color: "#FFFFFF", fontSize: 12, fontFamily: "Inter_700Bold" },
});
