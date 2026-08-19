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
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { deterministicEncrypt } from "@/utils/crypto";
import { ArrowLeft } from "lucide-react-native";

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
      {/* Background glow similar to login */}
      <View
        style={{
          position: "absolute",
          top: -80,
          left: -80,
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: "rgba(232, 0, 45, 0.15)",
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 60 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 30 }}>
            <ArrowLeft color="#fff" size={28} />
          </TouchableOpacity>

          <Text style={{ color: "#fff", fontSize: 32, fontWeight: "800", marginBottom: 12, letterSpacing: -0.5 }}>
            Şifreni mi Unuttun?
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, lineHeight: 22, marginBottom: 40 }}>
            Endişelenme, hesabını bulup şifreni sıfırlamana yardımcı olacağız. Lütfen kullanıcı adını gir.
          </Text>

          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 6, marginLeft: 2 }}>
            Kullanıcı Adı
          </Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="kullaniciadi"
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              backgroundColor: "rgba(255,255,255,0.07)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
              borderRadius: 16,
              paddingHorizontal: 18,
              paddingVertical: 16,
              color: "#FFFFFF",
              fontSize: 16,
              marginBottom: 14,
            }}
          />

          {!!errorMsg && (
            <View style={{ backgroundColor: "rgba(232,0,45,0.12)", borderWidth: 1, borderColor: "rgba(232,0,45,0.3)", borderRadius: 14, padding: 14, marginBottom: 16 }}>
              <Text style={{ color: "#FF4D6A", fontSize: 14, textAlign: "center" }}>
                {errorMsg}
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleSend}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? "rgba(232,0,45,0.5)" : "#E8002D",
              paddingVertical: 18,
              borderRadius: 18,
              alignItems: "center",
              marginTop: 10,
              shadowColor: "#E8002D",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 17 }}>
                Devam Et
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
