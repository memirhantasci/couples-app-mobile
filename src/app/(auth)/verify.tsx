import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { navigateAfterAuth } from "@/lib/navigate";
import { registerForPushNotifications } from "@/lib/notifications";
import { ArrowLeft, Mail, Sparkles, LogOut } from "lucide-react-native";
import { decrypt } from "@/utils/crypto";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { getOrCreateDeviceId } from "@/utils/device";
import { useAuth } from "@/context/AuthContext";

const OTP_LENGTH = 6;

export default function VerifyScreen() {
  const params = useLocalSearchParams<{
    email?: string;
    token_hash?: string;
    type?: string;
    inviteCode?: string;
  }>();

  const { setIsDeviceAuthorized, enterDemoMode } = useAuth();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [resendStatus, setResendStatus] = useState("");
  const [autoVerified, setAutoVerified] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // ── Path B: Deep link auto-verify ────────────────────────────────────────
  useEffect(() => {
    if (params.token_hash && params.type && !autoVerified) {
      setAutoVerified(true);
      handleDeepLinkVerify(params.token_hash, params.type);
    }
  }, [params.token_hash]);

  async function handleDeepLinkVerify(token_hash: string, type: string) {
    setIsLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    });

    setIsLoading(false);

    if (error) {
      setErrorMsg(
        "Bağlantı geçersiz veya süresi dolmuş. Lütfen tekrar e-posta iste."
      );
      return;
    }

    if (data.user) {
      try {
        const deviceId = await getOrCreateDeviceId();
        await supabase.from("device_authorizations").upsert({
          user_id: data.user.id,
          device_id: deviceId,
          is_authorized: true,
        });
        await AsyncStorage.setItem("last_user_id", data.user.id);
        setIsDeviceAuthorized(true);
      } catch (devErr) {
        console.warn("[verify] device auth error:", devErr);
      }

      await registerForPushNotifications(data.user.id).catch(() => {});
      await routeUser(data.user.id);
    }
  }

  // ── Path A: Manual OTP input ──────────────────────────────────────────────

  function handleDigitChange(value: string, index: number) {
    const digit = value.replace(/[^0-9]/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setErrorMsg("");

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
      setFocusedIndex(index + 1);
    }

    if (digit && index === OTP_LENGTH - 1) {
      const code = [...newDigits.slice(0, -1), digit].join("");
      if (code.length === OTP_LENGTH) {
        handleManualVerify(code);
      }
    }
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
      setErrorMsg("Lütfen 6 haneli kodu eksiksiz gir.");
      return;
    }
    if (!params.email) {
      setErrorMsg("E-posta bilgisi eksik. Lütfen tekrar dene.");
      return;
    }
    if (isLoading) return;

    setIsLoading(true);
    setErrorMsg("");

    // 1. Önce type: "signup" ile dene
    let { data, error } = await supabase.auth.verifyOtp({
      email: params.email,
      token: otp,
      type: "signup",
    });

    // 2. Eğer başarısız olursa type: "email" ile tekrar dene
    if (error) {
      const retry = await supabase.auth.verifyOtp({
        email: params.email,
        token: otp,
        type: "email",
      });
      if (!retry.error) {
        data = retry.data;
        error = null;
      }
    }

    setIsLoading(false);

    if (error) {
      setErrorMsg("Kod hatalı veya süresi dolmuş. Lütfen tekrar dene.");
      setDigits(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
      setFocusedIndex(0);
      return;
    }

    if (data.user) {
      // ⚡ KRİTİK ADIM: Bu cihazı yetkilendir ki 'yeni cihaz doğrulaması' döngüsüne düşmesin!
      try {
        const deviceId = await getOrCreateDeviceId();
        await supabase.from("device_authorizations").upsert({
          user_id: data.user.id,
          device_id: deviceId,
          is_authorized: true,
        });
        await AsyncStorage.setItem("last_user_id", data.user.id);
        setIsDeviceAuthorized(true);
      } catch (devErr) {
        console.warn("[verify] device auth error:", devErr);
      }

      await registerForPushNotifications(data.user.id).catch(() => {});
      await routeUser(data.user.id);
    }
  }

  async function routeUser(userId: string) {
    // 1. Bekleyen bir davet kodu var mı kontrol et
    const pendingCode = (params.inviteCode || (await AsyncStorage.getItem("@pending_invite_code")))?.trim().toUpperCase();
    if (pendingCode && pendingCode.length >= 4) {
      try {
        const { error: joinError } = await supabase.rpc("join_couple_by_code_uuid", {
          p_code: pendingCode,
        });
        if (!joinError) {
          await AsyncStorage.removeItem("@pending_invite_code");
          // Eşleşme tamamlandı! Doğrudan ilişki tarihi seçme ekranına yönlendir
          router.replace("/(setup)/dates");
          return;
        }
      } catch {
        // Hata durumunda standart akışa devam et
      }
    }

    const { data: userData } = await supabase
      .from("users")
      .select("display_name, couple_id")
      .eq("id", userId)
      .single();

    let couple: any = null;
    if (userData?.couple_id) {
      const { data: cData } = await supabase
        .from("couples")
        .select("meet_date, relationship_start_date")
        .eq("id", userData.couple_id)
        .single();
      if (cData) {
        couple = cData;
      }
    }

    navigateAfterAuth({
      coupleId: userData?.couple_id ?? null,
      meetDate: couple?.meet_date ?? null,
      relationshipStartDate: couple?.relationship_start_date ?? null,
      isPaired: !!userData?.couple_id,
      hasDates: !!(couple?.meet_date && couple?.relationship_start_date),
      displayName: userData?.display_name ? decrypt(userData.display_name) : null,
    });
  }

  async function handleResend() {
    if (!params.email) return;
    setIsLoading(true);
    setResendStatus("");
    setErrorMsg("");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: params.email,
      options: { emailRedirectTo: "couplesapp://verify" },
    });
    setIsLoading(false);
    if (error) {
      setErrorMsg("Kod gönderilemedi. Lütfen kısa bir süre sonra tekrar dene.");
    } else {
      setResendStatus("Yeni doğrulama kodu gönderildi! (Spam klasörünü de kontrol et ✨)");
      setTimeout(() => setResendStatus(""), 6000);
    }
  }

  return (
    <ScreenBackground colors={["#080811", "#0A0A0C", "#080811"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 60, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: "rgba(255,255,255,0.07)",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 32,
            }}
          >
            <ArrowLeft color="#fff" size={22} />
          </TouchableOpacity>

          {/* Email Icon & Title */}
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
              E-postanı Doğrula
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
                <>
                  <Text style={{ color: "#FFFFFF", fontFamily: "Inter_600SemiBold" }}>
                    {params.email}
                  </Text>
                  {" adresine gönderilen 6 haneli kodu gir."}
                </>
              ) : (
                "E-posta adresinize gönderilen 6 haneli kodu gir."
              )}
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
              marginBottom: 36,
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
                maxLength={1}
                style={{
                  width: 48,
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

          {!!resendStatus && (
            <Text style={{ color: "#10B981", textAlign: "center", marginBottom: 20, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>
              {resendStatus}
            </Text>
          )}

          <TouchableOpacity
            onPress={() => handleManualVerify()}
            disabled={isLoading}
            style={{ borderRadius: 30, overflow: "hidden", marginBottom: 20, opacity: isLoading ? 0.7 : 1 }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#FF4D6A", "#E8002D"]}
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
                  Doğrula ve Devam Et
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 16 }}>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
              Kod gelmedi mi?{" "}
            </Text>
            <TouchableOpacity onPress={handleResend} disabled={isLoading}>
              <Text style={{ color: "#FF4D6A", fontSize: 14, fontWeight: "600" }}>
                Tekrar Gönder
              </Text>
            </TouchableOpacity>
          </View>

          {/* ─── Beklemek İstemeyenler İçin Demo Modu ─── */}
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
              backgroundColor: "rgba(255, 77, 106, 0.1)",
              borderWidth: 1.2,
              borderColor: "rgba(255, 77, 106, 0.35)",
              borderRadius: 20,
              paddingVertical: 13,
              paddingHorizontal: 20,
              marginTop: 10,
              marginBottom: 12,
            }}
          >
            <Sparkles color="#FF4D6A" size={16} />
            <Text style={{ color: "#FF4D6A", fontSize: 13.5, fontFamily: "Inter_700Bold" }}>
              Beklemek İstemiyorum (Demo Modunda Keşfet ✨)
            </Text>
          </TouchableOpacity>

          {/* Giriş Ekranına Dön */}
          <TouchableOpacity
            onPress={() => router.replace("/(auth)/login")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: 10,
            }}
          >
            <LogOut color="rgba(255,255,255,0.4)" size={15} />
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: "600" }}>
              Giriş Ekranına Dön
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
