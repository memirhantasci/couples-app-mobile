import { useState } from "react";
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
import { requestPasswordReset } from "@/lib/authGateway";
import { normalizeUsername } from "@/lib/username";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Lock } from "lucide-react-native";
import { useTranslation } from "react-i18next";

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSend() {
    setErrorMsg("");
    const value = identifier.trim();
    if (!value) {
      setErrorMsg(t("auth.forgot.identifierRequired"));
      return;
    }

    setIsLoading(true);
    try {
      const normalized = value.includes("@") ? value.toLowerCase() : normalizeUsername(value);

      // Kod Supabase Auth'un kurtarma e-postasıyla hesabın kayıtlı adresine gider; istemciye ne kod
      // ne e-posta döner, yanıt hesabın var olup olmadığını da belli etmez
      const result = await requestPasswordReset(normalized);

      if (!result.ok) {
        setErrorMsg(
          result.code === "too_many_requests"
            ? t("auth.errors.tooManyAttemptsPolite")
            : t("auth.forgot.sendFailed")
        );
        return;
      }

      router.push({
        pathname: "/(auth)/reset-password",
        params: { identifier: normalized },
      });
    } catch (e) {
      setErrorMsg(t("errors.unexpected"));
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
          contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("a11y.back")}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(auth)/login");
              }
            }}
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
            {t("auth.forgot.title")}
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
            {t("auth.forgot.subtitle")}
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
            {t("auth.forgot.identifierLabel")}
          </Text>
          <TextInput
            value={identifier}
            onChangeText={setIdentifier}
            placeholder={t("auth.forgot.identifierPlaceholder")}
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
                  {t("auth.forgot.submit")}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
