import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Crown, Sparkles, Check } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import { useTranslation } from "react-i18next";

interface PhotosLockCardProps {
  theme: AppTheme;
  isLight: boolean;
  onUpgrade: () => void;
}

// ─── LÜKS KİLİT KARTI (PREMIUMSIZ) ───────────────────────────────────────────
export function PhotosLockCard({ theme, isLight, onUpgrade }: PhotosLockCardProps) {
  const { t } = useTranslation();
  const perks = [
    t("photos.lock.perk1"),
    t("photos.lock.perk2"),
    t("photos.lock.perk3"),
  ];

  return (
    <View style={[styles.luxuryLockCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
      <View style={[styles.luxuryLockIconBox, { backgroundColor: theme.pillAccentBg }]}>
        <Crown color={theme.accent} size={32} />
      </View>

      <View style={styles.vipBadge}>
        <Sparkles size={13} color={isLight ? "#A16207" : "#ffd700"} />
        <Text style={[styles.vipBadgeText, isLight && { color: "#A16207" }]}>{t("paywall.vipBadge")}</Text>
      </View>

      <Text style={[styles.luxuryLockTitle, { color: theme.text }]}>{t("photos.lock.title")}</Text>
      <Text style={[styles.luxuryLockDesc, { color: theme.textSecondary }]}>
        {t("photos.lock.description")}
      </Text>

      <View style={[styles.perksList, { backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)", borderColor: theme.cardBorder }]}>
        {perks.map((perk) => (
          <View key={perk} style={styles.perkItem}>
            <View style={styles.perkBullet}>
              <Check size={12} color="#22c55e" strokeWidth={3} />
            </View>
            <Text style={[styles.perkText, { color: theme.text }]}>{perk}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.upgradeBtn, { backgroundColor: theme.accent }]}
        onPress={onUpgrade}
        activeOpacity={0.88}
      >
        <Crown color="#ffffff" size={17} />
        <Text style={styles.upgradeBtnText}>{t("paywall.discoverPerks")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  luxuryLockCard: {
    margin: 16,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  luxuryLockIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  vipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 215, 0, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.3)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 12,
  },
  vipBadgeText: {
    color: "#ffd700",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  luxuryLockTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    textAlign: "center",
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  luxuryLockDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  perksList: {
    width: "100%",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginBottom: 20,
  },
  perkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  perkBullet: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  perkText: {
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.85)",
    flex: 1,
  },
  upgradeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    height: 48,
    borderRadius: 16,
  },
  upgradeBtnText: {
    color: "#ffffff",
    fontSize: 14.5,
    fontFamily: "Inter_700Bold",
  },
});
