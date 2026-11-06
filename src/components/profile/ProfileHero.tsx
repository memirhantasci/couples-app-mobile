import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Crown, Heart, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { AppTheme } from "@/lib/theme";
import { EditableAvatar } from "@/components/avatar/EditableAvatar";

interface ProfileHeroProps {
  theme: AppTheme;
  name: string;
  isPremium: boolean;
  isPaired: boolean;
  tokenBalance: number;
  onEarnTokens?: () => void;
}

/** Ayarlar ekranının üstündeki profil kartı: büyük avatar + isim ve üç hızlı istatistik. */
export function ProfileHero({ theme, name, isPremium, isPaired, tokenBalance, onEarnTokens }: ProfileHeroProps) {
  const { t } = useTranslation();
  const gold = theme.isLight ? "#A16207" : "#E6C055";
  const dividerColor = theme.isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, ...theme.cardShadow }]}>
      {/* Üstten inen hafif vurgu rengi parıltısı */}
      <LinearGradient
        pointerEvents="none"
        colors={[`${theme.accent}38`, `${theme.accent}00`]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.identity}>
        <EditableAvatar name={name} size={76} />
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {name}
        </Text>
      </View>

      <View style={[styles.stats, { borderTopColor: dividerColor }]}>
        <TouchableOpacity
          style={styles.stat}
          onPress={onEarnTokens}
          disabled={!onEarnTokens}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${tokenBalance} ${t("profile.stats.tokens")}`}
        >
          <View style={styles.statValueRow}>
            <Text style={[styles.statValue, { color: gold }]}>🪙 {tokenBalance}</Text>
            {onEarnTokens && (
              <View
                style={[
                  styles.plusBadge,
                  {
                    backgroundColor: theme.isLight
                      ? "rgba(161, 98, 7, 0.12)"
                      : "rgba(230, 192, 85, 0.18)",
                  },
                ]}
              >
                <Plus size={10} color={gold} strokeWidth={3} />
              </View>
            )}
          </View>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>{t("profile.stats.tokens")}</Text>
        </TouchableOpacity>

        <View style={[styles.statDivider, { backgroundColor: dividerColor }]} />

        <View style={styles.stat}>
          <View style={styles.statValueRow}>
            {isPremium ? <Crown size={15} color={gold} /> : null}
            <Text style={[styles.statValue, { color: isPremium ? gold : theme.text }]}>
              {isPremium ? t("profile.stats.planPremium") : t("profile.stats.planFree")}
            </Text>
          </View>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>{t("profile.stats.plan")}</Text>
        </View>

        <View style={[styles.statDivider, { backgroundColor: dividerColor }]} />

        <View style={styles.stat}>
          <View style={styles.statValueRow}>
            {isPaired ? <Heart size={14} color={theme.accent} fill={theme.accent} /> : null}
            <Text style={[styles.statValue, { color: isPaired ? theme.accent : theme.text }]}>
              {isPaired ? t("profile.stats.paired") : t("profile.stats.single")}
            </Text>
          </View>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>{t("profile.stats.status")}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    overflow: "hidden",
  },
  identity: {
    alignItems: "center",
    gap: 12,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  name: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  plusBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11.5,
    fontFamily: "Inter_500Medium",
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
  },
});
