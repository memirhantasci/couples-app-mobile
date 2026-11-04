import { useState, useEffect, useEffectEvent, useRef, useCallback } from "react";
import { logger } from "@/utils/logger";
import { joinCoupleByCode } from "@/lib/joinCouple";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth, type CoupleProfile } from "@/context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link, Share2, LogOut, Sparkles, Check, Copy, Gift } from "lucide-react-native";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { navigateAfterAuth, releaseAuthFlow, setAuthFlowActive } from "@/lib/navigate";
import { isDefinitivePairingError, normalizePairingCode, translatePairingError } from "@/lib/pairingCode";
import { useNotificationPriming } from "@/hooks/useNotificationPriming";
import { useCoupleAvatars } from "@/hooks/useCoupleAvatars";
import { PermissionPrimingModal } from "@/components/common/PermissionPrimingModal";
import { PairingCelebrationModal } from "@/components/pairing/PairingCelebrationModal";
import { ReferralCodeEntry } from "@/components/profile/ReferralCodeEntry";
import { useReferralCodeEntry } from "@/hooks/useReferralCodeEntry";
import {
  DEFAULT_REFERRAL_REWARD_DAYS,
  applyPendingReferralCode,
  fetchReferralOverview,
  looksLikeReferralCode,
  translateReferralError,
} from "@/lib/referral";
import { toast } from "@/lib/toast";
import { useTranslation } from "react-i18next";

// ─── Types ───────────────────────────────────────────────────────────────────

type PairingStatus = {
  coupleId: number | null;
  pairingCode: string | null;
  memberCount: number;
  isPaired: boolean;
  hasDates: boolean;
};

// ─── RPC Helpers ─────────────────────────────────────────────────────────────

// Bekleme çifti ve kodu sunucuda tek, kilitli bir işlemde getirilir / oluşturulur. Eskiden istemci
// önce çift ekleyip sonra katılıyordu; yarışta yetim çiftler ve ekranda kalan geçersiz kodlar oluşuyordu.
async function fetchPairingStatus(): Promise<PairingStatus> {
  const { data, error } = await supabase.rpc("get_or_create_my_couple");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    coupleId: row?.result_couple_id ?? null,
    pairingCode: row?.result_pairing_code ?? null,
    memberCount: row?.result_member_count ?? 0,
    isPaired: row?.result_is_paired ?? false,
    hasDates: row?.result_has_dates ?? false,
  };
}

// Kutlamada partnerin adı görünsün; okunamazsa kutlama yine "Sevgilin" ile oynar
async function fetchPartnerName(coupleId: number, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, display_name, username")
    .eq("couple_id", coupleId);
  if (error || !data) return null;
  const partner = data.find((row) => row.id !== userId);
  return partner?.display_name?.trim() || partner?.username?.trim() || null;
}

// ─── Pairing Screen ──────────────────────────────────────────────────────────

