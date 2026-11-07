import React from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { Crown, Sparkles, X, Zap } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { PREMIUM_GOLD } from "@/components/premium/PaywallHero";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "expo-router";
import type { PremiumFeatureSource, PremiumPaywallProps as BasePremiumPaywallProps } from "./PremiumPaywall.types";
import { Trans, useTranslation } from "react-i18next";

interface PremiumPaywallProps extends BasePremiumPaywallProps {
  featureName?: string;         // "Mektup Yaz", "Fotoğraf Galerisi" vb.
  featureDescription?: string; // Opsiyonel açıklama
  featureSource?: PremiumFeatureSource;
  gender?: string | null;
  tokenOption?: {              // Token ile açılabilecekse
    cost: number;
    currentBalance: number;
    onUseTokens: () => void;
  };
  onWatchAd?: () => void;      // Reklam izle butonu (ileride)
}

export function PremiumPaywall({
  visible,
  onClose,
  featureName,
  featureDescription,
  featureSource = "general",
  tokenOption,
  onWatchAd,
}: PremiumPaywallProps) {
  const { t } = useTranslation();
  const { theme, isLight } = useTheme();
  const router = useRouter();
  const gold = isLight ? "#A16207" : "#E6C055";

  const featureCopy: Record<PremiumFeatureSource, { name: string; description: string; cta: string }> = {
    general: {
      name: t("paywall.copy.general.name"),
      description: t("paywall.copy.general.description"),
      cta: t("paywall.upgradeButton"),
    },
    star_claim: {
      name: t("paywall.copy.starClaim.name"),
      description: t("paywall.copy.starClaim.description"),
      cta: t("paywall.copy.starClaim.cta"),
    },
    exoplanet_create: {
      name: t("paywall.copy.exoplanetCreate.name"),
      description: t("paywall.copy.exoplanetCreate.description"),
      cta: t("paywall.copy.exoplanetCreate.cta"),
    },
    exoplanet_view: {
      name: t("paywall.copy.exoplanetView.name"),
      description: t("paywall.copy.exoplanetView.description"),
      cta: t("paywall.copy.exoplanetView.cta"),
    },
    exoplanet_auto: {
      name: t("paywall.copy.exoplanetAuto.name"),
      description: t("paywall.copy.exoplanetAuto.description"),
      cta: t("paywall.copy.exoplanetAuto.cta"),
    },
    avatar: {
      name: t("paywall.copy.avatar.name"),
      description: t("paywall.copy.avatar.description"),
      cta: t("paywall.copy.avatar.cta"),
    },
  };
  const resolvedFeature = featureCopy[featureSource];
  const resolvedFeatureName = featureName ?? resolvedFeature.name;
  const resolvedFeatureDescription = featureDescription ?? resolvedFeature.description;

  const features = [
    t("paywall.perks.star"),
    t("paywall.perks.letters"),
    t("paywall.perks.photos"),
    t("paywall.perks.period"),
    t("paywall.perks.specialDays"),
    t("paywall.perks.avatar"),
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: isLight ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.8)" }]}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.cardBg,
              borderColor: isLight ? "rgba(161,98,7,0.35)" : "rgba(230,185,74,0.35)",
              shadowColor: isLight ? "#000" : "#E6B94A",
            },
          ]}
        >
          {/* Close Button */}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("a11y.close")} style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <View
              style={[
                styles.closeBtnCircle,
                {
                  backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)",
                  borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.12)",
                },
              ]}
            >
              <X color={theme.text} size={18} />
            </View>
          </TouchableOpacity>

          {/* Crown Icon */}
          <LinearGradient colors={PREMIUM_GOLD} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.crownCircle}>
            <Crown color="#3A2A06" size={32} strokeWidth={2.2} />
          </LinearGradient>

          {/* Title */}
          <Text style={[styles.title, { color: theme.text }]}>{t("paywall.required")}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            <Trans
              i18nKey="paywall.featureGate"
              values={{ feature: resolvedFeatureName }}
              components={{ feature: <Text style={{ fontFamily: "Inter_700Bold", color: gold }} /> }}
            />
          </Text>

          <Text style={[styles.description, { color: theme.textMuted }]}>{resolvedFeatureDescription}</Text>

          {/* Premium Features List */}
          <View style={styles.featuresList}>
            {features.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Sparkles color={gold} size={14} />
                <Text style={[styles.featureText, { color: theme.text }]}>{f}</Text>
              </View>
            ))}
          </View>

          {/* CTA Button */}
          <TouchableOpacity
            style={styles.ctaWrap}
            onPress={() => {
              onClose();
              router.push("/paywall");
            }}
            activeOpacity={0.88}
            accessibilityRole="button"
          >
            <LinearGradient colors={PREMIUM_GOLD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaBtn}>
              <Crown color="#3A2A06" size={20} strokeWidth={2.4} />
              <Text style={styles.ctaBtnText}>{resolvedFeature.cta}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[styles.trialText, { color: theme.textMuted }]}>
            {t("paywall.cancelAnytime")}
          </Text>
          <TouchableOpacity 
            onPress={() => {
              onClose();
              router.push("/paywall");
            }}
            style={{ marginTop: 6 }}
          >
            <Text style={[styles.eulaLink, { color: gold }]}>
              {t("paywall.eulaLink")}
            </Text>
          </TouchableOpacity>

          {/* Token Option */}
          {tokenOption && (
            <View style={styles.tokenSection}>
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)" }]} />
                <Text style={[styles.dividerText, { color: theme.textMuted }]}>{t("common.or")}</Text>
                <View style={[styles.dividerLine, { backgroundColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)" }]} />
              </View>

              <TouchableOpacity
                style={[
                  styles.tokenBtn,
                  {
                    backgroundColor: isLight ? "rgba(234, 179, 8, 0.12)" : "rgba(230, 192, 85,0.08)",
                    borderColor: isLight ? "rgba(234, 179, 8, 0.3)" : "rgba(230, 192, 85,0.18)",
                  },
                  tokenOption.currentBalance < tokenOption.cost && { opacity: 0.4 },
                ]}
                disabled={tokenOption.currentBalance < tokenOption.cost}
                onPress={tokenOption.onUseTokens}
                activeOpacity={0.7}
              >
                <Zap color={isLight ? "#B45309" : "#E6C055"} size={18} />
                <Text style={[styles.tokenBtnText, { color: isLight ? "#B45309" : "#E6C055" }]}>
                  {t("paywall.useTokens", { cost: tokenOption.cost })}
                </Text>
                <Text style={[styles.tokenBalance, { color: isLight ? "rgba(180, 83, 9, 0.7)" : "rgba(230, 192, 85,0.6)" }]}>
                  {t("paywall.tokenBalance", { currentBalance: tokenOption.currentBalance })}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Reklam İzle Seçeneği */}
          {onWatchAd && (
            <View style={[styles.adSection, !tokenOption && styles.tokenSection]}>
              {!tokenOption && (
                <View style={styles.dividerRow}>
                  <View style={[styles.dividerLine, { backgroundColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)" }]} />
                  <Text style={[styles.dividerText, { color: theme.textMuted }]}>{t("common.or")}</Text>
                  <View style={[styles.dividerLine, { backgroundColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)" }]} />
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.adBtn,
                  {
                    backgroundColor: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)",
                    borderColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)",
                    marginTop: tokenOption ? 10 : 0,
                  },
                ]}
                onPress={onWatchAd}
                activeOpacity={0.7}
              >
                <Text style={[styles.adBtnText, { color: theme.textSecondary }]}>{t("paywall.watchAd")}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 28,
    padding: 26,
    alignItems: "center",
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
  },
  closeBtnCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  crownCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 6,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 18,
  },
  featuresList: {
    width: "100%",
    gap: 10,
    marginBottom: 22,
    marginTop: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureText: {
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
  },
  ctaWrap: {
    width: "100%",
    borderRadius: 18,
    shadowColor: "#E6B94A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  ctaBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 18,
  },
  ctaBtnText: {
    color: "#3A2A06",
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    letterSpacing: -0.2,
  },
  trialText: {
    fontSize: 11,
    marginTop: 10,
    textAlign: "center",
  },
  eulaLink: {
    fontSize: 11,
    textDecorationLine: "underline",
    fontFamily: "Inter_600SemiBold",
  },
  tokenSection: {
    width: "100%",
    marginTop: 16,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  tokenBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  tokenBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  tokenBalance: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  adSection: {
    width: "100%",
  },
  adBtn: {
    width: "100%",
    alignItems: "center",
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  adBtnText: {
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
  },
});
