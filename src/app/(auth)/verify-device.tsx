import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { ChevronLeft } from "lucide-react-native";
import { dayjs } from "@/lib/date";

export default function VerifyDeviceScreen() {
  const { userId, deviceId } = useLocalSearchParams<{ userId: string; deviceId: string }>();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { refreshProfile } = useAuth();

  const handleVerify = async () => {
    if (code.length !== 6) {
      Alert.alert("Hata", "Lütfen 6 haneli kodu eksiksiz girin.");
      return;
    }

    setIsLoading(true);
    try {
      // Verify OTP and update device authorization atomically using RPC
      // This bypasses any RLS issues since we are unauthenticated at this step
      const { data: success, error: rpcError } = await supabase.rpc("verify_device_otp", {
        p_user_id: userId,
        p_device_id: deviceId,
        p_code: code,
      });

      if (rpcError || !success) {
        Alert.alert("Hata", "Geçersiz veya süresi dolmuş kod.");
        setIsLoading(false);
        return;
      }

      // Refresh profile and redirect to home
      await refreshProfile();
      router.replace("/(tabs)/home");

    } catch (e: any) {
      Alert.alert("Hata", "Beklenmedik bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenBackground colors={["#080811", "#0A0A0C", "#080811"]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft color="#fff" size={28} />
          </TouchableOpacity>
        </View>

        <View style={styles.container}>
          <Text style={styles.icon}>📱</Text>
          <Text style={styles.title}>Yeni Cihaz Doğrulama</Text>
          <Text style={styles.subtitle}>
            Hesabınızın güvenliği için bu cihazı doğrulamanız gerekiyor. E-posta adresinize gönderilen (test: terminaldeki) 6 haneli kodu aşağıya girin.
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="000000"
              placeholderTextColor="rgba(255,255,255,0.2)"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, code.length !== 6 && styles.buttonDisabled]} 
            onPress={handleVerify}
            disabled={code.length !== 6 || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Doğrula ve Giriş Yap</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  backBtn: {
    padding: 5,
    marginLeft: -5,
  },
  container: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: "center",
    paddingBottom: 100,
  },
  icon: {
    fontSize: 50,
    textAlign: "center",
    marginBottom: 20,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 40,
  },
  inputContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 10,
    paddingVertical: 16,
    width: "100%",
  },
  button: {
    backgroundColor: "#E8002D",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#E8002D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: "rgba(232, 0, 45, 0.5)",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  }
});