export default function PairingScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, profile, refreshProfile, signOut, enterDemoMode, isDemoMode } = useAuth();
  const userId = session?.user?.id;
  const params = useLocalSearchParams<{ code?: string }>();

  const [inputCode, setInputCode] = useState(normalizePairingCode(params.code));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  // Bekleyen davet kodu denenmeden kullanıcıya boşuna kendi bekleme çifti açılmasın
  const [autoPairChecked, setAutoPairChecked] = useState(false);
  const finishingRef = useRef(false);
  const priming = useNotificationPriming(userId);

  const { data: status, isLoading } = useQuery<PairingStatus>({
    queryKey: ["pairing-status", userId],
    queryFn: fetchPairingStatus,
    enabled: !!userId && autoPairChecked,
    refetchInterval: 3500,
    refetchIntervalInBackground: false,
  });

  // ─── Arkadaş çift daveti ───
  // Kod burada tek başına ödül vermez: sevgiliyle eşleşildiği an sunucu iki çifte de ödül verir.
  const referralQuery = useQuery({
    queryKey: ["referral-overview", "pairing", userId],
    queryFn: fetchReferralOverview,
    enabled: !!userId && autoPairChecked,
    staleTime: 0,
  });
  const { refetch: refetchReferral } = referralQuery;
  const referral = useReferralCodeEntry(
    useCallback(() => {
      refetchReferral();
    }, [refetchReferral])
  );
  const myReferral = referralQuery.data?.myReferral ?? null;
  const canEnterReferral = !myReferral && !!referralQuery.data?.canEnterCode;

  // ─── Eşleşme kutlaması ───
  // Profil bu ekranda "eşleşmemiş"ten "eşleşti"ye döndüğü an kutlama başlar. Eşleşme hangi yoldan
  // gelirse gelsin (kod girişi, yoklama ya da partner katılınca realtime profil yenilemesi) aynı an
  // yakalanır. Yönlendirme kutlama bitince yapılır.
  const [sawUnpaired, setSawUnpaired] = useState(false);
  const [celebration, setCelebration] = useState<CoupleProfile | null>(null);
  const [celebrationDone, setCelebrationDone] = useState(false);
  const [celebrationVisible, setCelebrationVisible] = useState(true);
  const lockReleasedRef = useRef(false);
  const { myAvatarUrl, partnerAvatarUrl } = useCoupleAvatars();

  // Render sırasında kendi state'ini güncellemek React'in önerdiği "prop değişince ayarla" kalıbıdır.
  // Demo profili de "eşleşmiş" sayılır: "Uygulamayı Keşfet" kutlama oynatmaz.
  if (profile && !profile.isPaired && !sawUnpaired) setSawUnpaired(true);
  if (profile?.isPaired && sawUnpaired && !celebration && !isDemoMode) setCelebration(profile);

  // Kutlama sürerken koruyucu (useProtectedRoute) yönlendirmesi bekletilir: aksi halde profil
  // "eşleşti" olduğu an kullanıcı tarih ekranına atılır ve kutlama yarıda kesilirdi. Bu etki
  // profilin değiştiği aynı commit'te çalışır, koruyucunun zamanlayıcısından önce kilitlenir.
  const isCelebrating = celebration !== null;
  useEffect(() => {
    if (!isCelebrating) return;
    setAuthFlowActive(true);
    return () => {
      // Ekran kutlama bitmeden kapanırsa kilit takılı kalmasın
      if (!lockReleasedRef.current) setAuthFlowActive(false);
    };
  }, [isCelebrating]);

  const { data: celebrationPartnerName } = useQuery({
    queryKey: ["pairing-partner-name", celebration?.coupleId],
    enabled: !!celebration?.coupleId && !!userId,
    queryFn: () => fetchPartnerName(celebration!.coupleId!, userId!),
    staleTime: Infinity,
  });

  const hadPendingReferral = myReferral?.status === "pending";
  const handleCelebrationComplete = useCallback(() => {
    if (!celebration || lockReleasedRef.current) return;
    lockReleasedRef.current = true;
    // Kutlama sırasında tarihler gibi alanlar güncellenmiş olabilir: en güncel profile göre yönlendir
    navigateAfterAuth(profile?.isPaired ? profile : celebration);
    releaseAuthFlow();
    setCelebrationDone(true);
    // Davet koduyla gelindiyse eşleşme anında verilen hediye haber verilir (sunucu reddettiyse sessiz)
    if (hadPendingReferral) {
      fetchReferralOverview()
        .then((overview) => {
          if (overview.myReferral?.status === "rewarded") {
            toast.success(t("referral.toasts.rewarded"), { emoji: "🎁", delay: 900 });
          }
        })
        .catch(() => {});
    }
  }, [celebration, profile, hadPendingReferral, t]);

  // Yönlendirme bu ekranı (ve kutlama katmanını) kapatır; kapatmazsa karanlık katman takılı kalmasın
  useEffect(() => {
    if (!celebrationDone) return;
    const timer = setTimeout(() => setCelebrationVisible(false), 1200);
    return () => clearTimeout(timer);
  }, [celebrationDone]);

  const celebrationModal = (
    <PairingCelebrationModal
      visible={isCelebrating && celebrationVisible}
      myName={celebration?.displayName}
      partnerName={celebrationPartnerName}
      myAvatarUrl={myAvatarUrl}
      partnerAvatarUrl={partnerAvatarUrl}
      onComplete={handleCelebrationComplete}
    />
  );

  // Eşleşme tamamlandı: profil yenilenir ve "eşleşti"ye dönünce kutlama başlar (bkz. yukarı).
  // Profil yenilenmeden yönlendirilirse koruyucu eski "eşleşmemiş" profile bakıp kullanıcıyı geri atıyordu.
  const finishPairing = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    await AsyncStorage.removeItem("@pending_invite_code");
    const fresh = await refreshProfile();
    if (!fresh?.isPaired) {
      // Profil henüz okunamadı; bir sonraki yoklamada tekrar denenir
      finishingRef.current = false;
    }
  }, [refreshProfile]);

  useEffect(() => {
    if (status?.isPaired) finishPairing();
  }, [status?.isPaired, finishPairing]);

  // Profil bu bekleme çiftini tanısın: partner katıldığı an realtime ile haber gelir (yoklama yedekte)
  useEffect(() => {
    if (status?.coupleId && status.coupleId !== profile?.coupleId) refreshProfile();
  }, [status?.coupleId, profile?.coupleId, refreshProfile]);

  async function joinWithCode(code: string) {
    const { data, error } = await joinCoupleByCode(code);

    if (error) {
      // Zaten eşleşmiş (ör. iki taraf aynı anda birbirinin kodunu girdi): hata değil, devam et
      if (error.message.includes("ALREADY_PAIRED")) {
        await finishPairing();
        return;
      }
      setSubmitError(translatePairingError(error.message));
      // Sunucu kodu kesin olarak reddettiyse aynı kod her açılışta sessizce yeniden denenmesin
      if (isDefinitivePairingError(error.message)) {
        await AsyncStorage.removeItem("@pending_invite_code");
      }
      return;
    }

    if (data?.isPaired) {
      // Partner A'nın telefonuna "Eşleşme başarılı" bildirimini sunucu (couples tetikleyicisi) gönderir
      await finishPairing();
    } else {
      queryClient.invalidateQueries({ queryKey: ["pairing-status", userId] });
    }
  }

  const autoJoin = useEffectEvent((code: string) => joinWithCode(code));

  // Kayıtta girilen kod, davet bağlantısı ya da route parametresiyle gelen kod varsa otomatik eşleş.
  // Başarısız olursa kod giriş kutusunda kalır ve hata görünür.
  useEffect(() => {
    if (!userId) return;
    async function checkAutoPair() {
      // Davet bağlantısıyla gelen arkadaş kodu eşleşmeden önce girilir: eşleşme anında ödül hemen işlesin
      const pendingReferral = await applyPendingReferralCode().catch(() => null);
      if (pendingReferral?.error && !pendingReferral.status) {
        toast.warning(translateReferralError(pendingReferral.error));
      }

      const stored = await AsyncStorage.getItem("@pending_invite_code");
      const pending = normalizePairingCode(params.code || stored);
      if (pending.length >= 4) {
        setInputCode(pending);
        setIsSubmitting(true);
        setSubmitError("");
        try {
          await autoJoin(pending);
        } catch {
          // sessiz fallback: kullanıcı kodu elle tekrar deneyebilir
        } finally {
          setIsSubmitting(false);
        }
      }
      setAutoPairChecked(true);
    }
    checkAutoPair();
  }, [userId, params.code]);

  async function handleShareInvite() {
    const code = status?.pairingCode;
    if (!code) return;
    const inviteLink = `couplesapp://invite?code=${code}`;
    const shareMessage = [
      t("setup.pairing.share.greeting"),
      "",
      t("setup.pairing.share.codeLabel"),
      code,
      "",
      t("setup.pairing.share.howTitle"),
      t("setup.pairing.share.step1"),
      t("setup.pairing.share.step2"),
      t("setup.pairing.share.step3"),
      inviteLink,
      "",
      t("setup.pairing.share.closing"),
    ].join("\n");

    await Share.share({
      title: t("setup.pairing.share.title"),
      message: shareMessage,
      url: inviteLink,
    });
    // Davet gönderildi: partner katılınca haber alabilmek için bildirim iznini nazikçe iste
    await priming.maybePrompt();
  }

  async function handleCopyCode() {
    const code = status?.pairingCode;
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  async function handleCopyLink() {
    const code = status?.pairingCode;
    if (!code) return;
    const inviteLink = `couplesapp://invite?code=${code}`;
    await Clipboard.setStringAsync(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  }

  async function handleSubmit() {
    const code = normalizePairingCode(inputCode);
    if (code.length < 4) {
      setSubmitError(t("setup.pairing.invalidCode"));
      return;
    }
    if (!userId) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError("");
    try {
      await joinWithCode(code);
    } catch {
      setSubmitError(translatePairingError(undefined));
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Kutlama katmanı her iki dalda da aynı konumda çizilir: davet koduyla otomatik eşleşmede kutlama
  // yükleme ekranındayken başlar, ekran ana görünüme geçince baştan başlamaz
  if (!autoPairChecked || isLoading) {
    return (
      <>
        <View style={{ flex: 1, backgroundColor: "#0A0A10", alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#D85870" size="large" />
        </View>
        {celebrationModal}
      </>
    );
  }

  const activePairingCode = status?.pairingCode;

  return (
    <>
    <ScreenBackground colors={["#0A0A10", "#0D0D14", "#0A0A10"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{ marginBottom: 28 }}>
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 38,
                fontFamily: "Inter_700Bold",
                letterSpacing: -1.2,
                marginBottom: 8,
              }}
            >
              {t("setup.pairing.title")}
            </Text>
            <Text
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 14.5,
                lineHeight: 22,
              }}
            >
              {t("setup.pairing.subtitle")}
            </Text>
          </View>

          {/* ─── 1. SENİN EŞLEŞME KODUN KARTI (BELİRGİN VE BÜYÜK) ─── */}
          <View
            style={{
              borderRadius: 32,
              padding: 24,
              backgroundColor: "rgba(216, 88, 112, 0.12)",
              shadowColor: "#D85870",
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.2,
              shadowRadius: 24,
              elevation: 6,
              marginBottom: 24,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Sparkles color="#D85870" size={18} />
                <Text style={{ color: "#D85870", fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 1 }}>
                  {t("setup.pairing.yourCode")}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" }} />
                <Text style={{ color: "#10B981", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>{t("setup.pairing.active")}</Text>
              </View>
            </View>

            {/* BÜYÜK VE NET KOD GÖSTERİM KUTUSU */}
            <TouchableOpacity
              onPress={handleCopyCode}
              activeOpacity={0.8}
              style={{
                backgroundColor: "rgba(0,0,0,0.4)",
                borderRadius: 24,
                paddingVertical: 22,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 34,
                  fontFamily: "Inter_700Bold",
                  letterSpacing: 8,
                }}
              >
                {activePairingCode ?? t("setup.pairing.fetchingCode")}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4 }}>
                {t("setup.pairing.tapToCopy")}
              </Text>
            </TouchableOpacity>

            {/* Yan Yana Aksiyon Butonları: Kodu Kopyala & Bağlantıyı Kopyala */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
              <TouchableOpacity
                onPress={handleCopyCode}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderRadius: 16,
                  paddingVertical: 13,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {copiedCode ? (
                  <>
                    <Check color="#10B981" size={16} />
                    <Text style={{ color: "#10B981", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      {t("common.copied")}
                    </Text>
                  </>
                ) : (
                  <>
                    <Copy color="rgba(255,255,255,0.8)" size={16} />
                    <Text style={{ color: "#FFFFFF", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      {t("setup.pairing.copyCode")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCopyLink}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderRadius: 16,
                  paddingVertical: 13,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {copiedLink ? (
                  <>
                    <Check color="#10B981" size={16} />
                    <Text style={{ color: "#10B981", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      {t("common.copied")}
                    </Text>
                  </>
                ) : (
                  <>
                    <Link color="rgba(255,255,255,0.8)" size={16} />
                    <Text style={{ color: "#FFFFFF", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      {t("setup.pairing.copyLink")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Büyük Ana Paylaş Butonu */}
            <TouchableOpacity
              onPress={handleShareInvite}
              activeOpacity={0.88}
              style={{
                backgroundColor: "#D85870",
                borderRadius: 18,
                paddingVertical: 15,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginBottom: 12,
                shadowColor: "#D85870",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 10,
                elevation: 5,
              }}
            >
              <Share2 color="#FFFFFF" size={18} />
              <Text style={{ color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>
                {t("setup.pairing.invite")}
              </Text>
            </TouchableOpacity>

            {/* Bekleniyor Durumu */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#D85870" }} />
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                {t("setup.pairing.waiting")}
              </Text>
            </View>
          </View>

          {/* ─── 2. PARTNERİNİN KODUNU GİR KARTI ─── */}
          <View
            style={{
              borderRadius: 24,
              padding: 24,
              backgroundColor: "rgba(255,255,255,0.03)",
              marginBottom: 20,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 6 }}>
              {t("setup.pairing.enterTitle")}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 18 }}>
              {t("setup.pairing.enterHint")}
            </Text>

            <TextInput
              value={inputCode}
              onChangeText={(text) => {
                // Arkadaşın davet kodu (SKY-XXXXX) bu kutuya yapıştırıldıysa davet kodu alanına taşınır
                if (canEnterReferral && looksLikeReferralCode(text)) {
                  referral.change(text);
                  setInputCode("");
                  toast.info(t("referral.toasts.movedToReferral"));
                  return;
                }
                setInputCode(normalizePairingCode(text));
                if (submitError) setSubmitError("");
              }}
              placeholder="XXXXXX"
              placeholderTextColor="rgba(255,255,255,0.2)"
              autoCapitalize="characters"
              autoCorrect={false}
              style={{
                borderRadius: 16,
                paddingVertical: 14,
                paddingHorizontal: 20,
                color: "#FFFFFF",
                fontSize: 18,
                letterSpacing: 4,
                textAlign: "center",
                backgroundColor: "rgba(0,0,0,0.3)",
                marginBottom: 16,
              }}
            />

            {!!submitError && (
              <View
                style={{
                  backgroundColor: "rgba(200, 33, 63,0.1)",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 14,
                }}
              >
                <Text style={{ color: "#D85870", fontSize: 13, textAlign: "center" }}>
                  {submitError}
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting || inputCode.length < 4}
              style={{
                backgroundColor: inputCode.length < 4 ? "rgba(79, 125, 190,0.4)" : "#4F7DBE",
                paddingVertical: 16,
                borderRadius: 24,
                alignItems: "center",
                shadowColor: "#4F7DBE",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 }}>
                  {t("setup.pairing.submit")}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ─── 2.1 ARKADAŞ ÇİFT DAVETİ: KOD GİRİŞİ YA DA EKLENMİŞ DAVET ─── */}
          {myReferral ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                borderRadius: 20,
                padding: 16,
                backgroundColor: myReferral.status === "rejected" ? "rgba(255,255,255,0.03)" : "rgba(245, 158, 11, 0.1)",
                marginBottom: 20,
              }}
            >
              <Gift color={myReferral.status === "rejected" ? "rgba(255,255,255,0.5)" : "#F59E0B"} size={18} />
              <Text
                style={{
                  flex: 1,
                  color: myReferral.status === "rejected" ? "rgba(255,255,255,0.6)" : "#FCD34D",
                  fontSize: 13,
                  lineHeight: 19,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {myReferral.status === "pending"
                  ? t("referral.enter.appliedPending", { days: referralQuery.data?.rewardDays ?? DEFAULT_REFERRAL_REWARD_DAYS })
                  : myReferral.status === "rewarded"
                    ? t("referral.enter.rewarded")
                    : t("referral.enter.rejected")}
              </Text>
            </View>
          ) : canEnterReferral ? (
            <View
              style={{
                borderRadius: 24,
                padding: 20,
                backgroundColor: "rgba(245, 158, 11, 0.06)",
                marginBottom: 20,
              }}
            >
              <ReferralCodeEntry
                value={referral.value}
                onChangeValue={referral.change}
                onSubmit={referral.submit}
                submitting={referral.submitting}
                error={referral.error}
                title={t("referral.enter.title")}
                hint={t("referral.enter.hint", { days: referralQuery.data?.rewardDays ?? DEFAULT_REFERRAL_REWARD_DAYS })}
                palette={{
                  text: "#FFFFFF",
                  textMuted: "rgba(255,255,255,0.5)",
                  field: "rgba(0,0,0,0.3)",
                  accent: "#F59E0B",
                  error: "#F87171",
                }}
              />
            </View>
          ) : null}

          {/* ─── 3. BEKLEME ODASI: PARTNER KATILINCA NELER AÇILACAK? ─── */}
          <View
            style={{
              borderRadius: 20,
              padding: 18,
              backgroundColor: "rgba(255,255,255,0.03)",
              marginBottom: 16,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 14.5, fontFamily: "Inter_700Bold", marginBottom: 12 }}>
              {t("setup.pairing.unlocksTitle")}
            </Text>
            {[
              t("setup.pairing.unlock1"),
              t("setup.pairing.unlock2"),
              t("setup.pairing.unlock3"),
            ].map((item, index) => (
              <Text
                key={item}
                style={{
                  color: "rgba(255,255,255,0.65)",
                  fontSize: 13,
                  lineHeight: 20,
                  marginBottom: index === 2 ? 0 : 8,
                }}
              >
                {item}
              </Text>
            ))}
          </View>

          {/* ─── 4. DEMO MODU İLE TEST ET BUTONU ─── */}
          <TouchableOpacity
            onPress={() => {
              enterDemoMode();
              router.replace("/(tabs)/home");
            }}
            activeOpacity={0.85}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              backgroundColor: "rgba(216, 88, 112, 0.16)",
              borderRadius: 26,
              paddingVertical: 14,
              paddingHorizontal: 20,
              marginBottom: 8,
            }}
          >
            <Sparkles color="#D85870" size={18} />
            <Text style={{ color: "#D85870", fontSize: 14, fontFamily: "Inter_700Bold" }}>
              {t("setup.pairing.exploreDemo")}
            </Text>
          </TouchableOpacity>
          <Text
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 12,
              lineHeight: 18,
              textAlign: "center",
              paddingHorizontal: 12,
              marginBottom: 16,
            }}
          >
            {t("setup.pairing.exploreDemoHint")}
          </Text>

          {/* ─── 5. ÇIKIŞ / GERİ DÖN BUTONU ─── */}
          <TouchableOpacity
            onPress={async () => {
              try {
                await signOut();
              } catch (e) {
                logger.error(e);
              }
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 12,
              marginBottom: 30,
            }}
          >
            <LogOut color="rgba(255,255,255,0.4)" size={16} />
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13.5, fontFamily: "Inter_600SemiBold" }}>
              {t("auth.reset.backToSignIn")}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <PermissionPrimingModal
        visible={priming.isVisible}
        onAccept={priming.accept}
        onDismiss={priming.dismiss}
      />
    </ScreenBackground>
    {celebrationModal}
    </>
  );
}
