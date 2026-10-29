import React, { useState, useEffect, useEffectEvent, useRef, useCallback } from "react";
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
import { useAuth } from "@/context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link, Share2, LogOut, Sparkles, Check, Copy } from "lucide-react-native";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { navigateAfterAuth } from "@/lib/navigate";
import { isDefinitivePairingError, normalizePairingCode, translatePairingError } from "@/lib/pairingCode";
import { useNotificationPriming } from "@/hooks/useNotificationPriming";
import { PermissionPrimingModal } from "@/components/common/PermissionPrimingModal";
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

// ─── Pairing Screen ──────────────────────────────────────────────────────────

export default function PairingScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, profile, refreshProfile, signOut, enterDemoMode } = useAuth();
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

  // Eşleşme tamamlandı: profil yenilenmeden yönlendirilirse koruyucu (useProtectedRoute) eski
  // "eşleşmemiş" profile bakıp kullanıcıyı bu ekrana geri atıyordu
  const finishPairing = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    await AsyncStorage.removeItem("@pending_invite_code");
    const fresh = await refreshProfile();
    if (fresh?.isPaired) {
      navigateAfterAuth(fresh);
    } else {
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
    const { data, error } = await supabase.rpc("join_couple_by_code_uuid", {
      p_code: code,
    });

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

    const result = Array.isArray(data) ? data[0] : data;
    if (result?.result_is_paired) {
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
  if (!autoPairChecked || isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0A0A10", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#FF4D6A" size="large" />
      </View>
    );
  }

  const activePairingCode = status?.pairingCode;

  return (
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
                fontSize: 30,
                fontFamily: "Inter_700Bold",
                letterSpacing: -0.5,
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
              borderWidth: 1.5,
              borderColor: "rgba(255, 77, 106, 0.4)",
              borderRadius: 24,
              padding: 24,
              backgroundColor: "rgba(255, 77, 106, 0.07)",
              marginBottom: 24,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Sparkles color="#FF4D6A" size={18} />
                <Text style={{ color: "#FF4D6A", fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 1 }}>
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
                backgroundColor: "rgba(0,0,0,0.45)",
                borderWidth: 1.5,
                borderColor: "rgba(255, 77, 106, 0.3)",
                borderRadius: 18,
                paddingVertical: 18,
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
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.12)",
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
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.12)",
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
                backgroundColor: "#FF4D6A",
                borderRadius: 18,
                paddingVertical: 15,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginBottom: 12,
                shadowColor: "#FF4D6A",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
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
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#FF4D6A" }} />
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                {t("setup.pairing.waiting")}
              </Text>
            </View>
          </View>

          {/* ─── 2. PARTNERİNİN KODUNU GİR KARTI ─── */}
          <View
            style={{
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              borderRadius: 24,
              padding: 24,
              backgroundColor: "rgba(255,255,255,0.03)",
              marginBottom: 20,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginBottom: 6 }}>
              {t("setup.pairing.enterTitle")}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 18 }}>
              {t("setup.pairing.enterHint")}
            </Text>

            <TextInput
              value={inputCode}
              onChangeText={(t) => {
                setInputCode(normalizePairingCode(t));
                if (submitError) setSubmitError("");
              }}
              placeholder="XXXXXX"
              placeholderTextColor="rgba(255,255,255,0.2)"
              autoCapitalize="characters"
              autoCorrect={false}
              style={{
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
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
                  backgroundColor: "rgba(232,0,45,0.1)",
                  borderWidth: 1,
                  borderColor: "rgba(232,0,45,0.3)",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 14,
                }}
              >
                <Text style={{ color: "#FF4D6A", fontSize: 13, textAlign: "center" }}>
                  {submitError}
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting || inputCode.length < 4}
              style={{
                backgroundColor: inputCode.length < 4 ? "rgba(77,156,255,0.4)" : "#4D9CFF",
                paddingVertical: 16,
                borderRadius: 24,
                alignItems: "center",
                shadowColor: "#4D9CFF",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                  {t("setup.pairing.submit")}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ─── 3. BEKLEME ODASI: PARTNER KATILINCA NELER AÇILACAK? ─── */}
          <View
            style={{
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
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
              backgroundColor: "rgba(255, 77, 106, 0.12)",
              borderWidth: 1.2,
              borderColor: "rgba(255, 77, 106, 0.4)",
              borderRadius: 20,
              paddingVertical: 14,
              paddingHorizontal: 20,
              marginBottom: 8,
            }}
          >
            <Sparkles color="#FF4D6A" size={18} />
            <Text style={{ color: "#FF4D6A", fontSize: 14, fontFamily: "Inter_700Bold" }}>
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
                console.error(e);
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
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13.5, fontWeight: "600" }}>
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
  );
}
