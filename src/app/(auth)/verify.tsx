import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { navigateAfterAuth } from "@/lib/navigate";
import { registerForPushNotifications } from "@/lib/notifications";

const OTP_LENGTH = 6;

export default function VerifyScreen() {
  const params = useLocalSearchParams<{
    email?: string;
    token_hash?: string;
    type?: string;
  }>();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [autoVerified, setAutoVerified] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // ── Path B: Deep link auto-verify ────────────────────────────────────────
  useEffect(() => {
    if (params.token_hash && params.type && !autoVerified) {
      setAutoVerified(true);
      handleDeepLinkVerify(params.token_hash, params.type);
    }
  }, [params.token_hash]);

  async function handleDeepLinkVerify(token_hash: string, type: string) {
    setIsLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    });

    setIsLoading(false);

    if (error) {
      setErrorMsg(
        "Bağlantı geçersiz veya süresi dolmuş. Lütfen tekrar e-posta iste."
      );
      return;
    }

    if (data.user) {
      // Register push token silently after successful verification
      await registerForPushNotifications(data.user.id).catch(() => {});
      await routeUser(data.user.id);
    }
  }

  // ── Path A: Manual OTP input ──────────────────────────────────────────────

  function handleDigitChange(value: string, index: number) {
    // Only allow single digit
    const digit = value.replace(/[^0-9]/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setErrorMsg("");

    // Auto-advance focus
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits filled
    if (digit && index === OTP_LENGTH - 1) {
      const code = [...newDigits.slice(0, -1), digit].join("");
      if (code.length === OTP_LENGTH) {
        handleManualVerify(code);
      }
    }
  }

  function handleKeyPress(key: string, index: number) {
    if (key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleManualVerify(code?: string) {
    const otp = code ?? digits.join("");
    if (otp.length < OTP_LENGTH) {
      setErrorMsg("Lütfen 6 haneli kodu eksiksiz gir.");
      return;
    }
    if (!params.email) {
      setErrorMsg("E-posta bilgisi eksik. Lütfen tekrar dene.");
      return;
    }
    if (isLoading) return;

    setIsLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase.auth.verifyOtp({
      email: params.email,
      token: otp,
      type: "email",
    });

    setIsLoading(false);

    if (error) {
      setErrorMsg("Kod hatalı veya süresi dolmuş. Lütfen tekrar dene.");
      // Clear digits for retry
      setDigits(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
      return;
    }

    if (data.user) {
      await registerForPushNotifications(data.user.id).catch(() => {});
      await routeUser(data.user.id);
    }
  }

  async function routeUser(userId: string) {
    const { data: userData } = await supabase
      .from("users")
      .select("couple_id, couples(meet_date, relationship_start_date)")
      .eq("id", userId)
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

  async function handleResend() {
    if (!params.email) return;
    setIsLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: params.email,
      options: { emailRedirectTo: "couplesapp://verify" },
    });
    setIsLoading(false);
    if (error) {
      Alert.alert("Hata", "Kod gönderilemedi. Lütfen tekrar dene.");
    } else {
      Alert.alert("Gönderildi!", "Yeni doğrulama kodu e-postana gönderildi.");
    }
  }

  // ── Render: Auto-verify in progress ──────────────────────────────────────
  if (autoVerified && isLoading) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#080811" }}
      >
        <ActivityIndicator color="#E8002D" size="large" />
        <Text
          style={{ color: "rgba(255,255,255,0.6)", marginTop: 16, fontSize: 15 }}
        >
          Doğrulanıyor...
        </Text>
      </View>
    );
  }

  // ── Render: Manual OTP form ───────────────────────────────────────────────
  return (
    <LinearGradient colors={["#080811", "#0A0A0C", "#080811"]} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={{ flex: 1, justifyContent: "center", padding: 28 }}>
          {/* Header */}
          <View style={{ alignItems: "center", marginBottom: 40 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>📬</Text>
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 26,
                fontWeight: "800",
                textAlign: "center",
                marginBottom: 10,
              }}
            >
              E-postanı Doğrula
            </Text>
            {params.email ? (
              <Text
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 15,
                  textAlign: "center",
                  lineHeight: 22,
                }}
              >
                <Text style={{ color: "#E8002D" }}>{params.email}</Text>{" "}
                adresine gönderilen 6 haneli kodu gir.{"\n"}Ya da e-postadaki
                bağlantıya tıkla, otomatik doğrulanırsın.
              </Text>
            ) : (
              <Text
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 15,
                  textAlign: "center",
                }}
              >
                E-postanı kontrol et ve bağlantıya tıkla.
              </Text>
            )}
          </View>

          {/* OTP Boxes */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: 10,
              marginBottom: 28,
            }}
          >
            {digits.map((digit, i) => (
              <TextInput
                key={i}
                ref={(ref) => {
                  inputRefs.current[i] = ref;
                }}
                value={digit}
                onChangeText={(v) => handleDigitChange(v, i)}
                onKeyPress={({ nativeEvent: { key } }) =>
                  handleKeyPress(key, i)
                }
                maxLength={1}
                keyboardType="number-pad"
                selectTextOnFocus
                style={{
                  width: 48,
                  height: 58,
                  backgroundColor: "rgba(255,255,255,0.07)",
                  borderWidth: 1.5,
                  borderColor: digit
                    ? "#E8002D"
                    : "rgba(255,255,255,0.15)",
                  borderRadius: 14,
                  color: "#FFFFFF",
                  fontSize: 24,
                  fontWeight: "700",
                  textAlign: "center",
                }}
              />
            ))}
          </View>

          {/* Error */}
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

          {/* Submit */}
          <TouchableOpacity
            onPress={() => handleManualVerify()}
            disabled={isLoading || digits.join("").length < OTP_LENGTH}
            style={{
              backgroundColor:
                digits.join("").length < OTP_LENGTH
                  ? "rgba(232,0,45,0.3)"
                  : "#E8002D",
              paddingVertical: 18,
              borderRadius: 18,
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={{ color: "#fff", fontWeight: "800", fontSize: 17 }}
              >
                Doğrula
              </Text>
            )}
          </TouchableOpacity>

          {/* Resend */}
          {params.email && (
            <TouchableOpacity
              onPress={handleResend}
              style={{ alignItems: "center" }}
            >
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
                Kodu almadım —{" "}
                <Text style={{ color: "#E8002D" }}>Tekrar gönder</Text>
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
