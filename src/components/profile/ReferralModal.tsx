import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Copy, Gift, Link, Share2, X } from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useReferralCodeEntry } from "@/hooks/useReferralCodeEntry";
import { hapticSuccess } from "@/lib/soundEffects";
import {
  DEFAULT_REFERRAL_REWARD_DAYS,
  buildReferralInviteLink,
  buildReferralShareMessage,
  fetchReferralOverview,
  formatReferralCode,
  type ReferralInvitee,
  type ReferralOverview,
  type ReferralStatus,
} from "@/lib/referral";
import { ReferralCodeEntry } from "./ReferralCodeEntry";
import { fieldSurface, hairlineColor } from "./profileTokens";

const ROSE = "#EC4899";
const GOLD = "#F59E0B";
const GREEN = "#10B981";

interface ReferralModalProps {
  visible: boolean;
  onClose: () => void;
}

export const referralOverviewQueryKey = (coupleId: number | null | undefined) => ["referral-overview", coupleId] as const;

type CopyTarget = "code" | "link" | null;

/**
 * "Çift Arkadaşlarımızı Davet Et" penceresi: çiftin davet kodu ve bağlantısı, paylaşım, kota ve davet
 * edilenlerin listesi. Hesabı yeni olan kullanıcı burada kendisi de bir davet kodu girebilir.
 */
