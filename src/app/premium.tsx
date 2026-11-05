import { useEffect, useState, type ReactNode } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking, Platform } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AlertTriangle,
  CalendarHeart,
  ChevronRight,
  CreditCard,
  Crown,
  Gift,
  HeartPulse,
  Images,
  Info,
  Mail,
  RotateCcw,
  Sparkles,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { dayjs } from "@/lib/date";
import { RevenueCatService } from "@/lib/revenuecat";
import { waitForServerPremium } from "@/lib/premiumSync";
import { suppressPremiumCelebration } from "@/lib/premiumCelebration";
import { PREMIUM_GRACE_DAYS, PREMIUM_VAULT_DAYS } from "@/lib/premiumStatus";
import { usePremiumDetails } from "@/hooks/usePremiumDetails";
import { toast } from "@/lib/toast";
import { appAlert } from "@/lib/dialog";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Reveal } from "@/components/ui/Reveal";
import { LegalModal } from "@/components/legal/LegalModal";
import { PromoCodeModal } from "@/components/ui/PromoCodeModal";
import { LazyDemoActionModal } from "@/components/ui/lazyMount";
import type { LegalDocType } from "@/constants/legalTexts";
import { ANDROID_PACKAGE } from "@/constants/brand";

type Tone = "gold" | "warn" | "neutral";

/** Mağazanın abonelik yönetim sayfası: RevenueCat'in verdiği adres, yoksa platformun genel sayfası. */
function fallbackManageUrl(): string {
  return Platform.OS === "ios"
    ? "https://apps.apple.com/account/subscriptions"
    : `https://play.google.com/store/account/subscriptions?package=${ANDROID_PACKAGE}`;
}

