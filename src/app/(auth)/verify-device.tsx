import { useState, useRef, useEffect, useEffectEvent } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  BackHandler,
} from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth, DEVICE_AUTH_CACHE_KEY } from "@/context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ShieldAlert } from "lucide-react-native";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { navigateAfterAuth, setAuthFlowActive, releaseAuthFlow } from "@/lib/navigate";
import { toast } from "@/lib/toast";

import { applyOtpInput } from "@/lib/otp";
import { Trans, useTranslation } from "react-i18next";

const OTP_LENGTH = 6;

export default function VerifyDeviceScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { userId, deviceId, email, codeSent } = useLocalSearchParams<{
    userId: string;
    deviceId: string;
    email?: string;
    /** "1": giriş ekranı kodu az önce gönderdi. Yoksa (ör. uygulama yeniden açıldı) kod burada istenir. */
    codeSent?: string;
  }>();

  const { refreshProfile, setIsDeviceAuthorized, session } = useAuth();
  const targetEmail = email || session?.user?.email || "";

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  // Bekleme süresi yalnızca bir kod gerçekten gönderildiyse işler; aksi halde kullanıcı kodsuz 60 sn kilitleniyordu
  const [resendCooldown, setResendCooldown] = useState(codeSent === "1" ? 60 : 0);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    const handleBackAction = () => {
      supabase.auth.signOut().then(() => {
        setIsDeviceAuthorized(null);
        router.replace("/(auth)/login");
      });
      return true;
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", handleBackAction);
    return () => backHandler.remove();
  }, [setIsDeviceAuthorized]);

  function handleDigitChange(value: string, index: number) {
    const result = applyOtpInput(digits, index, value, OTP_LENGTH);
    setDigits(result.digits);
    setErrorMsg("");
    inputRefs.current[result.focusIndex]?.focus();
    setFocusedIndex(result.focusIndex);
  }

  function handleKeyPress(key: string, index: number) {
    if (key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setFocusedIndex(index - 1);
    }
  }

  const handleVerify = async () => {
    const code = digits.join("");
    if (code.length !== OTP_LENGTH) {
      setErrorMsg(t("auth.verifyDevice.codeIncomplete"));
      return;
    }

    setIsLoading(true);
    setErrorMsg("");
    setAuthFlowActive(true);

    try {
      if (!targetEmail) {
        setErrorMsg(t("auth.errors.emailNotFound"));
        setIsLoading(false);
        return;
      }

      // Verify the OTP using Supabase's native auth system
      const { data, error: otpError } = await supabase.auth.verifyOtp({
        email: targetEmail,
        token: code,
        type: "email",
      });

      if (otpError || !data.session) {
        setErrorMsg(t("auth.verifyDevice.codeInvalid"));
        setIsLoading(false);
        setDigits(Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
        setFocusedIndex(0);
        return;
      }

      // If successful, register the device
      const { error: insertError } = await supabase
        .from("device_authorizations")
        .upsert({
          user_id: userId,
          device_id: deviceId,
          device_name: Platform.OS, // Basic device info
          is_authorized: true,
        }, { onConflict: "user_id, device_id" }) // Upsert in case it was added before
        .select();

      if (insertError) {
         // Fallback if upsert fails, try simple insert (schema dependent)
         await supabase.from("device_authorizations").insert({
           user_id: userId,
           device_id: deviceId,
           device_name: Platform.OS,
           is_authorized: true,
         });
      }

      await AsyncStorage.setItem("last_user_id", userId);
      await AsyncStorage.setItem(DEVICE_AUTH_CACHE_KEY, JSON.stringify({
        userId,
        deviceId,
        isAuthorized: true,
        timestamp: Date.now(),
      }));
      setIsDeviceAuthorized(true);

      // Route user correctly based on couple state (eşleşme ölçütü AuthContext ile aynı: 2 üye)
      navigateAfterAuth(await refreshProfile());
    } catch (e: any) {
      setErrorMsg(t("errors.unexpected"));
      setIsLoading(false);
    } finally {
      releaseAuthFlow();
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    if (!targetEmail) {
      setErrorMsg(t("auth.errors.emailNotFound"));
      return;
    }
    setIsResending(true);
    setErrorMsg("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: targetEmail,
        options: { shouldCreateUser: false },
      });
      if (error) {
        setErrorMsg(t("auth.verifyDevice.sendFailedWithMessage", { message: error.message }));
      } else {
        setResendCooldown(60);
        toast.success(t("auth.verifyDevice.resent"), { title: t("auth.verifyDevice.resentTitle"), emoji: "📧" });
      }
    } catch {
      setErrorMsg(t("auth.verifyDevice.resendError"));
    } finally {
      setIsResending(false);
    }
  };

  // Yetkisiz cihazla yeniden açılan uygulama (useProtectedRoute) buraya kod göndermeden gelir: kod hemen istenir
  const autoSendStartedRef = useRef(false);
  const sendInitialCode = useEffectEvent(() => {
    handleResend();
  });
  useEffect(() => {
    if (codeSent === "1" || autoSendStartedRef.current) return;
    autoSendStartedRef.current = true;
    sendInitialCode();
  }, [codeSent]);

  const handleBack = async () => {
    await supabase.auth.signOut();
    setIsDeviceAuthorized(null);
    router.replace("/(auth)/login");
  };

  return (
    <ScreenBackground colors={["#080811", "#0A0A0C", "#080811"]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("a11y.back")}
            onPress={handleBack}
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
                borderColor: "#FF4D6A",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <ShieldAlert color="#FF4D6A" size={32} />
            </View>

            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 26,
                fontFamily: "Inter_700Bold",
                letterSpacing: -0.5,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              {t("auth.verifyDevice.title")}
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
              {targetEmail ? (
                <Trans
                  i18nKey="auth.codeSentTo"
                  values={{ email: targetEmail }}
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
            onPress={handleVerify}
            disabled={isLoading || digits.join("").length !== OTP_LENGTH}
            style={{ borderRadius: 30, overflow: "hidden", marginBottom: 24, opacity: isLoading || digits.join("").length !== OTP_LENGTH ? 0.7 : 1 }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#FF4D6A", "#9B4DFF"]} // Pink to Purple gradient for device verify as in mockup
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingVertical: 18,
                alignItems: "center",
                borderRadius: 30,
                shadowColor: "#9B4DFF",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 14,
              }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 17 }}>
                  {t("auth.verifyDevice.submit")}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleResend}
            disabled={resendCooldown > 0 || isResending}
            style={{ alignItems: "center", paddingVertical: 12 }}
            activeOpacity={0.7}
          >
            <Text
              style={{
                color: resendCooldown > 0 ? "rgba(255,255,255,0.4)" : "#FF4D6A",
                fontSize: 14,
                fontFamily: "Inter_500Medium",
              }}
            >
              {isResending
                ? t("auth.verifyDevice.sending")
                : resendCooldown > 0
                ? t("auth.verifyDevice.resendCountdown", { seconds: resendCooldown })
                : t("auth.verifyDevice.resend")}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
