import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { appAlert } from "@/lib/dialog";
import { useLocalSearchParams, useRouter } from "expo-router";
import { isGentleCareFeeling } from "@/lib/gentleCare";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { RevenueCatService } from "@/lib/revenuecat";
import { PurchasesPackage } from "react-native-purchases";
import { X, ShieldCheck, Coins, ChevronDown, Users, Star, Images, HeartPulse, CalendarHeart, Mail, Sparkles, type LucideIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LegalModal } from "@/components/legal/LegalModal";
import { LegalDocType } from "@/constants/legalTexts";
import { toast } from "@/lib/toast";
import { suppressPremiumCelebration } from "@/lib/premiumCelebration";
import { freeTrialDays, purchaseButtonLabel } from "@/lib/trialLabel";
import { waitForServerPremium } from "@/lib/premiumSync";
import type { TFunction } from "i18next";
import { APP_NAME } from "@/constants/brand";
import { LazyDemoActionModal, LazyWatchAdModal } from "@/components/ui/lazyMount";
import { useTranslation } from "react-i18next";
import { PaywallHero, PREMIUM_GOLD } from "@/components/premium/PaywallHero";
import { PlanCard } from "@/components/premium/PlanCard";

const PACKAGE_ORDER = ["ANNUAL", "MONTHLY", "LIFETIME"];
const sortPackages = (pkgs: PurchasesPackage[]) =>
  [...pkgs].sort((a, b) => {
    const ia = PACKAGE_ORDER.indexOf(a.packageType);
    const ib = PACKAGE_ORDER.indexOf(b.packageType);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

const PLAN_KEY: Record<string, "monthly" | "annual" | "lifetime" | "other"> = {
  MONTHLY: "monthly",
  ANNUAL: "annual",
  LIFETIME: "lifetime",
};

/** Satın alma düğmesinin üzerinden geçen yavaş ışık süpürmesi (hareketi azalt açıkken durur). */
function Shimmer({ reduce }: { reduce: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    p.set(withDelay(900, withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }), -1)));
  }, [reduce, p]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -160 + p.get() * 560 }, { skewX: "-18deg" }] }));
  if (reduce) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { width: 90 }, style]}>
      <LinearGradient
        colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.42)", "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}


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

const ISO_PERIOD_PATTERN = /^P(d+)([WMY])$/;

/**
 * Fiyatın yanındaki dönem etiketi. Paket türü RevenueCat'te özel (CUSTOM) tanımlıysa mağazanın verdiği
 * ISO 8601 abonelik süresinden (ör. "P1M") çıkarılır; böylece dönem bilgisi boş kalmaz.
 */
function getPeriodLabel(pkg: PurchasesPackage, t: TFunction): string {
  const byType = getPackagePeriodLabel(pkg.packageType, t);
  if (byType) return byType;
  const match = ISO_PERIOD_PATTERN.exec(pkg.product.subscriptionPeriod ?? "");
  if (!match) return "";
  const count = Number(match[1]);
  if (match[2] === "W" && count === 1) return t("paywall.periods.week");
  if (match[2] === "Y" && count === 1) return t("paywall.periods.year");
  if (match[2] === "M") {
    if (count === 1) return t("paywall.periods.month");
    if (count === 2) return t("paywall.periods.twoMonths");
    if (count === 3) return t("paywall.periods.threeMonths");
    if (count === 6) return t("paywall.periods.sixMonths");
  }
  return "";
}

