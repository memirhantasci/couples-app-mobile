import React, { useState } from "react";
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
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { encrypt } from "@/utils/crypto";
import { ArrowLeft } from "lucide-react-native";

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ userId?: string }>();
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleReset() {
    setError("");
    if (!otpCode.trim()) {
      setError("Lütfen doğrulama kodunu girin.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Şifreniz en az 6 karakter olmalı.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setIsLoading(true);
    try {
      // 1. Verify OTP
      const { data: otpData, error: otpError } = await supabase
        .from("otp_codes")
        .select("*")
        .eq("user_id", params.userId)
        .eq("code", otpCode.trim())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (otpError || !otpData) {
        setError("Geçersiz veya süresi dolmuş kod.");
        setIsLoading(false);
        return;
      }

      if (new Date(otpData.expires_at) < new Date()) {
        setError("Bu kodun süresi dolmuş.");
        setIsLoading(false);
        return;
      }

      // 2. Update Password
      const hashedPassword = encrypt(newPassword.trim());
      const { error: updateError } = await supabase
        .from("users")
        .update({ password: hashedPassword })
        .eq("id", params.userId);

      if (updateError) {
        setError("Şifre güncellenirken bir hata oluştu.");
        setIsLoading(false);
        return;
      }

      // Optional: Delete used OTP
      await supabase.from("otp_codes").delete().eq("id", otpData.id);

      setSuccess(true);
    } catch (e) {
      setError("Beklenmedik bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  }

  if (success) {
    return (
      <ScreenBackground colors={["#080811", "#0A0A0C", "#080811"]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 30 }}>
          <Text style={{ fontSize: 60, marginBottom: 20 }}>✅</Text>
          <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 10, textAlign: "center" }}>
            Şifreniz Güncellendi!
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, textAlign: "center", marginBottom: 40 }}>
            Artık yeni şifrenizle giriş yapabilirsiniz.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace("/(auth)/login")}
            style={{
              backgroundColor: "#E8002D",
              paddingVertical: 16,
              paddingHorizontal: 40,
              borderRadius: 18,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              Giriş Ekranına Dön
            </Text>
          </TouchableOpacity>
        </View>
      </ScreenBackground>
    );
  }

  const inputStyle = {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: "#fff",
    fontSize: 16,
    marginBottom: 14,
  };

  const labelStyle = {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    marginBottom: 6,
    marginLeft: 2,
  };

  return (
    <ScreenBackground colors={["#080811", "#0A0A0C", "#080811"]}>
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

          <Text style={{ color: "#fff", fontSize: 30, fontWeight: "800", marginBottom: 12, letterSpacing: -0.5 }}>
            Yeni Şifre Belirle
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, lineHeight: 22, marginBottom: 32 }}>
            Konsola (veya e-postana) gelen 6 haneli kodu ve yeni şifreni gir.
          </Text>

          <Text style={labelStyle}>Doğrulama Kodu</Text>
          <TextInput
            value={otpCode}
            onChangeText={setOtpCode}
            placeholder="000000"
            placeholderTextColor="rgba(255,255,255,0.3)"
            keyboardType="number-pad"
            style={inputStyle}
          />

          <Text style={labelStyle}>Yeni Şifre</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Yeni şifreniz"
            placeholderTextColor="rgba(255,255,255,0.3)"
            secureTextEntry
            style={inputStyle}
          />

          <Text style={labelStyle}>Şifreyi Tekrar Gir</Text>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Yeni şifrenizi doğrulayın"
            placeholderTextColor="rgba(255,255,255,0.3)"
            secureTextEntry
            style={inputStyle}
          />

          {!!error && (
            <View style={{ backgroundColor: "rgba(232,0,45,0.12)", borderWidth: 1, borderColor: "rgba(232,0,45,0.3)", borderRadius: 14, padding: 14, marginBottom: 16, marginTop: 10 }}>
              <Text style={{ color: "#FF4D6A", fontSize: 14, textAlign: "center" }}>
                {error}
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleReset}
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
                Şifreyi Güncelle
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
