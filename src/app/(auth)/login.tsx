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
import { encrypt, decrypt, deterministicEncrypt } from "@/utils/crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "@/utils/logger";
import { Eye, EyeOff, Heart, Link } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}



// ─── Main Screen ─────────────────────────────────────────────────────────────

type Mode = "login" | "register";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"login" | "register">("login");

  // Login fields
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Register fields
  const [regDisplayName, setRegDisplayName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPass, setShowRegPass] = useState(false);
  const [regGender, setRegGender] = useState<"male" | "female">("female");
  const [regPairingCode, setRegPairingCode] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Brute Force
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_SECONDS = 30;

  function isLockedOut(): boolean {
    if (!lockedUntil) return false;
    if (Date.now() < lockedUntil) return true;
    setLockedUntil(null);
    setLoginAttempts(0);
    return false;
  }

  function registerFailedAttempt() {
    const newAttempts = loginAttempts + 1;
    setLoginAttempts(newAttempts);
    if (newAttempts >= MAX_ATTEMPTS) {
      setLockedUntil(Date.now() + LOCKOUT_SECONDS * 1000);
      setErrorMsg(`Çok fazla başarısız deneme. ${LOCKOUT_SECONDS} saniye bekle.`);
    }
  }

  function clearErrors() {
    setErrorMsg("");
    setSuccessMsg("");
  }

  async function handleLogin() {
    clearErrors();
    if (isLockedOut()) {
      const remaining = Math.ceil(((lockedUntil ?? 0) - Date.now()) / 1000);
      setErrorMsg(`Çok fazla başarısız deneme. ${remaining} saniye bekle.`);
      return;
    }
    if (!loginUsername.trim()) {
      setErrorMsg("Kullanıcı adı veya e-posta gerekli.");
      return;
    }
    if (!loginPassword.trim()) {
      setErrorMsg("Şifre gerekli.");
      return;
    }

    setIsLoading(true);
    try {
      let emailToUse = loginUsername.trim();
      const isEmail = emailToUse.includes("@");

      if (!isEmail) {
        const plainUsername = emailToUse.toLowerCase();
        const encryptedUsername = deterministicEncrypt(plainUsername);
        
        let { data: emailData, error: rpcError } = await supabase.rpc(
          "get_email_by_username",
          { p_username: encryptedUsername }
        );

        // Fallback for older test accounts that were registered before encryption was added
        if (!emailData && !rpcError) {
          const { data: fallbackData } = await supabase.rpc(
            "get_email_by_username",
            { p_username: plainUsername }
          );
          if (fallbackData) {
            emailData = fallbackData;
          }
        }

        if (rpcError || !emailData) {
          registerFailedAttempt();
          setErrorMsg("Bu kullanıcı adı bulunamadı.");
          setIsLoading(false);
          return;
        }

        emailToUse = emailData;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: loginPassword.trim(),
      });

      if (error) {
        registerFailedAttempt();
        if (error.message.includes("Email not confirmed")) {
          setErrorMsg("E-posta adresiniz henüz doğrulanmamış.");
          setTimeout(() => {
            router.push({
              pathname: "/(auth)/verify",
              params: { email: emailToUse },
            });
          }, 1500);
        } else {
          setErrorMsg("E-posta veya şifre hatalı.");
        }
        setIsLoading(false);
        return;
      }

      if (!data.user) {
        registerFailedAttempt();
        setErrorMsg("Giriş başarısız.");
        setIsLoading(false);
        return;
      }

      // --- Device Verification ---
      const userId = data.user.id;
      
      // 1. Get or generate a persistent device ID for this installation
      let deviceId = await AsyncStorage.getItem("device_id");
      if (!deviceId) {
        deviceId = generateUUID();
        await AsyncStorage.setItem("device_id", deviceId);
      }

      // 2. Check last logged in user on this device
      const lastUserId = await AsyncStorage.getItem("last_user_id");

      // 3. Check if this device is authorized for this user
      const { data: auths, error: authError } = await supabase
        .from("device_authorizations")
        .select("is_authorized")
        .eq("user_id", userId)
        .eq("device_id", deviceId)
        .maybeSingle();

      // If the account on the device changed, or it's not authorized, force OTP
      if (lastUserId !== userId || authError || !auths || !auths.is_authorized) {
        // Send OTP email
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: emailToUse,
        });

        if (otpError) {
          setErrorMsg("Cihaz doğrulama kodu gönderilemedi.");
          setIsLoading(false);
          return;
        }

        // Prevent useProtectedRoute from redirecting to home by signing out.
        // The user will sign back in fully upon verifying the OTP in verify-device.tsx
        await supabase.auth.signOut();

        setSuccessMsg("Yeni cihaz algılandı. Doğrulama kodu gönderildi.");
        setTimeout(() => {
          router.push({
            pathname: "/(auth)/verify-device",
            params: { userId, deviceId, email: emailToUse },
          });
        }, 1500);
        return;
      }

      setLoginAttempts(0);
      setLockedUntil(null);
    } catch (e: any) {
      setErrorMsg("Beklenmedik bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegister() {
    clearErrors();

    if (!regDisplayName.trim()) {
      setErrorMsg("Görünen isim gerekli.");
      return;
    }
    if (!regUsername.trim() || regUsername.length < 3) {
      setErrorMsg("Kullanıcı adı en az 3 karakter olmalı.");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(regUsername)) {
      setErrorMsg("Kullanıcı adı sadece harf, rakam ve _ içerebilir.");
      return;
    }
    if (!regEmail.trim() || !regEmail.includes("@")) {
      setErrorMsg("Geçerli bir e-posta girin.");
      return;
    }
    if (!regPassword.trim() || regPassword.length < 6) {
      setErrorMsg("Şifre en az 6 karakter olmalı.");
      return;
    }

    setIsLoading(true);
    try {
      const encryptedUsername = deterministicEncrypt(regUsername.trim().toLowerCase());

      const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("username", encryptedUsername)
        .maybeSingle();

      if (existing) {
        setErrorMsg("Bu kullanıcı adı zaten alınmış.");
        setIsLoading(false);
        return;
      }

      const encryptedDisplayName = encrypt(regDisplayName.trim());
      
      const { data, error } = await supabase.auth.signUp({
        email: regEmail.trim().toLowerCase(),
        password: regPassword.trim(),
        options: {
          data: {
            username: encryptedUsername,
            display_name: encryptedDisplayName,
            gender: regGender,
          }
        }
      });

      if (error) {
        if (error.message.includes("already registered")) {
          setErrorMsg("Bu e-posta zaten kayıtlı.");
        } else {
          setErrorMsg(error.message);
        }
        setIsLoading(false);
        return;
      }

      if (!data.user) {
        setErrorMsg("Kayıt başarısız.");
        setIsLoading(false);
        return;
      }

      // The user profile is automatically created in public.users via Supabase trigger

      if (regPairingCode.trim()) {
        await supabase.rpc("join_couple_by_code_uuid", {
          p_code: regPairingCode.trim().toUpperCase(),
        });
      }

      // If email confirmation is enabled in Supabase, session will be null
      if (!data.session) {
        setSuccessMsg("Kayıt başarılı! Doğrulama kodunuz gönderildi.");
        setTimeout(() => {
          router.push({
            pathname: "/(auth)/verify",
            params: { email: regEmail.trim().toLowerCase() },
          });
        }, 1500);
        return;
      }

      setSuccessMsg("Kayıt başarılı! Giriş yapılıyor...");

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: regEmail.trim().toLowerCase(),
        password: regPassword.trim(),
      });

      if (loginError) {
        setIsLoading(false);
        return;
      }

      let deviceId = await AsyncStorage.getItem("device_id");
      if (!deviceId) {
        deviceId = generateUUID();
        await AsyncStorage.setItem("device_id", deviceId);
      }

      await supabase.from("authorized_devices").upsert({
        user_id: data.user.id,
        device_id: deviceId,
      });

      setPendingUserId(data.user.id);
      setShowNotifModal(true);
    } catch (e: any) {
      setErrorMsg("Beklenmedik bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Gender & button accent ───────────────────────────────────────────────
  const isMale = regGender === "male";
  const registerAccent = isMale ? "#4D9CFF" : "#E8002D";
  const registerAccentGlow = isMale ? "#4D9CFF" : "#C0006B";

  // ─── Shared input style ──────────────────────────────────────────────────
  const inputStyle = {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 15,
    color: "#FFFFFF",
    fontSize: 15,
    marginBottom: 14,
  } as const;

  const labelStyle = {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    marginBottom: 6,
    marginLeft: 2,
  } as const;

  return (
    <>
      <LinearGradient
        colors={["#0A0A10", "#0D0D14", "#0A0A10"]}
        style={{ flex: 1 }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: 24,
              paddingTop: insets.top + 40,
              paddingBottom: 60,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ─── Header ─── */}
            <View style={{ alignItems: "center", marginBottom: 36 }}>
              {/* Heart Icon */}
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: "rgba(255,255,255,0.07)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <Heart
                  color="#E8002D"
                  size={28}
                  fill="#E8002D"
                />
              </View>

              {/* App Title */}
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 30,
                  fontFamily: "PlayfairDisplay_400Regular_Italic",
                  marginBottom: 8,
                }}
              >
                Couples App
              </Text>

              {/* Subtitle — changes per mode */}
              <Text
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: 14,
                  textAlign: "center",
                  lineHeight: 20,
                  paddingHorizontal: 16,
                }}
              >
                {mode === "login"
                  ? "Aşkınızı belgelemenin ve büyütmenin en romantik yolu."
                  : "Kendi dünyanızı kurmaya başlayın"}
              </Text>
            </View>

            {/* ─── Tab Toggle ─── */}
            <View
              style={{
                flexDirection: "row",
                backgroundColor: "rgba(255,255,255,0.06)",
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
                    clearErrors();
                  }}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    paddingVertical: 13,
                    borderRadius: 11,
                    alignItems: "center",
                    backgroundColor:
                      mode === m ? "#FFFFFF" : "transparent",
                  }}
                >
                  <Text
                    style={{
                      color: mode === m ? "#0A0A10" : "rgba(255,255,255,0.45)",
                      fontWeight: "700",
                      fontSize: 14,
                    }}
                  >
                    {m === "login" ? "Giriş Yap" : "Kayıt Ol"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ─── LOGIN FORM ─── */}
            {mode === "login" && (
              <>
                <Text style={labelStyle}>E-Posta / Kullanıcı Adı</Text>
                <TextInput
                  value={loginUsername}
                  onChangeText={setLoginUsername}
                  placeholder="ornek@gmail.com"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  style={inputStyle}
                />

                <Text style={labelStyle}>Şifre</Text>
                <View style={{ position: "relative", marginBottom: 10 }}>
                  <TextInput
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    secureTextEntry={!showLoginPass}
                    style={[inputStyle, { marginBottom: 0, paddingRight: 50 }]}
                  />
                  <TouchableOpacity
                    onPress={() => setShowLoginPass(!showLoginPass)}
                    style={{
                      position: "absolute",
                      right: 16,
                      top: 0,
                      bottom: 0,
                      justifyContent: "center",
                    }}
                  >
                    {showLoginPass
                      ? <EyeOff color="rgba(255,255,255,0.4)" size={20} />
                      : <Eye color="rgba(255,255,255,0.4)" size={20} />
                    }
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={() => router.push("/(auth)/forgot-password")}
                  style={{ alignSelf: "flex-end", marginBottom: 24, marginTop: 4 }}
                >
                  <Text style={{ color: "#FF4D6D", fontSize: 13, fontWeight: "600" }}>
                    Şifremi Unuttum?
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ─── REGISTER FORM ─── */}
            {mode === "register" && (
              <>
                <Text style={labelStyle}>Ad Soyad</Text>
                <TextInput
                  value={regDisplayName}
                  onChangeText={setRegDisplayName}
                  placeholder="Örn. Selin Yılmaz"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  style={inputStyle}
                />

                <Text style={labelStyle}>Kullanıcı Adı</Text>
                <TextInput
                  value={regUsername}
                  onChangeText={setRegUsername}
                  placeholder="seliny"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={inputStyle}
                />

                <Text style={labelStyle}>E-Posta</Text>
                <TextInput
                  value={regEmail}
                  onChangeText={setRegEmail}
                  placeholder="selin@gmail.com"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={inputStyle}
                />

                <Text style={labelStyle}>Şifre</Text>
                <View style={{ position: "relative", marginBottom: 14 }}>
                  <TextInput
                    value={regPassword}
                    onChangeText={setRegPassword}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    secureTextEntry={!showRegPass}
                    style={[inputStyle, { marginBottom: 0, paddingRight: 50 }]}
                  />
                  <TouchableOpacity
                    onPress={() => setShowRegPass(!showRegPass)}
                    style={{
                      position: "absolute",
                      right: 16,
                      top: 0,
                      bottom: 0,
                      justifyContent: "center",
                    }}
                  >
                    {showRegPass
                      ? <EyeOff color="rgba(255,255,255,0.4)" size={20} />
                      : <Eye color="rgba(255,255,255,0.4)" size={20} />
                    }
                  </TouchableOpacity>
                </View>

                {/* Gender */}
                <Text style={labelStyle}>Cinsiyetiniz</Text>
                <View style={{ flexDirection: "row", gap: 12, marginBottom: 14 }}>
                  {([
                    { val: "female" as const, label: "Kadın ♀", accent: "#E8002D", bg: "rgba(232,0,45,0.18)" },
                    { val: "male" as const, label: "Erkek ♂", accent: "#4D9CFF", bg: "rgba(77,156,255,0.18)" },
                  ]).map(({ val, label, accent, bg }) => (
                    <TouchableOpacity
                      key={val}
                      onPress={() => setRegGender(val)}
                      activeOpacity={0.8}
                      style={{
                        flex: 1,
                        paddingVertical: 14,
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: regGender === val ? accent : "rgba(255,255,255,0.1)",
                        backgroundColor: regGender === val ? bg : "rgba(255,255,255,0.04)",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: regGender === val ? accent : "rgba(255,255,255,0.5)",
                          fontWeight: "700",
                          fontSize: 14,
                        }}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Pairing Code */}
                <Text style={labelStyle}>Eşleşme Kodu (İsteğe Bağlı)</Text>
                <View style={{ position: "relative", marginBottom: 20 }}>
                  <TextInput
                    value={regPairingCode}
                    onChangeText={setRegPairingCode}
                    placeholder="X7Y9Z2"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    autoCapitalize="characters"
                    style={[inputStyle, { marginBottom: 0, paddingRight: 50 }]}
                  />
                  <View
                    style={{
                      position: "absolute",
                      right: 16,
                      top: 0,
                      bottom: 0,
                      justifyContent: "center",
                    }}
                  >
                    <Link color="rgba(255,255,255,0.3)" size={20} />
                  </View>
                </View>
              </>
            )}

            {/* ─── Error Banner ─── */}
            {!!errorMsg && (
              <View
                style={{
                  backgroundColor: "rgba(232,0,45,0.1)",
                  borderWidth: 1,
                  borderColor: "rgba(232,0,45,0.3)",
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <Text style={{ color: "#FF4D6A", fontSize: 14, textAlign: "center" }}>
                  {errorMsg}
                </Text>
              </View>
            )}

            {/* ─── Success Banner ─── */}
            {!!successMsg && (
              <View
                style={{
                  backgroundColor: "rgba(0,200,100,0.1)",
                  borderWidth: 1,
                  borderColor: "rgba(0,200,100,0.3)",
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <Text style={{ color: "#00C864", fontSize: 14, textAlign: "center" }}>
                  {successMsg}
                </Text>
              </View>
            )}

            {/* ─── CTA Button ─── */}
            <TouchableOpacity
              onPress={mode === "login" ? handleLogin : handleRegister}
              disabled={isLoading}
              activeOpacity={0.85}
              style={{ borderRadius: 30, overflow: "hidden", opacity: isLoading ? 0.7 : 1 }}
            >
              <LinearGradient
                colors={
                  mode === "register" && isMale
                    ? ["#4D9CFF", "#1B6FD8"]
                    : ["#E8002D", "#C0006B"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingVertical: 18,
                  alignItems: "center",
                  borderRadius: 30,
                }}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 17 }}>
                    {mode === "login" ? "Giriş Yap" : "Kayıt Ol"}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </>
  );
}
