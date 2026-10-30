import { useState } from "react";
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
import { resetPasswordWithCode } from "@/lib/authGateway";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ identifier?: string }>();
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleReset() {
    setError("");
    if (!otpCode.trim()) {
      setError(t("auth.reset.codeRequired"));
      return;
    }
    if (newPassword.length < 8) {
      setError(t("auth.reset.passwordTooShort"));
      return;
    }
    if (newPassword !== confirm) {
      setError(t("auth.reset.mismatch"));
      return;
    }
    if (!params.identifier) {
      setError(t("auth.reset.restart"));
      return;
    }

    setIsLoading(true);
    try {
      // Kod, Supabase Auth'un kurtarma e-postasıyla gelir; sunucu kodu doğrulayıp şifreyi günceller
      // ve hesabın diğer oturumlarını kapatır (bkz. supabase/functions/auth-gateway)
      const result = await resetPasswordWithCode(params.identifier, otpCode.trim(), newPassword.trim());

      if (!result.ok) {
        if (result.code === "invalid_code") {
          setError(t("auth.reset.codeInvalid"));
        } else if (result.code === "weak_password") {
          setError(t("auth.reset.passwordTooShort"));
        } else if (result.code === "too_many_requests") {
          setError(t("auth.errors.tooManyAttemptsPolite"));
        } else {
          setError(t("auth.reset.updateFailed"));
        }
        return;
      }

      setSuccess(true);
    } catch (e) {
      setError(t("errors.unexpected"));
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
            {t("auth.reset.successTitle")}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, textAlign: "center", marginBottom: 40 }}>
            {t("auth.reset.successMessage")}
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
              {t("auth.reset.backToSignIn")}
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
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            padding: 24,
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 40,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("a11y.back")}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(auth)/login");
              }
            }}
            style={{ marginBottom: 30 }}
          >
            <ArrowLeft color="#fff" size={28} />
          </TouchableOpacity>

          <Text style={{ color: "#fff", fontSize: 30, fontWeight: "800", marginBottom: 12, letterSpacing: -0.5 }}>
            {t("auth.reset.title")}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, lineHeight: 22, marginBottom: 32 }}>
            {t("auth.reset.subtitle")}
          </Text>

          <Text style={labelStyle}>{t("auth.reset.codeLabel")}</Text>
          <TextInput
            value={otpCode}
            onChangeText={setOtpCode}
            placeholder="000000"
            placeholderTextColor="rgba(255,255,255,0.3)"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            style={inputStyle}
          />

          <Text style={labelStyle}>{t("auth.reset.newPassword")}</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={t("auth.reset.newPasswordPlaceholder")}
            autoComplete="new-password"
            textContentType="newPassword"
            autoCapitalize="none"
            placeholderTextColor="rgba(255,255,255,0.3)"
            secureTextEntry
            style={inputStyle}
          />

          <Text style={labelStyle}>{t("auth.reset.confirmPassword")}</Text>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder={t("auth.reset.confirmPlaceholder")}
            autoComplete="new-password"
            textContentType="newPassword"
            autoCapitalize="none"
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
                {t("auth.reset.submit")}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
