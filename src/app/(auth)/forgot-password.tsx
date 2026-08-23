import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { deterministicEncrypt } from "@/utils/crypto";
import { ArrowLeft, Lock } from "lucide-react-native";

export default function ForgotPasswordScreen() {
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSend() {
    setErrorMsg("");
    if (!username.trim()) {
      setErrorMsg("Lütfen kullanıcı adınızı girin.");
      return;
    }

    setIsLoading(true);
    try {
      const encryptedUsername = deterministicEncrypt(username.trim().toLowerCase());
      
      const { data: user, error } = await supabase
        .from("users")
        .select("id")
        .eq("username", encryptedUsername)
        .single();

      if (error || !user) {
        setErrorMsg("Bu kullanıcı adına sahip bir hesap bulunamadı.");
        setIsLoading(false);
        return;
      }

      // Generate OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
      
      await supabase.from("otp_codes").insert({
        user_id: user.id,
        code: otpCode,
        expires_at: expiresAt.toISOString(),
      });

      console.log("-----------------------------------------");
      console.log("🔑 OTP CODE (PASSWORD RESET):", otpCode);
      console.log("-----------------------------------------");

      // Go to reset password screen with userId
      router.push({
        pathname: "/(auth)/reset-password",
        params: { userId: user.id.toString() }
      });
    } catch (e) {
      setErrorMsg("Beklenmedik bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ScreenBackground colors={["#080811", "#0A0A0C", "#080811"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 60, paddingBottom: 60 }}
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
              marginBottom: 48,
            }}
          >
            <ArrowLeft color="#fff" size={22} />
          </TouchableOpacity>

          {/* Lock Icon */}
          <View style={{ alignItems: "center", marginBottom: 36 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: "rgba(255,255,255,0.06)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Lock color="rgba(255,255,255,0.85)" size={34} />
            </View>
          </View>

          {/* Title & Subtitle */}
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 30,
              fontWeight: "800",
              textAlign: "center",
              marginBottom: 12,
              letterSpacing: -0.5,
            }}
          >
            Şifreni mi Unuttun?
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: 15,
              lineHeight: 22,
              textAlign: "center",
              marginBottom: 40,
              paddingHorizontal: 8,
            }}
          >
            Endişelenme, sana yardımcı olacağız. E-posta adresini girerek başlayabilirsin.
          </Text>

          {/* Input */}
          <Text
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 13,
              marginBottom: 8,
              marginLeft: 2,
            }}
          >
            Kullanıcı Adı
          </Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="ornek@kullanici.com"
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.1)",
              borderRadius: 16,
              paddingHorizontal: 18,
              paddingVertical: 16,
              color: "#FFFFFF",
              fontSize: 16,
              marginBottom: 14,
            }}
          />

          {/* Error */}
          {!!errorMsg && (
            <View
              style={{
                backgroundColor: "rgba(232,0,45,0.1)",
                borderWidth: 1,
                borderColor: "rgba(232,0,45,0.3)",
                borderRadius: 14,
                padding: 14,
                marginBottom: 16,
              }}
            >
              <Text style={{ color: "#FF4D6A", fontSize: 14, textAlign: "center" }}>
                {errorMsg}
              </Text>
            </View>
          )}

          <View style={{ height: 12 }} />

          {/* CTA Button */}
          <TouchableOpacity
            onPress={handleSend}
            disabled={isLoading}
            style={{ borderRadius: 30, overflow: "hidden", opacity: isLoading ? 0.7 : 1 }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#E8002D", "#C0006B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingVertical: 18,
                alignItems: "center",
                borderRadius: 30,
                shadowColor: "#E8002D",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.45,
                shadowRadius: 14,
              }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 17 }}>
                  Kod Gönder
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
