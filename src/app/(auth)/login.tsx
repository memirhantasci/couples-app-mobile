import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { navigateAfterAuth } from "@/lib/navigate";
import { registerForPushNotifications } from "@/lib/notifications";
import { useAuth } from "@/context/AuthContext";

// ─── Türkçe hata mesajları ───────────────────────────────────────────────────

function translateError(msg: string): string {
  if (msg.includes("Invalid login credentials"))
    return "E-posta veya şifre hatalı. Lütfen tekrar dene.";
  if (msg.includes("User already registered"))
    return "Bu e-posta adresi zaten kayıtlı. Giriş yapmayı dene.";
  if (msg.includes("Email not confirmed"))
    return "E-posta adresin henüz doğrulanmamış. Gelen kutunu kontrol et.";
  if (msg.includes("Password should be at least"))
    return "Şifren en az 6 karakter olmalı.";
  if (msg.includes("rate limit") || msg.includes("Too many requests"))
    return "Çok fazla deneme yaptın. Lütfen birkaç dakika bekle.";
  if (msg.includes("Unable to validate email address"))
    return "Geçersiz e-posta adresi.";
  return "Bir hata oluştu. Lütfen tekrar dene.";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ─── Push Permission Modal ────────────────────────────────────────────────────

function PushPermissionModal({
  visible,
  onAllow,
  onSkip,
}: {
  visible: boolean;
  onAllow: () => void;
  onSkip: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.7)",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: "#1C1C1E",
            borderRadius: 24,
            padding: 28,
            width: "100%",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.1)",
          }}
        >
          <Text
            style={{
              fontSize: 32,
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            💌
          </Text>
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 20,
              fontWeight: "700",
              textAlign: "center",
              marginBottom: 10,
            }}
          >
            Haberdar ol
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: 15,
              textAlign: "center",
              lineHeight: 22,
              marginBottom: 28,
            }}
          >
            Partnerinden mektup geldiğinde veya özel bir gün yaklaştığında
            seni haberdar etmek istiyoruz. 🤍
          </Text>

          <TouchableOpacity
            onPress={onAllow}
            style={{
              backgroundColor: "#E8002D",
              paddingVertical: 16,
              borderRadius: 16,
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              İzin Ver
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onSkip} style={{ alignItems: "center" }}>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
              Şimdi değil
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

type Mode = "login" | "register";

export default function LoginScreen() {
  const { refreshProfile } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  function validateInputs(): boolean {
    let valid = true;
    setEmailError("");
    setPasswordError("");
    setErrorMsg("");

    if (!isValidEmail(email)) {
      setEmailError("Geçerli bir e-posta adresi gir.");
      valid = false;
    }
    if (password.length < 6) {
      setPasswordError("Şifren en az 6 karakter olmalı.");
      valid = false;
    }
    return valid;
  }

  async function handlePushFlowAndNavigate(userId: string) {
    await refreshProfile();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const profile = session
      ? {
          isPaired: false,
          hasDates: false,
          coupleId: null,
          meetDate: null,
          relationshipStartDate: null,
        }
      : null;
    // Show push modal — non-blocking gate before navigating
    setPendingUserId(userId);
    setShowPushModal(true);
  }

  async function handlePushAllow() {
    setShowPushModal(false);
    if (pendingUserId) {
      await registerForPushNotifications(pendingUserId);
    }
    await finishNavigation();
  }

  async function handlePushSkip() {
    setShowPushModal(false);
    await finishNavigation();
  }

  async function finishNavigation() {
    await refreshProfile();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/(auth)/login");
      return;
    }

    // Fetch couple profile for routing decision
    const { data: userData } = await supabase
      .from("users")
      .select("couple_id, couples(meet_date, relationship_start_date)")
      .eq("id", session.user.id)
      .single();

    const couple = Array.isArray(userData?.couples)
      ? userData?.couples[0]
      : userData?.couples;

    navigateAfterAuth({
      coupleId: userData?.couple_id ?? null,
      meetDate: couple?.meet_date ?? null,
      relationshipStartDate: couple?.relationship_start_date ?? null,
      isPaired: !!userData?.couple_id,
      hasDates: !!(couple?.meet_date && couple?.relationship_start_date),
    });
  }

  async function handleSubmit() {
    if (!validateInputs() || isLoading) return;
    setIsLoading(true);
    setErrorMsg("");

    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          setErrorMsg(translateError(error.message));
          return;
        }
        if (data.user) {
          await handlePushFlowAndNavigate(data.user.id);
        }
      } else {
        // Register
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: "couplesapp://verify",
          },
        });
        if (error) {
          setErrorMsg(translateError(error.message));
          return;
        }
        // If email confirmation is required, go to verify screen
        if (data.user && !data.session) {
          router.push({ pathname: "/(auth)/verify", params: { email } });
        } else if (data.user) {
          await handlePushFlowAndNavigate(data.user.id);
        }
      }
    } catch {
      setErrorMsg("Beklenmedik bir hata oluştu. Lütfen tekrar dene.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!isValidEmail(email)) {
      setEmailError("Şifre sıfırlama için önce geçerli bir e-posta gir.");
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: "couplesapp://reset-password",
    });
    setIsLoading(false);
    if (error) {
      setErrorMsg(translateError(error.message));
    } else {
      setErrorMsg(""); // clear
      alert("Şifre sıfırlama bağlantısı e-postana gönderildi! 📬");
    }
  }

  return (
    <>
      <LinearGradient
        colors={["#080811", "#0A0A0C", "#080811"]}
        style={{ flex: 1 }}
      >
        {/* Background glow */}
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
              justifyContent: "center",
              padding: 24,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={{ alignItems: "center", marginBottom: 48 }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>💑</Text>
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 28,
                  fontWeight: "800",
                  letterSpacing: -0.5,
                }}
              >
                Couples App
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 15,
                  marginTop: 6,
                }}
              >
                Birlikte daha güzel ✨
              </Text>
            </View>

            {/* Tab Toggle */}
            <View
              style={{
                flexDirection: "row",
                backgroundColor: "#1C1C1E",
                borderRadius: 14,
                padding: 4,
                marginBottom: 28,
              }}
            >
              {(["login", "register"] as Mode[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => {
                    setMode(m);
                    setErrorMsg("");
                    setEmailError("");
                    setPasswordError("");
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 11,
                    alignItems: "center",
                    backgroundColor: mode === m ? "#E8002D" : "transparent",
                  }}
                >
                  <Text
                    style={{
                      color: mode === m ? "#fff" : "rgba(255,255,255,0.5)",
                      fontWeight: "700",
                      fontSize: 15,
                    }}
                  >
                    {m === "login" ? "Giriş Yap" : "Kayıt Ol"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Email Input */}
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 13,
                  marginBottom: 6,
                  marginLeft: 4,
                }}
              >
                E-posta
              </Text>
              <TextInput
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (emailError) setEmailError("");
                }}
                placeholder="ornek@mail.com"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  backgroundColor: "rgba(255,255,255,0.07)",
                  borderWidth: 1,
                  borderColor: emailError
                    ? "#E8002D"
                    : "rgba(255,255,255,0.12)",
                  borderRadius: 16,
                  paddingHorizontal: 18,
                  paddingVertical: 16,
                  color: "#FFFFFF",
                  fontSize: 16,
                }}
              />
              {!!emailError && (
                <Text
                  style={{
                    color: "#FF4D6A",
                    fontSize: 12,
                    marginTop: 4,
                    marginLeft: 4,
                  }}
                >
                  {emailError}
                </Text>
              )}
            </View>

            {/* Password Input */}
            <View style={{ marginBottom: 8 }}>
              <Text
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 13,
                  marginBottom: 6,
                  marginLeft: 4,
                }}
              >
                Şifre
              </Text>
              <TextInput
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (passwordError) setPasswordError("");
                }}
                placeholder="En az 6 karakter"
                placeholderTextColor="rgba(255,255,255,0.3)"
                secureTextEntry
                style={{
                  backgroundColor: "rgba(255,255,255,0.07)",
                  borderWidth: 1,
                  borderColor: passwordError
                    ? "#E8002D"
                    : "rgba(255,255,255,0.12)",
                  borderRadius: 16,
                  paddingHorizontal: 18,
                  paddingVertical: 16,
                  color: "#FFFFFF",
                  fontSize: 16,
                }}
              />
              {!!passwordError && (
                <Text
                  style={{
                    color: "#FF4D6A",
                    fontSize: 12,
                    marginTop: 4,
                    marginLeft: 4,
                  }}
                >
                  {passwordError}
                </Text>
              )}
            </View>

            {/* Forgot Password */}
            {mode === "login" && (
              <TouchableOpacity
                onPress={handleForgotPassword}
                style={{ alignSelf: "flex-end", marginBottom: 24 }}
              >
                <Text style={{ color: "#E8002D", fontSize: 13 }}>
                  Şifremi unuttum
                </Text>
              </TouchableOpacity>
            )}
            {mode !== "login" && <View style={{ marginBottom: 24 }} />}

            {/* General Error */}
            {!!errorMsg && (
              <View
                style={{
                  backgroundColor: "rgba(232,0,45,0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(232,0,45,0.3)",
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <Text
                  style={{
                    color: "#FF4D6A",
                    fontSize: 14,
                    textAlign: "center",
                  }}
                >
                  {errorMsg}
                </Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isLoading}
              style={{
                backgroundColor: isLoading
                  ? "rgba(232,0,45,0.5)"
                  : "#E8002D",
                paddingVertical: 18,
                borderRadius: 18,
                alignItems: "center",
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
                <Text
                  style={{ color: "#fff", fontWeight: "800", fontSize: 17 }}
                >
                  {mode === "login" ? "Giriş Yap" : "Kayıt Ol"}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>

      {/* Push Notification Permission Modal */}
      <PushPermissionModal
        visible={showPushModal}
        onAllow={handlePushAllow}
        onSkip={handlePushSkip}
      />
    </>
  );
}