export default function PremiumScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isLight } = useTheme();
  const { refreshProfile, isDemoMode, profile } = useAuth();
  const details = usePremiumDetails();
  const reduceMotion = useReducedMotion();

  const [busy, setBusy] = useState(false);
  const [demoPromptVisible, setDemoPromptVisible] = useState(false);
  const [codeModalVisible, setCodeModalVisible] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDocType | null>(null);

  const { phase, entitlement, hasStar, daysUntilEnd, graceDaysLeft, graceEndsAt } = details;
  const gold = isLight ? "#A16207" : "#E6C055";
  const storeName = Platform.OS === "ios" ? "App Store" : "Google Play";

  const expiryDate = profile?.premiumExpiresAt ? dayjs(profile.premiumExpiresAt).format("D MMMM YYYY") : "";
  const graceEndDate = graceEndsAt ? dayjs(graceEndsAt).format("D MMMM YYYY") : "";
  const cancelled = phase === "active" && entitlement !== null && !entitlement.willRenew;
  const billingIssue = phase === "active" && entitlement?.hasBillingIssue === true;
  const ownSubscription = entitlement !== null;
  const sharedFromPartner = phase === "active" && !ownSubscription && !details.loading;

  // Taç hafifçe "nefes alır" (hareketi azalt açıkken sabit)
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.set(
      withRepeat(
        withSequence(
          withTiming(1.07, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) })
        ),
        -1
      )
    );
  }, [reduceMotion, pulse]);
  const crownStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));

  // ── Üst kart içeriği ──────────────────────────────────────────────────────
  const hero = (() => {
    switch (phase) {
      case "lifetime":
        return { tone: "gold" as Tone, chip: t("premiumHub.chip.lifetime"), title: t("premiumHub.hero.lifetimeTitle"), sub: t("premiumHub.hero.lifetimeSub") };
      case "active": {
        if (billingIssue)
          return { tone: "warn" as Tone, chip: t("premiumHub.chip.billingIssue"), title: t("premiumHub.hero.activeTitle"), sub: t("premiumHub.hero.billingSub") };
        if (cancelled)
          return { tone: "warn" as Tone, chip: t("premiumHub.chip.ending"), title: t("premiumHub.hero.activeTitle"), sub: t("premiumHub.hero.endsSub", { date: expiryDate }) };
        if (entitlement?.isTrial)
          return { tone: "gold" as Tone, chip: t("premiumHub.chip.trial"), title: t("premiumHub.hero.activeTitle"), sub: t("premiumHub.hero.trialSub", { date: expiryDate }) };
        return {
          tone: "gold" as Tone,
          chip: t("premiumHub.chip.active"),
          title: t("premiumHub.hero.activeTitle"),
          sub: ownSubscription ? t("premiumHub.hero.renewsSub", { date: expiryDate }) : t("premiumHub.hero.untilSub", { date: expiryDate }),
        };
      }
      case "grace":
        return { tone: "warn" as Tone, chip: t("premiumHub.chip.grace"), title: t("premiumHub.hero.graceTitle"), sub: t("premiumHub.hero.graceSub", { days: graceDaysLeft ?? PREMIUM_GRACE_DAYS }) };
      case "expired":
        return { tone: "neutral" as Tone, chip: t("premiumHub.chip.expired"), title: t("premiumHub.hero.expiredTitle"), sub: t("premiumHub.hero.expiredSub") };
      default:
        return { tone: "neutral" as Tone, chip: t("premiumHub.chip.free"), title: t("premiumHub.hero.freeTitle"), sub: t("premiumHub.hero.freeSub") };
    }
  })();

  const heroGradient: readonly [string, string, string] =
    hero.tone === "gold"
      ? [`${gold}40`, `${theme.accent}26`, `${theme.accent}00`]
      : hero.tone === "warn"
        ? ["#F59E0B44", "#EF444426", "#EF444400"]
        : [`${theme.accent}30`, `${theme.accent}14`, `${theme.accent}00`];
  const heroAccent = hero.tone === "warn" ? "#F59E0B" : hero.tone === "gold" ? gold : theme.accent;

  // ── İşlemler ───────────────────────────────────────────────────────────────
  const guardDemo = () => {
    if (!isDemoMode) return false;
    setDemoPromptVisible(true);
    return true;
  };

  const openPlans = () => {
    if (guardDemo()) return;
    router.push("/paywall");
  };

  const openManage = async () => {
    if (guardDemo()) return;
    const url = entitlement?.managementUrl || fallbackManageUrl();
    try {
      await Linking.openURL(url);
    } catch {
      appAlert(t("common.error"), t("premiumHub.manage.openFailed", { store: storeName }));
    }
  };

  const handleRestore = async () => {
    if (guardDemo() || busy) return;
    setBusy(true);
    try {
      suppressPremiumCelebration();
      const info = await RevenueCatService.restorePurchases();
      const entitled =
        !!info && (typeof info.entitlements.active["Premium"] !== "undefined" || typeof info.entitlements.active["couples_app_pro"] !== "undefined");
      if (entitled) {
        const serverPremium = await waitForServerPremium(refreshProfile);
        await details.reload();
        if (serverPremium) toast.success(t("paywall.restored"));
        else toast.info(t("paywall.activationPending"), { duration: 7000 });
      } else {
        toast.info(t("paywall.noActiveSubscription"));
      }
    } catch {
      appAlert(t("common.error"), t("paywall.restoreFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleUseCode = () => {
    if (guardDemo()) return;
    if (Platform.OS === "ios") {
      RevenueCatService.presentCodeRedemptionSheet();
      return;
    }
    setCodeModalVisible(true);
  };

  // ── Uyarı kartı ───────────────────────────────────────────────────────────
  const alert: { title: string; body: string; tone: "warn" | "info" } | null = (() => {
    if (phase === "grace") {
      return {
        tone: "warn",
        title: hasStar
          ? t("premiumHub.alert.graceStarTitle", { days: graceDaysLeft ?? PREMIUM_GRACE_DAYS })
          : t("premiumHub.alert.graceTitle", { days: graceDaysLeft ?? PREMIUM_GRACE_DAYS }),
        body: t("premiumHub.alert.graceBody", { date: graceEndDate }),
      };
    }
    if (phase === "expired") {
      // Kasada: anı gezegenleri ve tam boy fotoğraflar kasa bitişine kadar bekler. Sunucu durumu 'free' ise
      // kasa süresi de dolmuş, fotoğraflar tasfiye edilmiştir.
      const vaultEnd =
        profile?.subscriptionStatus === "free"
          ? null
          : profile?.vaultUntil
            ? dayjs(profile.vaultUntil)
            : graceEndsAt
              ? dayjs(graceEndsAt).add(PREMIUM_VAULT_DAYS, "day")
              : null;
      return {
        tone: "info",
        title: t("premiumHub.alert.expiredTitle"),
        body: vaultEnd
          ? t("premiumHub.alert.vaultBody", { date: vaultEnd.format("D MMMM YYYY") })
          : t("premiumHub.alert.expiredBody"),
      };
    }
    if (billingIssue) return { tone: "warn", title: t("premiumHub.alert.billingTitle"), body: t("premiumHub.alert.billingBody", { store: storeName }) };
    if (cancelled) {
      return { tone: "warn", title: t("premiumHub.alert.cancelledTitle"), body: t("premiumHub.alert.cancelledBody", { date: expiryDate, grace: PREMIUM_GRACE_DAYS }) };
    }
    return null;
  })();

  // ── Ayrıntı satırları ─────────────────────────────────────────────────────
  const sourceLabel = ownSubscription
    ? entitlement.store === "APP_STORE"
      ? "App Store"
      : entitlement.store === "PLAY_STORE"
        ? "Google Play"
        : t("premiumHub.details.sourcePromo")
    : phase === "lifetime"
      ? t("premiumHub.details.sourcePromo")
      : t("premiumHub.details.sourcePartner");

  const detailRows: { label: string; value: string }[] = [];
  if (phase !== "free") {
    detailRows.push({ label: t("premiumHub.details.status"), value: hero.chip });
    if (phase === "lifetime") detailRows.push({ label: t("premiumHub.details.period"), value: t("premiumHub.details.noEnd") });
    else if (expiryDate) {
      const label =
        phase === "active" && !cancelled && ownSubscription ? t("premiumHub.details.renewsOn") : t("premiumHub.details.endsOn");
      detailRows.push({ label, value: expiryDate });
    }
    if (phase === "active" && daysUntilEnd !== null) detailRows.push({ label: t("premiumHub.details.daysLeft"), value: String(daysUntilEnd) });
    detailRows.push({ label: t("premiumHub.details.source"), value: sourceLabel });
    detailRows.push({ label: t("premiumHub.details.coverage"), value: t("premiumHub.details.coverageValue") });
  }

  const benefits: { icon: LucideIcon; title: string; body: string; highlight?: boolean }[] = [
    { icon: Star, title: t("premiumHub.benefits.star.title"), body: t("premiumHub.benefits.star.body", { days: PREMIUM_GRACE_DAYS }), highlight: true },
    { icon: Users, title: t("premiumHub.benefits.shared.title"), body: t("premiumHub.benefits.shared.body") },
    { icon: Images, title: t("premiumHub.benefits.photos.title"), body: t("premiumHub.benefits.photos.body") },
    { icon: Mail, title: t("premiumHub.benefits.letters.title"), body: t("premiumHub.benefits.letters.body") },
    { icon: CalendarHeart, title: t("premiumHub.benefits.calendar.title"), body: t("premiumHub.benefits.calendar.body") },
    { icon: HeartPulse, title: t("premiumHub.benefits.cycle.title"), body: t("premiumHub.benefits.cycle.body") },
  ];

  const primaryLabel =
    phase === "grace" || phase === "expired" ? t("premiumHub.cta.renew") : phase === "free" ? t("premiumHub.cta.upgrade") : null;
  const cardBg = isLight ? theme.unitBg : "rgba(255,255,255,0.06)";
  const hairline = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.09)";

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title={t("premiumHub.title")} subtitle={t("premiumHub.subtitle")} />

        {/* ── Üst kart ── */}
        <Reveal scope="premium" index={0}>
          <View style={[styles.hero, { backgroundColor: theme.cardBg, borderColor: `${heroAccent}55`, ...theme.cardShadow }]}>
            <LinearGradient pointerEvents="none" colors={heroGradient} style={StyleSheet.absoluteFill} />
            <Animated.View style={[styles.crownWrap, { backgroundColor: `${heroAccent}22`, borderColor: `${heroAccent}66` }, crownStyle]}>
              <Crown size={40} color={heroAccent} fill={`${heroAccent}33`} />
            </Animated.View>
            <View style={[styles.chip, { backgroundColor: `${heroAccent}22`, borderColor: `${heroAccent}55` }]}>
              <View style={[styles.chipDot, { backgroundColor: heroAccent }]} />
              <Text style={[styles.chipText, { color: heroAccent }]}>{hero.chip}</Text>
            </View>
            <Text style={[styles.heroTitle, { color: theme.text }]}>{hero.title}</Text>
            <Text style={[styles.heroSub, { color: theme.textSecondary }]}>{hero.sub}</Text>

            {primaryLabel ? (
              <TouchableOpacity activeOpacity={0.88} onPress={openPlans} accessibilityRole="button" style={styles.ctaOuter}>
                <LinearGradient
                  colors={hero.tone === "warn" ? ["#F59E0B", "#EA580C"] : [theme.accent, theme.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cta}
                >
                  <Sparkles size={18} color="#fff" />
                  <Text style={styles.ctaText}>{primaryLabel}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : null}
          </View>
        </Reveal>

        {/* ── Uyarı ── */}
        {alert ? (
          <Reveal scope="premium" index={1}>
            <View
              style={[
                styles.alertCard,
                alert.tone === "warn"
                  ? { backgroundColor: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.45)" }
                  : { backgroundColor: cardBg, borderColor: hairline },
              ]}
            >
              {alert.tone === "warn" ? <AlertTriangle size={22} color="#F59E0B" /> : <Info size={22} color={theme.textSecondary} />}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.alertTitle, { color: theme.text }]}>{alert.title}</Text>
                <Text style={[styles.alertBody, { color: theme.textSecondary }]}>{alert.body}</Text>
              </View>
            </View>
          </Reveal>
        ) : null}

        {/* ── Abonelik ayrıntıları ── */}
        {detailRows.length > 0 ? (
          <Reveal scope="premium" index={2}>
            <Section title={t("premiumHub.details.title")} color={theme.textMuted}>
              <View style={[styles.card, { backgroundColor: cardBg, borderColor: hairline }]}>
                {detailRows.map((row, i) => (
                  <View key={row.label} style={[styles.detailRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: hairline }]}>
                    <Text style={[styles.detailLabel, { color: theme.textMuted }]}>{row.label}</Text>
                    <Text style={[styles.detailValue, { color: theme.text }]} numberOfLines={2}>
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>
            </Section>
          </Reveal>
        ) : null}

        {/* ── Yönetim ── */}
        {phase === "active" || phase === "grace" ? (
          <Reveal scope="premium" index={3}>
            <Section title={t("premiumHub.manage.title")} color={theme.textMuted}>
              <View style={[styles.card, { backgroundColor: cardBg, borderColor: hairline }]}>
                {ownSubscription ? (
                  <ActionRow
                    icon={CreditCard}
                    title={t("premiumHub.manage.button")}
                    subtitle={t("premiumHub.manage.buttonSub", { store: storeName })}
                    accent={theme.accent}
                    textColor={theme.text}
                    mutedColor={theme.textMuted}
                    onPress={openManage}
                  />
                ) : sharedFromPartner ? (
                  <View style={styles.noteRow}>
                    <Users size={18} color={theme.textMuted} />
                    <Text style={[styles.noteText, { color: theme.textSecondary }]}>{t("premiumHub.manage.partnerNote")}</Text>
                  </View>
                ) : (
                  <ActionRow
                    icon={CreditCard}
                    title={t("premiumHub.manage.button")}
                    subtitle={t("premiumHub.manage.buttonSub", { store: storeName })}
                    accent={theme.accent}
                    textColor={theme.text}
                    mutedColor={theme.textMuted}
                    onPress={openManage}
                  />
                )}
                <Text style={[styles.hint, { color: theme.textMuted, borderTopColor: hairline }]}>{t("premiumHub.manage.cancelHint", { store: storeName })}</Text>
              </View>
            </Section>
          </Reveal>
        ) : null}

        {/* ── Ayrıcalıklar ── */}
        <Reveal scope="premium" index={4}>
          <Section title={t("premiumHub.benefits.title")} color={theme.textMuted}>
            <View style={{ gap: 10 }}>
              {benefits.map(({ icon: Icon, title, body, highlight }) => (
                <View
                  key={title}
                  style={[
                    styles.benefit,
                    { backgroundColor: cardBg, borderColor: highlight ? `${gold}66` : hairline },
                  ]}
                >
                  <View style={[styles.benefitIcon, { backgroundColor: highlight ? `${gold}22` : theme.pillAccentBg }]}>
                    <Icon size={20} color={highlight ? gold : theme.accent} fill={highlight ? `${gold}44` : "none"} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.benefitTitle, { color: theme.text }]}>{title}</Text>
                    <Text style={[styles.benefitBody, { color: theme.textSecondary }]}>{body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Section>
        </Reveal>

        {/* ── Diğer işlemler ── */}
        <Reveal scope="premium" index={5}>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: hairline }]}>
            <ActionRow
              icon={RotateCcw}
              title={t("paywall.restore")}
              accent={theme.accent}
              textColor={theme.text}
              mutedColor={theme.textMuted}
              onPress={handleRestore}
              loading={busy}
            />
            <View style={[styles.divider, { backgroundColor: hairline }]} />
            <ActionRow
              icon={Gift}
              title={t("premiumHub.promo")}
              accent={theme.accent}
              textColor={theme.text}
              mutedColor={theme.textMuted}
              onPress={handleUseCode}
            />
          </View>
        </Reveal>

        {/* ── Yasal ── */}
        <Reveal scope="premium" index={6}>
          <View style={styles.legalRow}>
            <TouchableOpacity onPress={() => setLegalDoc("subscription")}>
              <Text style={[styles.legalLink, { color: theme.accent }]}>{t("paywall.links.subscription")}</Text>
            </TouchableOpacity>
            <Text style={{ color: theme.textMuted }}>•</Text>
            <TouchableOpacity onPress={() => setLegalDoc("terms")}>
              <Text style={[styles.legalLink, { color: theme.accent }]}>{t("paywall.links.terms")}</Text>
            </TouchableOpacity>
            <Text style={{ color: theme.textMuted }}>•</Text>
            <TouchableOpacity onPress={() => setLegalDoc("privacy")}>
              <Text style={[styles.legalLink, { color: theme.accent }]}>{t("paywall.links.privacy")}</Text>
            </TouchableOpacity>
          </View>
        </Reveal>
      </ScrollView>

      <LazyDemoActionModal
        visible={demoPromptVisible}
        onClose={() => setDemoPromptVisible(false)}
        title={t("paywall.accountRequiredTitle")}
        description={t("paywall.accountRequiredDescription")}
      />
      <PromoCodeModal
        visible={codeModalVisible}
        onClose={() => setCodeModalVisible(false)}
        refreshProfile={refreshProfile}
        onPremiumSuccess={() => {
          setCodeModalVisible(false);
          toast.success(t("paywall.activated"), { title: t("common.congratulations"), emoji: "👑", duration: 3400 });
        }}
      />
      <LegalModal
        visible={legalDoc !== null}
        onClose={() => setLegalDoc(null)}
        initialDoc={legalDoc ?? "subscription"}
        accentColor={theme.accent}
      />
    </ScreenBackground>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={[styles.sectionTitle, { color }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

interface ActionRowProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  accent: string;
  textColor: string;
  mutedColor: string;
  onPress: () => void;
  loading?: boolean;
}

function ActionRow({ icon: Icon, title, subtitle, accent, textColor, mutedColor, onPress, loading }: ActionRowProps) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} disabled={loading} accessibilityRole="button" style={styles.actionRow}>
      <View style={[styles.actionIcon, { backgroundColor: `${accent}1F` }]}>
        {loading ? <ActivityIndicator size="small" color={accent} /> : <Icon size={18} color={accent} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionTitle, { color: textColor }]}>{title}</Text>
        {subtitle ? <Text style={[styles.actionSub, { color: mutedColor }]}>{subtitle}</Text> : null}
      </View>
      <ChevronRight size={18} color={mutedColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 30,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 24,
    gap: 10,
  },
  crownWrap: {
    width: 92,
    height: 92,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  heroTitle: { fontSize: 25, fontFamily: "Inter_700Bold", letterSpacing: -0.6, textAlign: "center" },
  heroSub: { fontSize: 14.5, lineHeight: 21, textAlign: "center" },
  ctaOuter: { alignSelf: "stretch", marginTop: 10 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 26,
  },
  ctaText: { color: "#fff", fontSize: 16.5, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  alertCard: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    alignItems: "flex-start",
  },
  alertTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  alertBody: { fontSize: 13.5, lineHeight: 20 },
  sectionTitle: { fontSize: 11.5, fontFamily: "Inter_700Bold", letterSpacing: 1.1, paddingHorizontal: 4 },
  card: { borderRadius: 22, borderWidth: 1, overflow: "hidden" },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailLabel: { fontSize: 13.5, fontFamily: "Inter_500Medium" },
  detailValue: { flexShrink: 1, fontSize: 14, fontFamily: "Inter_700Bold", textAlign: "right" },
  noteRow: { flexDirection: "row", gap: 12, padding: 16, alignItems: "flex-start" },
  noteText: { flex: 1, fontSize: 13.5, lineHeight: 20 },
  hint: {
    fontSize: 12.5,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  benefit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
  },
  benefitIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  benefitTitle: { fontSize: 14.5, fontFamily: "Inter_700Bold" },
  benefitBody: { fontSize: 12.5, lineHeight: 18 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  actionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionTitle: { fontSize: 14.5, fontFamily: "Inter_600SemiBold" },
  actionSub: { fontSize: 12, marginTop: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 64 },
  legalRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 8, paddingTop: 4 },
  legalLink: { fontSize: 12, fontFamily: "Inter_600SemiBold", textDecorationLine: "underline" },
});
