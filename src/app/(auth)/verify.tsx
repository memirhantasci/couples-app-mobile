import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { appAlert } from "@/lib/dialog";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { navigateAfterAuth, setAuthFlowActive, releaseAuthFlow } from "@/lib/navigate";
import { registerForPushNotifications } from "@/lib/notifications";
import { ArrowLeft, Mail } from "lucide-react-native";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { getOrCreateDeviceId } from "@/utils/device";
import { normalizePairingCode } from "@/lib/pairingCode";
import { useAuth, DEVICE_AUTH_CACHE_KEY } from "@/context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { applyOtpInput } from "@/lib/otp";
import { Trans, useTranslation } from "react-i18next";

const OTP_LENGTH = 6;

export default function VerifyScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { setIsDeviceAuthorized, refreshProfile } = useAuth();
  const params = useLocalSearchParams<{
    email?: string;
    token_hash?: string;
    type?: string;
    inviteCode?: string;
  }>();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // ── Path B: Deep link auto-verify ────────────────────────────────────────
  const isDeepLinkVerify = !!(params.token_hash && params.type);
  const autoVerifyStartedRef = useRef(false);
  useEffect(() => {
    if (params.token_hash && params.type && !autoVerifyStartedRef.current) {
      autoVerifyStartedRef.current = true;
      handleDeepLinkVerify(params.token_hash, params.type);
    }
  }, [params.token_hash]);

  async function handleDeepLinkVerify(token_hash: string, type: string) {
    setIsLoading(true);
    setErrorMsg("");
    // Doğrulama oturumu açar ve kendi yönlendirmesini yapar (routeUser); koruyucu araya girmesin
    setAuthFlowActive(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash,
        type: type as any,
      });

      setIsLoading(false);

      if (error) {
        setErrorMsg(
          t("auth.verify.linkInvalid")
        );
        return;
      }

      if (data.user) {
        try {
          const deviceId = await getOrCreateDeviceId();
          await AsyncStorage.setItem("last_user_id", data.user.id);
          await AsyncStorage.setItem(DEVICE_AUTH_CACHE_KEY, JSON.stringify({
            userId: data.user.id,
            deviceId,
            isAuthorized: true,
            timestamp: Date.now(),
          }));
          setIsDeviceAuthorized(true);

          await supabase.from("device_authorizations").upsert({
            user_id: data.user.id,
            device_id: deviceId,
            device_name: Platform.OS,
            is_authorized: true,
          });
        } catch (devErr) {
          console.warn("[verify] device auth error:", devErr);
        }

        await registerForPushNotifications(data.user.id).catch(() => {});
        await routeUser(data.user.id);
      }
    } finally {
      releaseAuthFlow();
    }
  }

  // ── Path A: Manual OTP input ──────────────────────────────────────────────

  function handleDigitChange(value: string, index: number) {
    const result = applyOtpInput(digits, index, value, OTP_LENGTH);
    setDigits(result.digits);
    setErrorMsg("");
    inputRefs.current[result.focusIndex]?.focus();
    setFocusedIndex(result.focusIndex);
    if (result.complete) handleManualVerify(result.digits.join(""));
  }

  function handleKeyPress(key: string, index: number) {
    if (key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setFocusedIndex(index - 1);
    }
  }

  async function handleManualVerify(code?: string) {
    const otp = code ?? digits.join("");
    if (otp.length < OTP_LENGTH) {
      setErrorMsg(t("auth.verify.codeIncomplete"));
      return;
    }
    if (!params.email) {
      setErrorMsg(t("auth.verify.emailMissing"));
      return;
    }
    if (isLoading) return;

    setIsLoading(true);
    setErrorMsg("");
    setAuthFlowActive(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: params.email,
        token: otp,
        type: "email",
      });

      setIsLoading(false);

      if (error) {
        setErrorMsg(t("auth.verify.codeInvalid"));
        setDigits(Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
        setFocusedIndex(0);
        return;
      }

      if (data.user) {
        try {
          const deviceId = await getOrCreateDeviceId();
          await AsyncStorage.setItem("last_user_id", data.user.id);
          await AsyncStorage.setItem(DEVICE_AUTH_CACHE_KEY, JSON.stringify({
            userId: data.user.id,
            deviceId,
            isAuthorized: true,
            timestamp: Date.now(),
          }));
          setIsDeviceAuthorized(true);

          await supabase.from("device_authorizations").upsert({
            user_id: data.user.id,
            device_id: deviceId,
            device_name: Platform.OS,
            is_authorized: true,
          });
        } catch (devErr) {
          console.warn("[verify] device auth error:", devErr);
        }

        await registerForPushNotifications(data.user.id).catch(() => {});
        await routeUser(data.user.id);
      }
    } finally {
      releaseAuthFlow();
    }
  }

  async function routeUser(userId: string) {
    // Kayıtta girilen (ya da davet bağlantısından gelen) kodla eşleşmeyi dene. Başarısız olursa kod
    // hafızada kalır; eşleşme ekranı aynı kodu tekrar dener ve hatayı kullanıcıya orada gösterir.
    const pendingCode = normalizePairingCode(params.inviteCode || (await AsyncStorage.getItem("@pending_invite_code")));
    if (pendingCode.length >= 4) {
      try {
        const { error: joinError } = await supabase.rpc("join_couple_by_code_uuid", {
          p_code: pendingCode,
        });
        if (!joinError) {
          await AsyncStorage.removeItem("@pending_invite_code");
          // Bekleme ekranındaki partnere "eşleşme başarılı" bildirimini sunucu (couples tetikleyicisi) gönderir
        }
      } catch {
        // Hata durumunda standart akışa devam et
      }
    }

    // Yönlendirmeden önce profil yenilenmeli: eşleşme öncesinden kalan "eşleşmemiş" profil,
    // koruyucunun (useProtectedRoute) kullanıcıyı tarih ekranından eşleşme ekranına geri atmasına yol açıyordu
    navigateAfterAuth(await refreshProfile());
  }

  async function handleResend() {
    if (!params.email) return;
    setIsLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: params.email,
      options: { emailRedirectTo: "couplesapp://verify" },
    });
    setIsLoading(false);
    if (error) {
      appAlert(t("common.error"), t("auth.verify.resendFailed"));
    } else {
      toast.success(t("auth.verify.resent"), { title: t("auth.verify.resentTitle"), emoji: "📧" });
    }
  }

  if (isDeepLinkVerify && isLoading) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#080811" }}
      >
        <ActivityIndicator color="#FF4D6A" size="large" />
        <Text
          style={{ color: "rgba(255,255,255,0.6)", marginTop: 16, fontSize: 15 }}
        >
          {t("auth.verify.verifying")}
        </Text>
      </View>
    );
  }

  return (
    <ScreenBackground colors={["#080811", "#0A0A0C", "#080811"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(auth)/login");
              }
            }}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: "rgba(255,255,255,0.04)",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 48,
            }}
          >
            <ArrowLeft color="#fff" size={22} />
          </TouchableOpacity>

          <View style={{ alignItems: "center", marginBottom: 36 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: "rgba(255,255,255,0.03)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.05)",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <Mail color="#FF4D6A" size={32} />
            </View>

            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 28,
                fontFamily: "Inter_700Bold",
                letterSpacing: -0.5,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              {t("auth.verify.title")}
            </Text>
            
            <Text
              style={{
                color: "rgba(255,255,255,0.65)",
                fontSize: 15,
                textAlign: "center",
                lineHeight: 22,
                paddingHorizontal: 12,
              }}
            >
              {params.email ? (
                <Trans
                  i18nKey="auth.codeSentTo"
                  values={{ email: params.email }}
                  components={{ email: <Text style={{ color: "#FFFFFF", fontFamily: "Inter_600SemiBold" }} /> }}
                />
              ) : (
                t("auth.codeSentGeneric")
              )}
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
              marginBottom: 40,
            }}
          >
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                value={digit}
                onChangeText={(val) => handleDigitChange(val, index)}
                onKeyPress={({ nativeEvent }) =>
                  handleKeyPress(nativeEvent.key, index)
                }
                onFocus={() => setFocusedIndex(index)}
                keyboardType="number-pad"
                // Kod kutulardan birine yapıştırılabilsin diye (bkz. applyOtpInput) 1 değil OTP_LENGTH
                maxLength={OTP_LENGTH}
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                style={{
                  flex: 1,
                  maxWidth: 48,
                  height: 56,
                  borderRadius: 12,
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderWidth: 1.5,
                  borderColor:
                    focusedIndex === index || digit ? "#FF4D6A" : "rgba(255,255,255,0.08)",
                  color: "#FFFFFF",
                  fontSize: 22,
                  fontWeight: "700",
                  textAlign: "center",
                }}
              />
            ))}
          </View>

          {!!errorMsg && (
            <Text style={{ color: "#FF4D6A", textAlign: "center", marginBottom: 20, fontSize: 14 }}>
              {errorMsg}
            </Text>
          )}

          <TouchableOpacity
            onPress={() => handleManualVerify()}
            disabled={isLoading}
            style={{ borderRadius: 30, overflow: "hidden", marginBottom: 24, opacity: isLoading ? 0.7 : 1 }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#FF4D6A", "#FF4D6A"]} // Mockup shows solid looking pink/red, let's use the exact color from mockup or similar gradient
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingVertical: 18,
                alignItems: "center",
                borderRadius: 30,
                shadowColor: "#FF4D6A",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 14,
              }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 17 }}>
                  {t("auth.verify.submit")}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
              {t("auth.verify.noCode")}{" "}
            </Text>
            <TouchableOpacity onPress={handleResend} disabled={isLoading}>
              <Text style={{ color: "#FF4D6A", fontSize: 14, fontWeight: "600" }}>
                {t("auth.verify.resend")}
              </Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
