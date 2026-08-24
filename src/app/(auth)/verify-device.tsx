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
} from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, ShieldAlert } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const OTP_LENGTH = 6;

function maskEmail(email: string) {
  if (!email) return "";
  const [localPart, domain] = email.split("@");
  if (!domain) return email;
  if (localPart.length <= 2) return `${localPart}***@${domain}`;
  const firstLetter = localPart[0];
  const lastLetter = localPart[localPart.length - 1];
  return `${firstLetter}***${lastLetter}@${domain}`;
}

export default function VerifyDeviceScreen() {
  const { userId, deviceId, email } = useLocalSearchParams<{
    userId: string;
    deviceId: string;
    email?: string;
  }>();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  
  const { refreshProfile } = useAuth();

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
      if (!email) {
        setErrorMsg("E-posta adresi bulunamadı.");
        setIsLoading(false);
        return;
      }

      // Verify the OTP using Supabase's native auth system
      const { data, error: otpError } = await supabase.auth.verifyOtp({
        email,
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
      await refreshProfile();
      router.replace("/(tabs)/home");
    } catch (e: any) {
      setErrorMsg("Beklenmedik bir hata oluştu.");
      setIsLoading(false);
    }
  };

  return (
    <ScreenBackground colors={["#080811", "#0A0A0C", "#080811"]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 60, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          
          <TouchableOpacity
            onPress={() => router.back()}
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
                fontSize: 32,
                fontFamily: "PlayfairDisplay_400Regular_Italic",
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              Yeni Cihaz Doğrulaması
            </Text>
            
            <Text
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 15,
                textAlign: "center",
              }}
            >
              {email ? `${maskEmail(email)} adresine kod gönderdik` : "E-posta adresine kod gönderdik"}
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
                ref={(el) => (inputRefs.current[index] = el)}
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

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
