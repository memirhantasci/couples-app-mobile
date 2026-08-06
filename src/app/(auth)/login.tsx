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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function getOrCreateDeviceId() {
  let deviceId = await AsyncStorage.getItem("device_id");
  if (!deviceId) {
    deviceId = generateUUID();
    await AsyncStorage.setItem("device_id", deviceId);
  }
  return deviceId;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Deterministic encrypt using web-compatible approach via Supabase RPC
// We call Supabase to handle crypto server-side since native crypto isn't
// available in dev client builds yet.
// For login: we let the server compare. For register: server inserts.

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
          <Text style={{ fontSize: 32, textAlign: "center", marginBottom: 16 }}>💌</Text>
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
            Partnerinden mektup geldiğinde veya özel bir gün yaklaştığında seni haberdar etmek istiyoruz. 🤍
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
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>İzin Ver</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onSkip} style={{ alignItems: "center" }}>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Şimdi değil</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

type Mode = "login" | "register";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<Mode>("login");

  // Login fields
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register fields
  const [regDisplayName, setRegDisplayName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regGender, setRegGender] = useState<"male" | "female">("female");
  const [regPairingCode, setRegPairingCode] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function clearErrors() {
    setErrorMsg("");
    setSuccessMsg("");
  }

  async function finishNavigation(userId: string) {
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

  async function handlePushAllow() {
    setShowPushModal(false);
    if (pendingUserId) {
      await registerForPushNotifications(pendingUserId);
    }
    if (pendingUserId) await finishNavigation(pendingUserId);
  }

  async function handlePushSkip() {
    setShowPushModal(false);
    if (pendingUserId) await finishNavigation(pendingUserId);
  }

  // ── Login Handler ──────────────────────────────────────────────────────────

  async function handleLogin() {
    clearErrors();
    if (!loginUsername.trim()) {
      setErrorMsg("Kullanıcı adı gerekli.");
      return;
    }
    if (!loginPassword.trim()) {
      setErrorMsg("Şifre gerekli.");
      return;
    }

    setIsLoading(true);
    try {
      const encryptedUsername = deterministicEncrypt(loginUsername.trim().toLowerCase());
      
      const { data: user, error } = await supabase
        .from("users")
        .select("id, password")
        .eq("username", encryptedUsername)
        .single();

      if (error || !user) {
        setErrorMsg("Kullanıcı adı veya şifre hatalı.");
        setIsLoading(false);
        return;
      }

      let isPasswordValid = false;
      if (user.password.startsWith("enc:")) {
        isPasswordValid = decrypt(user.password) === loginPassword.trim();
      } else {
        isPasswordValid = user.password === loginPassword.trim();
      }

      if (!isPasswordValid) {
        setErrorMsg("Kullanıcı adı veya şifre hatalı.");
        setIsLoading(false);
        return;
      }

      // Check device verification
      const deviceId = await getOrCreateDeviceId();
      const { data: deviceAuth } = await supabase
        .from("device_authorizations")
        .select("*")
        .eq("user_id", user.id)
        .eq("device_id", deviceId)
        .maybeSingle();

      if (!deviceAuth || !deviceAuth.is_authorized) {
        // Device not verified, need OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
        
        const { error: otpError } = await supabase.from("otp_codes").insert({
          user_id: user.id,
          code: otpCode,
          expires_at: expiresAt.toISOString(),
        });
        if (otpError) console.error("OTP INSERT ERROR:", otpError);
        
        if (!deviceAuth) {
           const { error: deviceError } = await supabase.from("device_authorizations").insert({
             user_id: user.id,
             device_id: deviceId,
             device_name: "Mobile Device",
             is_authorized: false
           });
           if (deviceError) console.error("DEVICE INSERT ERROR:", deviceError);
        }
        
        console.log("-----------------------------------------");
        console.log("OTP CODE (MOBILE LOGIN):", otpCode);
        console.log("-----------------------------------------");
        
        router.push({
          pathname: "/(auth)/verify-device",
          params: { userId: user.id.toString(), deviceId }
        });
        setIsLoading(false);
        return;
      }

      await signIn(user.id.toString());
      setPendingUserId(user.id.toString());
      setShowPushModal(true);
    } catch (e: any) {
      setErrorMsg("Beklenmedik bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Register Handler ───────────────────────────────────────────────────────

  async function handleRegister() {
    clearErrors();
    if (!regDisplayName.trim()) {
      setErrorMsg("Görünen isim gerekli.");
      return;
    }
    if (!regUsername.trim()) {
      setErrorMsg("Kullanıcı adı gerekli.");
      return;
    }
    if (!isValidEmail(regEmail)) {
      setErrorMsg("Geçerli bir e-posta adresi gir.");
      return;
    }
    if (!regPassword.trim()) {
      setErrorMsg("Şifre gerekli.");
      return;
    }

    setIsLoading(true);
    try {
      const encryptedUsername = deterministicEncrypt(regUsername.trim().toLowerCase());

      const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("username", encryptedUsername)
        .single();

      if (existing) {
        setErrorMsg("Bu kullanıcı adı zaten alınmış.");
        setIsLoading(false);
        return;
      }

      let coupleIdToAssign = null;
      if (regPairingCode) {
        const { data: coupleFound } = await supabase
          .from("couples")
          .select("id")
          .eq("pairing_code", regPairingCode.trim().toUpperCase())
          .single();
        if (!coupleFound) {
          setErrorMsg("Girdiğiniz eşleşme kodu geçersiz.");
          setIsLoading(false);
          return;
        }
        coupleIdToAssign = coupleFound.id;
      } else {
        const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const { data: newCouple } = await supabase
          .from("couples")
          .insert({ pairing_code: generatedCode })
          .select("id")
          .single();
        if (newCouple) coupleIdToAssign = newCouple.id;
      }

      const hashedPassword = encrypt(regPassword.trim());
      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert({
          display_name: regDisplayName.trim(),
          username: encryptedUsername,
          email: deterministicEncrypt(regEmail.trim().toLowerCase()),
          password: hashedPassword,
          role: "USER",
          gender: regGender,
          couple_id: coupleIdToAssign
        })
        .select("id");

      if (insertError || !newUser || newUser.length === 0) {
        setErrorMsg("Kayıt olurken bir hata oluştu: " + (insertError?.message || ""));
        setIsLoading(false);
        return;
      }

      await signIn(newUser[0].id.toString());
      setPendingUserId(newUser[0].id.toString());
      setShowPushModal(true);
    } catch (e: any) {
      setErrorMsg("Beklenmedik bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const inputStyle = {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: "#FFFFFF",
    fontSize: 16,
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
      <LinearGradient colors={["#080811", "#0A0A0C", "#080811"]} style={{ flex: 1 }}>
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
              paddingTop: 60,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={{ alignItems: "center", marginBottom: 40 }}>
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
                    clearErrors();
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

            {/* ── LOGIN FORM ── */}
            {mode === "login" && (
              <>
                <Text style={labelStyle}>Kullanıcı Adı</Text>
                <TextInput
                  value={loginUsername}
                  onChangeText={setLoginUsername}
                  placeholder="kullaniciadi"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={inputStyle}
                />

                <Text style={labelStyle}>Şifre</Text>
                <TextInput
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  placeholder="Şifreniz"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  secureTextEntry
                  style={inputStyle}
                />
              </>
            )}

            {/* ── REGISTER FORM ── */}
            {mode === "register" && (
              <>
                <Text style={labelStyle}>Görünen İsim</Text>
                <TextInput
                  value={regDisplayName}
                  onChangeText={setRegDisplayName}
                  placeholder="Adınız"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={inputStyle}
                />

                <Text style={labelStyle}>Kullanıcı Adı</Text>
                <TextInput
                  value={regUsername}
                  onChangeText={setRegUsername}
                  placeholder="kullaniciadi"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={inputStyle}
                />

                <Text style={labelStyle}>E-posta</Text>
                <TextInput
                  value={regEmail}
                  onChangeText={setRegEmail}
                  placeholder="ornek@mail.com"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={inputStyle}
                />

                <Text style={labelStyle}>Şifre</Text>
                <TextInput
                  value={regPassword}
                  onChangeText={setRegPassword}
                  placeholder="Şifreniz"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  secureTextEntry
                  style={inputStyle}
                />

                {/* Gender */}
                <Text style={labelStyle}>Cinsiyet</Text>
                <View style={{ flexDirection: "row", gap: 12, marginBottom: 14 }}>
                  {(["female", "male"] as const).map((g) => (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setRegGender(g)}
                      style={{
                        flex: 1,
                        paddingVertical: 14,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: regGender === g ? "#E8002D" : "rgba(255,255,255,0.12)",
                        backgroundColor:
                          regGender === g ? "rgba(232,0,45,0.2)" : "rgba(255,255,255,0.07)",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: regGender === g ? "#E8002D" : "rgba(255,255,255,0.7)",
                          fontWeight: "600",
                        }}
                      >
                        {g === "female" ? "Kadın" : "Erkek"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Pairing Code (optional) */}
                <Text style={labelStyle}>Eşleşme Kodu (Opsiyonel)</Text>
                <TextInput
                  value={regPairingCode}
                  onChangeText={setRegPairingCode}
                  placeholder="Partnerinin kodu (varsa gir)"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoCapitalize="characters"
                  style={inputStyle}
                />
              </>
            )}

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
                <Text style={{ color: "#FF4D6A", fontSize: 14, textAlign: "center" }}>
                  {errorMsg}
                </Text>
              </View>
            )}

            {/* Success */}
            {!!successMsg && (
              <View
                style={{
                  backgroundColor: "rgba(0,200,100,0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(0,200,100,0.3)",
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <Text style={{ color: "#00C864", fontSize: 14, textAlign: "center" }}>
                  {successMsg}
                </Text>
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              onPress={mode === "login" ? handleLogin : handleRegister}
              disabled={isLoading}
              style={{
                backgroundColor: isLoading ? "rgba(232,0,45,0.5)" : "#E8002D",
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
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 17 }}>
                  {mode === "login" ? "Giriş Yap" : "Kayıt Ol"}
                </Text>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>

      <PushPermissionModal
        visible={showPushModal}
        onAllow={handlePushAllow}
        onSkip={handlePushSkip}
      />
    </>
  );
}