export default function PaywallScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { refreshProfile, isDemoMode, profile } = useAuth();
  const { theme, isLight } = useTheme();
  const insets = useSafeAreaInsets();

  // Partnerin paylaştığı kilitli bir hisse dokunularak gelindi (bkz. lib/gentleCare.ts).
  // GİZLİLİK: bu bağlamda ekranda döngü / regl kelimesi geçmez; ilgili özellik maddesi de listelenmez.
  const params = useLocalSearchParams<{ context?: string; feeling?: string }>();
  const isFeelingContext = params.context === "feeling";
  const sharedFeeling = isFeelingContext && isGentleCareFeeling(params.feeling) ? params.feeling : null;

  /** Premium açıldıktan sonra partnerin paylaştığı his gösterilir: bildirimin vaadi yerine gelir. */
  const revealSharedFeeling = useCallback(() => {
    if (!sharedFeeling) return;
    appAlert(
      t("paywall.feeling.revealTitle"),
      t(`notifications.push.gentleCare.feelings.${sharedFeeling}`)
    );
  }, [sharedFeeling, t]);

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const [demoPromptVisible, setDemoPromptVisible] = useState(false);
  const [adModalVisible, setAdModalVisible] = useState(false);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [selectedLegalDoc, setSelectedLegalDoc] = useState<LegalDocType>("subscription");

  const openLegal = (doc: LegalDocType) => {
    setSelectedLegalDoc(doc);
    setLegalModalVisible(true);
  };

  const fetchOfferings = useCallback(async () => {
    const pkgs = await RevenueCatService.getOfferings();
    const sorted = sortPackages(pkgs);
    setPackages(sorted);
    if (sorted.length > 0) {
      setSelectedPackage(sorted[0]); // yıllık paket önde: önerilen plan varsayılan seçili gelir
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

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/home');
    }
  }, [router]);

  // Bildirim gönderildikten sonra Premium alınmışsa satış ekranı gösterilmez: his doğrudan açılır.
  // Yalnızca ekranın açıldığı andaki duruma bakılır; bu ekranda yapılan satın alma kendi akışıyla açar.
  const [premiumOnArrival] = useState(() => !!profile?.isPremium);
  const revealedOnArrivalRef = useRef(false);
  useEffect(() => {
    if (!sharedFeeling || !premiumOnArrival || revealedOnArrivalRef.current) return;
    revealedOnArrivalRef.current = true;
    handleBack();
    revealSharedFeeling();
  }, [sharedFeeling, premiumOnArrival, handleBack, revealSharedFeeling]);

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
      if (!customerInfo && !RevenueCatService.isInitialized) {
        // Mağaza bağlantısı hiç kurulamadı: sessizce hiçbir şey olmasın
        toast.warning(t("paywall.storeUnavailable"));
        return;
      }
      const isEntitled = customerInfo && (typeof customerInfo.entitlements.active['Premium'] !== 'undefined' || typeof customerInfo.entitlements.active['couples_app_pro'] !== 'undefined');
      if (isEntitled) {
        const serverPremium = await waitForServerPremium(refreshProfile);
        if (serverPremium) {
          toast.success(t("paywall.activated"), { title: t("common.congratulations"), emoji: "👑", duration: 3400 });
          handleBack();
          revealSharedFeeling();
        } else {
          // Ödeme alındı ama sunucu Premium'u henüz yazmadı (webhook gecikmesi): "aktif" denmez, durum dürüstçe anlatılır
          toast.info(t("paywall.activationPending"), { duration: 7000 });
          handleBack();
        }
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
      const isEntitled = customerInfo && (typeof customerInfo.entitlements.active['Premium'] !== 'undefined' || typeof customerInfo.entitlements.active['couples_app_pro'] !== 'undefined');
      if (isEntitled) {
        const serverPremium = await waitForServerPremium(refreshProfile);
        if (serverPremium) {
          toast.success(t("paywall.restored"));
          handleBack();
          revealSharedFeeling();
        } else {
          toast.info(t("paywall.activationPending"), { duration: 7000 });
          handleBack();
        }
      } else {
        toast.info(t("paywall.noActiveSubscription"));
      }
    } catch {
      appAlert(t("common.error"), t("paywall.restoreFailed"));
    } finally {
      setPurchasing(false);
    }
  };

  type Feature = { text: string; Icon: LucideIcon };
  const features: Feature[] = isFeelingContext
    ? [
        { text: t("paywall.features.feelings"), Icon: Sparkles },
        { text: t("paywall.features.shared"), Icon: Users },
        { text: t("paywall.features.photos"), Icon: Images },
        { text: t("paywall.features.pastPhotos"), Icon: CalendarHeart },
        { text: t("paywall.features.letters"), Icon: Mail },
      ]
    : [
        { text: t("paywall.features.shared"), Icon: Users },
        { text: t("paywall.features.star"), Icon: Star },
        { text: t("paywall.features.photos"), Icon: Images },
        { text: t("paywall.features.periodMen"), Icon: HeartPulse },
        { text: t("paywall.features.pastPhotos"), Icon: CalendarHeart },
        { text: t("paywall.features.letters"), Icon: Mail },
      ];

  const gold = isLight ? "#A16207" : "#E6C055";
  const cardBg = isLight ? theme.unitBg : "rgba(255,255,255,0.05)";
  const hairline = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.10)";

  // Yıllık paketin aylığa göre tasarruf yüzdesi (fiyatlar mağazanın para biriminde, oran aynıdır)
  const monthlyPkg = packages.find((p) => p.packageType === "MONTHLY");
  const savePercent = (pkg: PurchasesPackage) => {
    if (pkg.packageType !== "ANNUAL" || !monthlyPkg) return 0;
    const full = monthlyPkg.product.price * 12;
    if (!(full > 0)) return 0;
    const pct = Math.round((1 - pkg.product.price / full) * 100);
    return pct >= 5 ? pct : 0;
  };

  // Satın alma özeti: seçili paketin fiyatı, dönemi, deneme sonrası tahsilatı ve iptal / cayma bilgisi
  const storeName = Platform.OS === "ios" ? "App Store" : "Google Play";
  const selectedPeriod = selectedPackage ? getPeriodLabel(selectedPackage, t) : "";
  const selectedTrialDays = freeTrialDays(selectedPackage);
  const selectedIsRecurring = !!selectedPackage && selectedPackage.packageType !== "LIFETIME";
  const summaryTextStyle = [styles.summaryText, { color: theme.textSecondary }];


  return (
    <ScreenBackground>
      {/* Üstte altın ışıma: sayfaya "premium" hissini veren tek büyük renk */}
      <LinearGradient
        pointerEvents="none"
        colors={isLight ? ["rgba(230,185,74,0.30)", "rgba(230,185,74,0)"] : ["rgba(230,185,74,0.22)", "rgba(230,185,74,0)"]}
        style={styles.topGlow}
      />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + (packages.length > 0 ? 170 : 40) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("a11y.close")}
          style={styles.closeBtn}
          onPress={handleBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View
            style={[
              styles.closeBtnCircle,
              {
                backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.10)",
                borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.14)",
              },
            ]}
          >
            <X color={theme.text} size={19} />
          </View>
        </TouchableOpacity>

        <PaywallHero
          eyebrow={isFeelingContext ? t("notifications.push.gentleCare.lockedTitle") : t("paywall.ui.eyebrow")}
          title={`${APP_NAME} Premium`}
          subtitle={isFeelingContext ? t("paywall.feeling.subtitle") : t("paywall.subtitle")}
          textColor={theme.text}
          subtitleColor={theme.textSecondary}
          goldText={gold}
          isLight={isLight}
        />

        <View style={[styles.featuresBox, { backgroundColor: cardBg, borderColor: hairline }]}>
          <Text style={[styles.sectionLabel, { color: gold }]}>{t("paywall.ui.featuresTitle")}</Text>
          {features.map(({ text, Icon }, i) => (
            <View key={i} style={[styles.featureRow, i === features.length - 1 && { marginBottom: 0 }]}>
              <LinearGradient colors={PREMIUM_GOLD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.featureIcon}>
                <Icon color="#3A2A06" size={16} strokeWidth={2.4} />
              </LinearGradient>
              <Text style={[styles.featureText, { color: theme.text }]}>{text}</Text>
            </View>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={gold} size="large" style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.packagesContainer}>
            {packages.length === 0 ? (
              <View style={[styles.unavailable, { backgroundColor: cardBg, borderColor: hairline }]}>
                <Text style={{ color: theme.textSecondary, textAlign: "center", marginBottom: 14, fontSize: 13.5, lineHeight: 20 }}>
                  {t("paywall.storeUnavailable")}
                </Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity onPress={retryOfferings} style={[styles.smallBtn, { backgroundColor: gold }]}>
                    <Text style={{ color: "#fff", fontFamily: "Inter_700Bold" }}>{t("common.tryAgain")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleBack} style={[styles.smallBtn, { borderWidth: 1, borderColor: hairline }]}>
                    <Text style={{ color: theme.textSecondary, fontFamily: "Inter_700Bold" }}>{t("paywall.goBack")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <Text style={[styles.sectionLabel, { color: gold, marginBottom: 0, marginLeft: 4 }]}>{t("paywall.ui.choosePlan")}</Text>
                {packages.map((pkg) => {
                  const planKey = PLAN_KEY[pkg.packageType] ?? "other";
                  const trial = freeTrialDays(pkg);
                  const save = savePercent(pkg);
                  const perMonth = pkg.packageType === "ANNUAL" ? pkg.product.pricePerMonthString : null;
                  const captionParts: string[] = [];
                  if (perMonth) captionParts.push(t("paywall.ui.perMonth", { price: perMonth }));
                  if (save) captionParts.push(t("paywall.ui.badge.save", { percent: save }));
                  if (pkg.packageType === "LIFETIME") captionParts.push(t("paywall.ui.lifetimeNote"));
                  return (
                    <PlanCard
                      key={pkg.identifier}
                      title={t(`paywall.ui.plans.${planKey}`)}
                      price={pkg.product.priceString}
                      period={pkg.packageType === "LIFETIME" ? "" : getPeriodLabel(pkg, t)}
                      caption={captionParts.join(" · ") || undefined}
                      badge={
                        pkg.packageType === "ANNUAL"
                          ? t("paywall.ui.badge.bestValue")
                          : pkg.packageType === "LIFETIME"
                          ? t("paywall.ui.badge.oneTime")
                          : undefined
                      }
                      badgeStrong={pkg.packageType === "ANNUAL"}
                      trial={trial ? t("paywall.ui.trialPill", { count: trial }) : undefined}
                      selected={selectedPackage?.identifier === pkg.identifier}
                      onPress={() => setSelectedPackage(pkg)}
                      isLight={isLight}
                      colors={{ text: theme.text, textSecondary: theme.textSecondary, cardBg, border: hairline, gold }}
                    />
                  );
                })}

                <View style={[styles.sharedChip, { backgroundColor: `${gold}12`, borderColor: `${gold}40` }]}>
                  <Users size={14} color={gold} />
                  <Text style={[styles.sharedChipText, { color: gold }]}>{t("paywall.ui.sharedChip")}</Text>
                </View>
              </>
            )}

            {/* Satın alma ve iptal bilgisi: mağaza kuralı gereği ekranda erişilebilir, ama sayfayı boğmasın diye açılır */}
            {selectedPackage && (
              <View style={[styles.summaryBox, { backgroundColor: cardBg, borderColor: hairline }]}>
                <Text style={[styles.summaryPrice, { color: theme.text }]}>
                  {t("paywall.summary.price", { price: selectedPackage.product.priceString, period: selectedPeriod }).trim()}
                </Text>
                {selectedIsRecurring && selectedTrialDays ? (
                  <Text style={summaryTextStyle}>
                    {t("paywall.summary.trial", {
                      count: selectedTrialDays,
                      price: selectedPackage.product.priceString,
                      period: selectedPeriod,
                    })}
                  </Text>
                ) : null}
                <TouchableOpacity
                  onPress={() => setDetailsOpen((v) => !v)}
                  style={styles.detailsToggle}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: detailsOpen }}
                >
                  <Text style={[styles.detailsToggleText, { color: gold }]}>
                    {detailsOpen ? t("paywall.ui.detailsHide") : t("paywall.ui.detailsShow")}
                  </Text>
                  <ChevronDown color={gold} size={15} style={detailsOpen ? { transform: [{ rotate: "180deg" }] } : undefined} />
                </TouchableOpacity>
                {detailsOpen ? (
                  <View style={{ gap: 8 }}>
                    {selectedIsRecurring ? <Text style={summaryTextStyle}>{t("paywall.summary.renewal", { store: storeName })}</Text> : null}
                    {selectedIsRecurring ? <Text style={summaryTextStyle}>{t("paywall.summary.shared")}</Text> : null}
                    {selectedIsRecurring ? <Text style={summaryTextStyle}>{t("paywall.summary.starGrace")}</Text> : null}
                    <Text style={summaryTextStyle}>{t("paywall.summary.confirm", { store: storeName })}</Text>
                    <Text style={summaryTextStyle}>{t("paywall.summary.withdrawal", { store: storeName })}</Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* İkincil eylemler: tek satırda eşit üç çip. Geri yükleme her zaman erişilebilir (Apple 3.1.1) */}
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, { borderColor: hairline, backgroundColor: cardBg }]}
                onPress={handleRestore}
                disabled={purchasing}
                accessibilityRole="button"
              >
                <ShieldCheck color={theme.textSecondary} size={15} />
                <Text style={[styles.chipText, { color: theme.textSecondary }]} numberOfLines={2}>
                  {t("paywall.restore")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, { borderColor: hairline, backgroundColor: cardBg }]}
                onPress={() => setAdModalVisible(true)}
                disabled={purchasing}
                accessibilityRole="button"
              >
                <Coins color={isLight ? "#B7791F" : "#E6C055"} size={15} />
                <Text style={[styles.chipText, { color: isLight ? "#B7791F" : "#E6C055" }]} numberOfLines={2}>
                  {t("paywall.watchAd", "🎬 Reklam İzleyerek +25 Token Kazan").replace(/^🎬\s*/, "")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Yasal Abonelik ve İade Bilgilendirmesi */}
            <View style={[styles.legalNoticeContainer, { borderTopColor: hairline }]}>
              <Text style={[styles.legalNoticeText, { color: theme.textSecondary }]}>{t("paywall.legalNotice")}</Text>
              <View style={styles.legalLinksRow}>
                <TouchableOpacity onPress={() => openLegal("terms")}>
                  <Text style={[styles.legalLinkText, { color: gold }]}>{t("paywall.links.terms")}</Text>
                </TouchableOpacity>
                <Text style={[styles.legalLinkDot, { color: theme.textMuted }]}>•</Text>
                <TouchableOpacity onPress={() => openLegal("privacy")}>
                  <Text style={[styles.legalLinkText, { color: gold }]}>{t("paywall.links.privacy")}</Text>
                </TouchableOpacity>
                <Text style={[styles.legalLinkDot, { color: theme.textMuted }]}>•</Text>
                <TouchableOpacity onPress={() => openLegal("subscription")}>
                  <Text style={[styles.legalLinkText, { color: gold }]}>{t("paywall.links.subscription")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Sabit satın alma çubuğu: plan ne kadar aşağı kaydırılırsa kaydırılsın düğme her zaman ekranda */}
      {!loading && packages.length > 0 && (
        <View pointerEvents="box-none" style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
          <LinearGradient
            pointerEvents="none"
            colors={isLight ? ["rgba(255,255,255,0)", "rgba(255,255,255,0.96)"] : ["rgba(8,12,24,0)", "rgba(8,12,24,0.96)"]}
            style={StyleSheet.absoluteFill}
          />
          <TouchableOpacity
            onPress={handlePurchase}
            disabled={purchasing || !selectedPackage}
            activeOpacity={0.88}
            accessibilityRole="button"
            style={[styles.ctaWrap, purchasing && { opacity: 0.75 }]}
          >
            <LinearGradient colors={PREMIUM_GOLD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaBtn}>
              {purchasing ? (
                <ActivityIndicator color="#3A2A06" />
              ) : (
                <Text style={styles.ctaBtnText}>{purchaseButtonLabel(selectedPackage, t)}</Text>
              )}
              <Shimmer reduce={reduceMotion} />
            </LinearGradient>
          </TouchableOpacity>
          <Text style={[styles.trustText, { color: theme.textSecondary }]}>
            {selectedPackage && selectedPackage.packageType !== "LIFETIME"
              ? `${t("paywall.ui.trust")} · ${storeName}`
              : t("paywall.ui.badge.oneTime")}
          </Text>
        </View>
      )}

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
        accentColor={gold}
      />
      <LazyWatchAdModal
        visible={adModalVisible}
        onClose={() => setAdModalVisible(false)}
        onSuccess={() => setAdModalVisible(false)}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  topGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 420 },
  container: { paddingHorizontal: 20 },
  closeBtn: { alignSelf: "flex-end" },
  closeBtnCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  sectionLabel: { fontSize: 11.5, fontFamily: "Inter_700Bold", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 16 },
  featuresBox: { padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 26 },
  featureRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  featureIcon: { width: 32, height: 32, borderRadius: 11, justifyContent: "center", alignItems: "center", marginRight: 14 },
  featureText: { fontSize: 15, lineHeight: 20, fontFamily: "Inter_600SemiBold", flex: 1, letterSpacing: -0.2 },
  packagesContainer: { gap: 4 },
  unavailable: { padding: 20, alignItems: "center", borderRadius: 18, borderWidth: 1 },
  smallBtn: { paddingVertical: 9, paddingHorizontal: 18, borderRadius: 10 },
  sharedChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 14,
  },
  sharedChipText: { fontSize: 12.5, fontFamily: "Inter_600SemiBold" },
  summaryBox: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 8, marginTop: 16 },
  summaryPrice: { fontSize: 15, fontFamily: "Inter_700Bold" },
  summaryText: { fontSize: 12.5, lineHeight: 18, fontFamily: "Inter_400Regular" },
  detailsToggle: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 2 },
  detailsToggleText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  chipRow: { flexDirection: "row", gap: 8, marginTop: 18 },
  chip: {
    flex: 1,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: { fontSize: 11.5, lineHeight: 14, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  legalNoticeContainer: { marginTop: 22, paddingTop: 16, borderTopWidth: 1, gap: 12, alignItems: "center" },
  legalNoticeText: { fontSize: 12, lineHeight: 17, textAlign: "center", fontFamily: "Inter_400Regular" },
  legalLinksRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 6 },
  legalLinkText: { fontSize: 11.5, fontFamily: "Inter_600SemiBold", textDecorationLine: "underline" },
  legalLinkDot: { fontSize: 11 },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 36 },
  ctaWrap: {
    borderRadius: 30,
    shadowColor: "#E6B94A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 10,
  },
  ctaBtn: { height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  ctaBtnText: { color: "#3A2A06", fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  trustText: { textAlign: "center", fontSize: 12, marginTop: 9, fontFamily: "Inter_500Medium" },
});
