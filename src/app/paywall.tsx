import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { appAlert } from "@/lib/dialog";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { RevenueCatService } from "@/lib/revenuecat";
import { PurchasesPackage } from "react-native-purchases";
import { X, Crown, Check, ShieldCheck } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LegalModal } from "@/components/legal/LegalModal";
import { LegalDocType } from "@/constants/legalTexts";
import { toast } from "@/lib/toast";
import { suppressPremiumCelebration } from "@/lib/premiumCelebration";
import { purchaseButtonLabel } from "@/lib/trialLabel";
import type { TFunction } from "i18next";
import { APP_NAME } from "@/constants/brand";
import { LazyDemoActionModal } from "@/components/ui/lazyMount";
import { useTranslation } from "react-i18next";


// `t` parametre olarak alınır: ekran render sırasında çağırır, dil değişince etiket yenilenir.
// packageType değerleri RevenueCat'in sabitleridir ve değişmez; yalnızca görünen etiket çevrilir.
function getPackagePeriodLabel(packageType: string | undefined, t: TFunction): string {
  switch (packageType) {
    case "ANNUAL":
      return t("paywall.periods.year");
    case "MONTHLY":
      return t("paywall.periods.month");
    case "WEEKLY":
      return t("paywall.periods.week");
    case "SIX_MONTH":
      return t("paywall.periods.sixMonths");
    case "THREE_MONTH":
      return t("paywall.periods.threeMonths");
    case "TWO_MONTH":
      return t("paywall.periods.twoMonths");
    case "LIFETIME":
      return t("paywall.periods.lifetime");
    default:
      return "";
  }
}

