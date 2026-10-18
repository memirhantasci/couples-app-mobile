import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
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
import { ArrowLeft, ShieldAlert, RefreshCw } from "lucide-react-native";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { navigateAfterAuth } from "@/lib/navigate";
import { isDatesSkipped } from "@/lib/datesSkip";
import { decrypt } from "@/utils/crypto";

const OTP_LENGTH = 6;

export default function VerifyDeviceScreen() {
  const { userId, deviceId, email } = useLocalSearchParams<{
    userId: string;
    deviceId: string;
    email?: string;
  }>();

  const { refreshProfile, setIsDeviceAuthorized, session } = useAuth();
  const targetEmail = email || session?.user?.email || "";

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [resendCooldown, setResendCooldown] = useState(60);
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
    const digit = value.replace(/[^0-9]/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setErrorMsg("");

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
      setFocusedIndex(index + 1);
    }
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
      setErrorMsg("Lütfen 6 haneli kodu eksiksiz girin.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");
    
    try {
      if (!targetEmail) {
        setErrorMsg("E-posta adresi bulunamadı.");
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
        setErrorMsg("Geçersiz veya süresi dolmuş kod.");
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
      await refreshProfile();

      // Route user correctly based on couple state
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
        hasDates: !!couple?.relationship_start_date || (await isDatesSkipped(userId)),
        displayName: userData?.display_name ? decrypt(userData.display_name) : null,
      });
    } catch (e: any) {
      setErrorMsg("Beklenmedik bir hata oluştu.");
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    if (!targetEmail) {
      setErrorMsg("E-posta adresi bulunamadı.");
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
        setErrorMsg("Kod gönderilemedi: " + error.message);
      } else {
        setResendCooldown(60);
        Alert.alert("Kod Gönderildi", "Yeni doğrulama kodu e-postanıza gönderildi.");
      }
    } catch {
      setErrorMsg("Kod gönderilirken bir hata oluştu.");
    } finally {
      setIsResending(false);
    }
  };

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
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 60, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          
          <TouchableOpacity
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
              Yeni Cihaz Doğrulaması
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
                <>
                  <Text style={{ color: "#FFFFFF", fontFamily: "Inter_600SemiBold" }}>
                    {targetEmail}
                  </Text>
                  {" adresine kod gönderdik"}
                </>
              ) : (
                "E-posta adresinize kod gönderdik"
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
                  Cihazı Onayla ve Giriş Yap
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
                ? "Gönderiliyor..."
                : resendCooldown > 0
                ? `Kodu tekrar gönder (${resendCooldown}s)`
                : "Kodu tekrar gönder"}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
