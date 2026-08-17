import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token_hash?: string }>();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Exchange token_hash for a session so we can call updateUser
  useEffect(() => {
    if (params.token_hash) {
      supabase.auth
        .verifyOtp({ token_hash: params.token_hash, type: "recovery" })
        .then(({ error }) => {
          if (error) {
            setError("Bağlantı geçersiz veya süresi dolmuş.");
          } else {
            setSessionReady(true);
          }
        });
    }
  }, [params.token_hash]);

  async function handleReset() {
    if (newPassword.length < 6) {
      setError("Şifren en az 6 karakter olmalı.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsLoading(false);
    if (error) {
      setError("Şifre güncellenirken hata oluştu.");
    } else {
      router.replace("/(auth)/login");
    }
  }

  return (
    <ScreenBackground colors={["#080811", "#0A0A0C", "#080811"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={{ flex: 1, justifyContent: "center", padding: 28 }}>
          <Text style={{ color: "#fff", fontSize: 26, fontWeight: "800", marginBottom: 8 }}>
            Yeni Şifre Belirle
          </Text>
          <Text
            style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 32 }}
          >
            Hesabına yeni bir şifre oluştur.
          </Text>

          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Yeni şifre"
            placeholderTextColor="rgba(255,255,255,0.3)"
            secureTextEntry
            style={{
              backgroundColor: "rgba(255,255,255,0.07)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
              borderRadius: 16,
              paddingHorizontal: 18,
              paddingVertical: 16,
              color: "#fff",
              fontSize: 16,
              marginBottom: 14,
            }}
          />
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Şifreyi tekrar gir"
            placeholderTextColor="rgba(255,255,255,0.3)"
            secureTextEntry
            style={{
              backgroundColor: "rgba(255,255,255,0.07)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
              borderRadius: 16,
              paddingHorizontal: 18,
              paddingVertical: 16,
              color: "#fff",
              fontSize: 16,
              marginBottom: 24,
            }}
          />

          {!!error && (
            <Text style={{ color: "#FF4D6A", fontSize: 14, marginBottom: 16 }}>
              {error}
            </Text>
          )}

          <TouchableOpacity
            onPress={handleReset}
            disabled={isLoading || !sessionReady}
            style={{
              backgroundColor: sessionReady ? "#E8002D" : "rgba(232,0,45,0.4)",
              paddingVertical: 18,
              borderRadius: 18,
              alignItems: "center",
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
        </View>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