export default function PaywallScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { refreshProfile, isDemoMode } = useAuth();
  const { theme, isLight } = useTheme();
  const insets = useSafeAreaInsets();

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);

  const [demoPromptVisible, setDemoPromptVisible] = useState(false);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [selectedLegalDoc, setSelectedLegalDoc] = useState<LegalDocType>("subscription");

  const openLegal = (doc: LegalDocType) => {
    setSelectedLegalDoc(doc);
    setLegalModalVisible(true);
  };

  const fetchOfferings = useCallback(async () => {
    const pkgs = await RevenueCatService.getOfferings();
    setPackages(pkgs);
    if (pkgs.length > 0) {
      setSelectedPackage(pkgs[0]); // default to first package (often annual)
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const load = async () => {
      await fetchOfferings();
    };
    load();
  }, [fetchOfferings]);

  // Mağazaya bağlanılamadığında paketler yeniden istenir
  const retryOfferings = () => {
    setLoading(true);
    fetchOfferings();
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/home');
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage) return;
    // Demo (misafir) oturumunun sunucuda hesabı yoktur: satın alma ücretlendirilir ama abonelik hiçbir
    // hesaba tanımlanamaz. Önce hesap açtırılır.
    if (isDemoMode) {
      setDemoPromptVisible(true);
      return;
    }
    setPurchasing(true);
    // Satın alan cihazda ayrıca partner kutlaması çıkmasın (burada kendi "Tebrikler" bildirimi var)
    suppressPremiumCelebration();

    try {
      const customerInfo = await RevenueCatService.purchasePackage(selectedPackage);
      if (customerInfo && typeof customerInfo.entitlements.active['Premium'] !== "undefined") {
        await refreshProfile();
        toast.success(t("paywall.activated"), { title: t("common.congratulations"), emoji: "👑", duration: 3400 });
        handleBack();
      }
    } catch (e: any) {
      appAlert(t("paywall.purchaseFailedTitle"), e.message || t("errors.generic"));
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (isDemoMode) {
      setDemoPromptVisible(true);
      return;
    }
    setPurchasing(true);
    try {
      suppressPremiumCelebration();
      const customerInfo = await RevenueCatService.restorePurchases();
      if (customerInfo && typeof customerInfo.entitlements.active['Premium'] !== "undefined") {
        await refreshProfile();
        toast.success(t("paywall.restored"));
        handleBack();
      } else {
        toast.info(t("paywall.noActiveSubscription"));
      }
    } catch (e: any) {
      appAlert(t("common.error"), t("paywall.restoreFailed"));
    } finally {
      setPurchasing(false);
    }
  };

  const features = [
    t("paywall.features.shared"),
    t("paywall.features.photos"),
    t("paywall.features.periodMen"),
    t("paywall.features.pastPhotos"),
    t("paywall.features.letters"),
    t("paywall.features.noAds"),
  ];

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        
        <TouchableOpacity style={styles.closeBtn} onPress={handleBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <View
            style={[
              styles.closeBtnCircle,
              {
                backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.1)",
                borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.14)",
              },
            ]}
          >
            <X color={theme.text} size={20} />
          </View>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={[styles.crownCircle, { backgroundColor: `${theme.accent}18` }]}>
            <Crown color={theme.accent} size={48} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>{APP_NAME} Premium</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t("paywall.subtitle")}</Text>
        </View>

        <View
          style={[
            styles.featuresBox,
            {
              backgroundColor: isLight ? theme.unitBg : "rgba(255,255,255,0.03)",
              borderColor: isLight ? "rgba(0,0,0,0.06)" : theme.cardBorder,
              borderWidth: 1,
            },
          ]}
        >
          {features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={[styles.checkCircle, { backgroundColor: theme.accent }]}>
                <Check color="#fff" size={14} />
              </View>
              <Text style={[styles.featureText, { color: theme.text }]}>{f}</Text>
            </View>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={theme.accent} size="large" style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.packagesContainer}>
            {packages.length === 0 ? (
              <View
                style={{
                  padding: 20,
                  alignItems: "center",
                  backgroundColor: isLight ? theme.unitBg : "rgba(255,255,255,0.05)",
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: theme.cardBorder,
                }}
              >
                <Text style={{ color: theme.textSecondary, textAlign: "center", marginBottom: 12, fontSize: 13.5 }}>
                  {t("paywall.storeUnavailable")}
                </Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity onPress={retryOfferings} style={{ paddingVertical: 8, paddingHorizontal: 16, backgroundColor: theme.accent, borderRadius: 8 }}>
                    <Text style={{ color: "#fff", fontWeight: "bold" }}>{t("common.tryAgain")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleBack} style={{ paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: theme.cardBorder, borderRadius: 8 }}>
                    <Text style={{ color: theme.textSecondary, fontWeight: "bold" }}>{t("paywall.goBack")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              packages.map((pkg) => {
                const isSelected = selectedPackage?.identifier === pkg.identifier;
                return (
                  <TouchableOpacity
                    key={pkg.identifier}
                    activeOpacity={0.8}
                    style={[
                      styles.packageCard,
                      {
                        backgroundColor: theme.cardBg,
                        borderColor: isSelected ? theme.accent : isLight ? "rgba(0,0,0,0.08)" : theme.cardBorder,
                        shadowColor: isLight ? "#000" : theme.accent,
                      },
                    ]}
                    onPress={() => setSelectedPackage(pkg)}
                  >
                    <View style={styles.packageInfo}>
                      <Text style={[styles.packageTitle, { color: theme.text }]}>
                        {pkg.product.title.replace(/\s*\((?:Couples App|CoupleSky)\)/, "")}
                      </Text>
                      <Text style={[styles.packagePrice, { color: isSelected ? theme.accent : theme.textSecondary }]}>
                        {pkg.product.priceString}{(() => {
                          const period = getPackagePeriodLabel(pkg.packageType, t);
                          return period ? ` ${period}` : "";
                        })()}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radioOuter,
                        {
                          borderColor: isSelected
                            ? theme.accent
                            : isLight
                            ? "rgba(0,0,0,0.2)"
                            : "rgba(255,255,255,0.25)",
                        },
                      ]}
                    >
                      {isSelected && <View style={[styles.radioInner, { backgroundColor: theme.accent }]} />}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}

            {packages.length > 0 && (
              <TouchableOpacity
                style={[styles.ctaBtn, { backgroundColor: theme.accent }, purchasing && { opacity: 0.7 }]}
                onPress={handlePurchase}
                disabled={purchasing || !selectedPackage}
                activeOpacity={0.85}
              >
                {purchasing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.ctaBtnText}>{purchaseButtonLabel(selectedPackage, t)}</Text>
                )}
              </TouchableOpacity>
            )}

            {/* Paketler yüklenemese de her zaman görünür (Apple 3.1.1: geri yükleme her zaman erişilebilir olmalı) */}
            <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={purchasing}>
              <ShieldCheck color={theme.textMuted} size={16} />
              <Text style={[styles.restoreText, { color: theme.textMuted }]}>{t("paywall.restore")}</Text>
            </TouchableOpacity>

            {/* Yasal Abonelik ve İade Bilgilendirmesi */}
            <View
              style={[
                styles.legalNoticeContainer,
                { borderTopColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)" },
              ]}
            >
              <Text style={[styles.legalNoticeText, { color: theme.textMuted }]}>
                {t("paywall.legalNotice")}
              </Text>

              <View style={styles.legalLinksRow}>
                <TouchableOpacity onPress={() => openLegal("terms")}>
                  <Text style={[styles.legalLinkText, { color: theme.accent }]}>{t("paywall.links.terms")}</Text>
                </TouchableOpacity>
                <Text style={[styles.legalLinkDot, { color: theme.textMuted }]}>•</Text>
                <TouchableOpacity onPress={() => openLegal("privacy")}>
                  <Text style={[styles.legalLinkText, { color: theme.accent }]}>{t("paywall.links.privacy")}</Text>
                </TouchableOpacity>
                <Text style={[styles.legalLinkDot, { color: theme.textMuted }]}>•</Text>
                <TouchableOpacity onPress={() => openLegal("subscription")}>
                  <Text style={[styles.legalLinkText, { color: theme.accent }]}>{t("paywall.links.subscription")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <LazyDemoActionModal
        visible={demoPromptVisible}
        onClose={() => setDemoPromptVisible(false)}
        title={t("paywall.accountRequiredTitle")}
        description={t("paywall.accountRequiredDescription")}
      />
      <LegalModal
        visible={legalModalVisible}
        onClose={() => setLegalModalVisible(false)}
        initialDoc={selectedLegalDoc}
        accentColor={theme.accent}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  closeBtn: {
    alignSelf: "flex-end",
  },
  closeBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 28,
  },
  crownCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 16,
    letterSpacing: -0.2,
  },
  featuresBox: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 28,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  featureText: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  packagesContainer: {
    gap: 12,
  },
  packageCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderRadius: 18,
    borderWidth: 1.8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  packageInfo: {
    flex: 1,
  },
  packageTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  packagePrice: {
    fontSize: 14,
    fontWeight: "600",
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  ctaBtn: {
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
    letterSpacing: -0.2,
  },
  restoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 20,
  },
  restoreText: {
    fontSize: 14,
    fontWeight: "600",
  },
  legalNoticeContainer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 12,
    alignItems: "center",
  },
  legalNoticeText: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  legalLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  legalLinkText: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    textDecorationLine: "underline",
  },
  legalLinkDot: {
    fontSize: 11,
  },
});