export function ReferralModal({ visible, onClose }: ReferralModalProps) {
  const { t } = useTranslation();
  const { theme, isLight } = useTheme();
  const { profile, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState<CopyTarget>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const overview = useQuery({
    queryKey: referralOverviewQueryKey(profile?.coupleId),
    queryFn: fetchReferralOverview,
    enabled: visible && !!profile?.coupleId,
    // Pencere her açılışta güncel listeyi gösterir (arkadaş bu arada eşleşmiş olabilir)
    staleTime: 0,
  });
  const { refetch } = overview;

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  const handleApplied = useCallback(
    (status: ReferralStatus) => {
      if (status === "rewarded") {
        hapticSuccess();
        refreshProfile();
      }
      refetch();
    },
    [refetch, refreshProfile]
  );
  const entry = useReferralCodeEntry(handleApplied);

  const copy = async (target: Exclude<CopyTarget, null>, text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(target);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(null), 2000);
  };

  const data = overview.data;
  const code = data?.code ?? null;

  const handleShare = async () => {
    if (!data || !code) return;
    try {
      await Share.share({
        title: t("referral.modal.shareTitle"),
        message: buildReferralShareMessage(t, { code, hasStar: data.hasStar, rewardDays: data.rewardDays }),
      });
    } catch {
      // Paylaşım penceresi açılamadı: kod ve bağlantı kopyalama düğmeleri yine kullanılabilir
    }
  };

  const sheetBg = isLight ? "#FFFFFF" : "#13131F";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t("common.close")} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: sheetBg,
              borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.1)",
              paddingBottom: insets.bottom + 12,
            },
          ]}
          accessibilityViewIsModal
        >
          <View style={[styles.grabber, { backgroundColor: hairlineColor(theme) }]} />
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: fieldSurface(theme) }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
          >
            <X size={18} color={theme.textMuted} />
          </TouchableOpacity>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <LinearGradient colors={[ROSE, GOLD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.giftCircle}>
              <Gift size={28} color="#FFFFFF" />
            </LinearGradient>
            <Text style={[styles.eyebrow, { color: ROSE }]}>{t("referral.modal.eyebrow")}</Text>
            <Text style={[styles.title, { color: theme.text }]}>{t("referral.modal.title")}</Text>
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              {t("referral.modal.description", { days: data?.rewardDays ?? DEFAULT_REFERRAL_REWARD_DAYS })}
            </Text>

            {overview.isLoading ? (
              <ActivityIndicator color={ROSE} style={{ marginVertical: 32 }} />
            ) : !data ? (
              <View style={styles.centered}>
                <Text style={[styles.muted, { color: theme.textMuted }]}>{t("referral.modal.loadFailed")}</Text>
                <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn} accessibilityRole="button">
                  <Text style={[styles.retryText, { color: ROSE }]}>{t("common.tryAgain")}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* ─── KOD ─── */}
                <View style={[styles.codeCard, { backgroundColor: isLight ? `${ROSE}0D` : `${ROSE}14`, borderColor: `${ROSE}40` }]}>
                  <Text style={[styles.codeLabel, { color: theme.textMuted }]}>{t("referral.modal.codeLabel")}</Text>
                  {code ? (
                    <>
                      <TouchableOpacity
                        onPress={() => copy("code", formatReferralCode(code))}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`${t("referral.modal.codeLabel")}: ${formatReferralCode(code)}. ${t("referral.modal.copyCode")}`}
                      >
                        <Text style={[styles.code, { color: theme.text }]}>{formatReferralCode(code)}</Text>
                      </TouchableOpacity>

                      <View style={styles.copyRow}>
                        <CopyButton
                          label={t("referral.modal.copyCode")}
                          done={copied === "code"}
                          icon="code"
                          onPress={() => copy("code", formatReferralCode(code))}
                        />
                        <CopyButton
                          label={t("referral.modal.copyLink")}
                          done={copied === "link"}
                          icon="link"
                          onPress={() => copy("link", buildReferralInviteLink(code))}
                        />
                      </View>

                      <TouchableOpacity onPress={handleShare} activeOpacity={0.88} style={styles.shareBtn} accessibilityRole="button">
                        <LinearGradient colors={[ROSE, GOLD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.shareGradient}>
                          <Share2 size={17} color="#FFFFFF" />
                          <Text style={styles.shareText}>{t("referral.modal.share")}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={[styles.muted, { color: theme.textSecondary }]}>{t("referral.modal.codeUnavailable")}</Text>
                  )}
                </View>

                {code && <QuotaMeter overview={data} />}

                {/* ─── NASIL İŞLER ─── */}
                <View style={[styles.section, { backgroundColor: fieldSurface(theme) }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>{t("referral.modal.howTitle")}</Text>
                  {[
                    t("referral.modal.step1"),
                    t("referral.modal.step2"),
                    t("referral.modal.step3", { days: data.rewardDays }),
                  ].map((step, index) => (
                    <View key={step} style={styles.stepRow}>
                      <View style={[styles.stepDot, { backgroundColor: `${ROSE}22` }]}>
                        <Text style={[styles.stepNumber, { color: ROSE }]}>{index + 1}</Text>
                      </View>
                      <Text style={[styles.stepText, { color: theme.textSecondary }]}>{step}</Text>
                    </View>
                  ))}
                  <Text style={[styles.note, { color: theme.textMuted }]}>
                    {t("referral.modal.subscriberNote", { tokens: data.rewardTokens })}
                  </Text>
                </View>

                {/* ─── BİZİ DAVET EDEN / KOD GİRİŞİ ─── */}
                {data.myReferral ? (
                  <MyReferralBanner overview={data} />
                ) : data.canEnterCode ? (
                  <View style={[styles.section, { backgroundColor: fieldSurface(theme) }]}>
                    <ReferralCodeEntry
                      value={entry.value}
                      onChangeValue={entry.change}
                      onSubmit={entry.submit}
                      submitting={entry.submitting}
                      error={entry.error}
                      title={t("referral.enter.title")}
                      hint={t("referral.enter.hintPaired", { days: data.rewardDays })}
                      palette={{
                        text: theme.text,
                        textMuted: theme.textMuted,
                        field: isLight ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.25)",
                        accent: ROSE,
                        error: "#E11D48",
                      }}
                    />
                  </View>
                ) : null}

                {/* ─── DAVET EDİLENLER ─── */}
                {code && (
                  <View style={styles.listBlock}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>{t("referral.modal.listTitle")}</Text>
                    {data.invitees.length === 0 ? (
                      <Text style={[styles.muted, { color: theme.textMuted }]}>{t("referral.modal.empty")}</Text>
                    ) : (
                      data.invitees.map((invitee, index) => (
                        <InviteeRow
                          key={invitee.id}
                          invitee={invitee}
                          overview={data}
                          showDivider={index < data.invitees.length - 1}
                        />
                      ))
                    )}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CopyButton({ label, done, icon, onPress }: { label: string; done: boolean; icon: "code" | "link"; onPress: () => void }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const Icon = icon === "code" ? Copy : Link;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      style={[styles.copyBtn, { backgroundColor: fieldSurface(theme) }]}
    >
      {done ? <Check size={15} color={GREEN} /> : <Icon size={15} color={theme.textSecondary} />}
      <Text style={[styles.copyText, { color: done ? GREEN : theme.text }]} numberOfLines={1}>
        {done ? t("common.copied") : label}
      </Text>
    </TouchableOpacity>
  );
}

/** Davet edenin ödül kotası: 5 yıldızlık bir sıra */
function QuotaMeter({ overview }: { overview: ReferralOverview }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const used = Math.min(overview.rewardedCount, overview.quota);
  const full = used >= overview.quota;

  return (
    <View style={styles.quotaBlock}>
      <View style={styles.quotaDots}>
        {Array.from({ length: overview.quota }, (_, index) => (
          <View
            key={index}
            style={[
              styles.quotaDot,
              index < used ? { backgroundColor: GOLD } : { backgroundColor: "transparent", borderColor: hairlineColor(theme), borderWidth: 1.5 },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.quotaText, { color: theme.textSecondary }]}>
        {full ? t("referral.modal.quotaFull") : t("referral.modal.quota", { used, quota: overview.quota })}
      </Text>
    </View>
  );
}

function MyReferralBanner({ overview }: { overview: ReferralOverview }) {
  const { t } = useTranslation();
  const mine = overview.myReferral;
  if (!mine) return null;

  const tone = mine.status === "rejected" ? "#94A3B8" : mine.status === "rewarded" ? GREEN : GOLD;
  const text =
    mine.status === "rewarded"
      ? mine.inviterLabel
        ? t("referral.enter.rewardedFrom", { name: mine.inviterLabel })
        : t("referral.enter.rewarded")
      : mine.status === "pending"
        ? t("referral.enter.appliedPending", { days: overview.rewardDays })
        : t("referral.enter.rejected");

  return (
    <View style={[styles.banner, { backgroundColor: `${tone}14`, borderColor: `${tone}40` }]}>
      <Gift size={16} color={tone} />
      <Text style={[styles.bannerText, { color: tone }]}>{text}</Text>
    </View>
  );
}

function InviteeRow({ invitee, overview, showDivider }: { invitee: ReferralInvitee; overview: ReferralOverview; showDivider: boolean }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const label = invitee.label ?? t("referral.modal.inviteeFallback");
  const tone = invitee.status === "rewarded" ? GREEN : invitee.status === "pending" ? GOLD : "#94A3B8";

  const statusText =
    invitee.status === "rewarded"
      ? t("referral.status.rewarded")
      : invitee.status === "pending"
        ? t("referral.status.pending")
        : t("referral.status.rejected");

  const rewardText =
    invitee.status !== "rewarded"
      ? null
      : invitee.reward === "premium_days" || invitee.reward === "premium_extended"
        ? t("referral.reward.days", { days: overview.rewardDays })
        : invitee.reward === "tokens"
          ? t("referral.reward.tokens", { tokens: overview.rewardTokens })
          : invitee.reward === "quota_reached"
            ? t("referral.reward.quotaReached")
            : null;

  return (
    <View style={[styles.inviteeRow, showDivider && { borderBottomColor: hairlineColor(theme), borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={[styles.avatar, { backgroundColor: `${tone}22` }]}>
        <Text style={[styles.avatarText, { color: tone }]}>{label.charAt(0).toLocaleUpperCase()}</Text>
      </View>
      <View style={styles.inviteeTexts}>
        <Text style={[styles.inviteeName, { color: theme.text }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.inviteeStatus, { color: tone }]} numberOfLines={1}>
          {statusText}
        </Text>
      </View>
      {rewardText && (
        <View style={[styles.rewardPill, { backgroundColor: `${GOLD}1F` }]}>
          <Text style={[styles.rewardText, { color: GOLD }]}>{rewardText}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    maxHeight: "90%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 10,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 6 },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 16 },
  giftCircle: {
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ROSE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: -10,
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center", letterSpacing: -0.5 },
  description: { fontSize: 13.5, lineHeight: 20, textAlign: "center", marginTop: -8 },
  centered: { alignItems: "center", paddingVertical: 24, gap: 8 },
  muted: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  retryBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  retryText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  codeCard: { borderRadius: 24, borderWidth: 1, padding: 18, gap: 12 },
  codeLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 1, textTransform: "uppercase", textAlign: "center" },
  code: { fontSize: 32, fontFamily: "Inter_700Bold", letterSpacing: 5, textAlign: "center" },
  copyRow: { flexDirection: "row", gap: 10 },
  copyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    paddingVertical: 12,
  },
  copyText: { fontSize: 13, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  shareBtn: {
    height: 50,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: ROSE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  shareGradient: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  shareText: { color: "#FFFFFF", fontSize: 15.5, fontFamily: "Inter_700Bold" },
  quotaBlock: { alignItems: "center", gap: 8 },
  quotaDots: { flexDirection: "row", gap: 8 },
  quotaDot: { width: 12, height: 12, borderRadius: 6 },
  quotaText: { fontSize: 12.5, textAlign: "center", lineHeight: 18 },
  section: { borderRadius: 20, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stepDot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepNumber: { fontSize: 12, fontFamily: "Inter_700Bold" },
  stepText: { flex: 1, fontSize: 13, lineHeight: 19 },
  note: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  banner: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, borderWidth: 1, padding: 14 },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 19, fontFamily: "Inter_600SemiBold" },
  listBlock: { gap: 4 },
  inviteeRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  inviteeTexts: { flex: 1, gap: 2 },
  inviteeName: { fontSize: 14.5, fontFamily: "Inter_600SemiBold" },
  inviteeStatus: { fontSize: 12.5, fontFamily: "Inter_500Medium" },
  rewardPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  rewardText: { fontSize: 12, fontFamily: "Inter_700Bold" },
});
