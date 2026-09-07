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
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { navigateAfterAuth } from "@/lib/navigate";
import { registerForPushNotifications } from "@/lib/notifications";
import { useAuth } from "@/context/AuthContext";
import { encrypt, decrypt, deterministicEncrypt } from "@/utils/crypto";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { logger } from "@/utils/logger";
import { 
  Eye, EyeOff, Heart, Link, 
  AtSign, Lock, User, Mail, 
  AlertCircle, CheckCircle2, ArrowRight, Check,
  Sparkles 
} from "lucide-react-native";
import { getOrCreateDeviceId } from "@/utils/device";
import { LegalModal } from "@/components/legal/LegalModal";
import { LegalDocType } from "@/constants/legalTexts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Main Screen ─────────────────────────────────────────────────────────────

type Mode = "login" | "register";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { initialMode, inviteCode } = useLocalSearchParams<{ initialMode?: string; inviteCode?: string }>();
  const { setIsDeviceAuthorized, enterDemoMode } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(
    initialMode === "register" || !!inviteCode ? "register" : "login"
  );
  const [activeInviteCode, setActiveInviteCode] = useState<string | null>(inviteCode || null);

  React.useEffect(() => {
    async function loadInviteCode() {
      const stored = await AsyncStorage.getItem("@pending_invite_code");
      const effectiveCode = (inviteCode || stored || "").trim().toUpperCase();
      if (effectiveCode) {
        setActiveInviteCode(effectiveCode);
        setRegPairingCode(effectiveCode);
        setMode("register");
        await AsyncStorage.setItem("@pending_invite_code", effectiveCode);
      }
    }
    loadInviteCode();
  }, [inviteCode]);

  React.useEffect(() => {
    if (initialMode === "register" || activeInviteCode) setMode("register");
    else if (initialMode === "login") setMode("login");
  }, [initialMode, activeInviteCode]);

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

  // Legal Consent & Modal States
  const [regAgreeTerms, setRegAgreeTerms] = useState(false);
  const [regAgreeKvkk, setRegAgreeKvkk] = useState(false);
  const [attemptedRegister, setAttemptedRegister] = useState(false);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [selectedLegalDoc, setSelectedLegalDoc] = useState<LegalDocType>("kvkk");

  function openLegalDoc(doc: LegalDocType) {
    setSelectedLegalDoc(doc);
    setLegalModalVisible(true);
  }

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

  function handleEnterDemo() {
    enterDemoMode();
    router.replace("/(tabs)/home");
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
      const deviceId = await getOrCreateDeviceId();
      const lastUserId = await AsyncStorage.getItem("last_user_id");

      const { data: auths, error: authError } = await supabase
        .from("device_authorizations")
        .select("is_authorized")
        .eq("user_id", userId)
        .eq("device_id", deviceId)
        .maybeSingle();

      const isAuthorized = (lastUserId === userId) && !authError && !!auths?.is_authorized;

      if (!isAuthorized) {
        // Send OTP email while spinner is active on the login button
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: emailToUse,
        });

        if (otpError) {
          setErrorMsg("Cihaz doğrulama kodu gönderilemedi: " + otpError.message);
          setIsLoading(false);
          return;
        }

        setIsDeviceAuthorized(false);

        // Direct, single transition to verify-device with full params
        router.replace({
          pathname: "/(auth)/verify-device",
          params: { userId, deviceId, email: emailToUse },
        });
        return;
      }

      // Device is authorized!
      setIsDeviceAuthorized(true);
      await AsyncStorage.setItem("last_user_id", userId);
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

    if (!regAgreeTerms) {
      setAttemptedRegister(true);
      setErrorMsg("Kayıt olmak için Kullanım Koşulları ve Gizlilik Politikası'nı onaylamanız gerekmektedir.");
      return;
    }

    if (!regAgreeKvkk) {
      setAttemptedRegister(true);
      setErrorMsg("Kayıt olmak için KVKK Aydınlatma Metni ve Açık Rıza şartlarını onaylamanız gerekmektedir.");
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
          emailRedirectTo: "couplesapp://verify",
          data: {
            username: encryptedUsername,
            display_name: encryptedDisplayName,
            gender: regGender,
          }
        }
      });

      if (error) {
        if (
          error.message.includes("already registered") ||
          error.message.includes("Database error saving new user") ||
          error.message.includes("unique")
        ) {
          setErrorMsg("Bu e-posta veya kullanıcı adı zaten kullanımda. Lütfen giriş yapın.");
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

      // Supabase Kuralı: Eğer e-posta zaten kayıtlıysa, Supabase identities: [] döner ve güvenlik sebebiyle mail GÖNDERMEZ!
      const isAlreadyRegistered = Array.isArray(data.user.identities) && data.user.identities.length === 0;

      if (isAlreadyRegistered) {
        // Bu e-posta zaten kayıtlı! Kullanıcıya yeni onay maili göndermek için resend tetikliyoruz:
        const { error: resendErr } = await supabase.auth.resend({
          type: "signup",
          email: regEmail.trim().toLowerCase(),
          options: { emailRedirectTo: "couplesapp://verify" },
        });

        if (resendErr && resendErr.message.toLowerCase().includes("already confirmed")) {
          setErrorMsg("Bu e-posta adresi zaten kayıtlı ve onaylanmış! Lütfen Giriş Yap sekmesini kullanın.");
          setIsLoading(false);
          return;
        }

        setSuccessMsg("Bu e-posta zaten kayıtlı. Doğrulama kodunuz tekrar gönderildi!");
        setTimeout(() => {
          router.push({
            pathname: "/(auth)/verify",
            params: { 
              email: regEmail.trim().toLowerCase(),
              inviteCode: cleanPairingCode || undefined
            },
          });
        }, 1200);
        return;
      }

      // The user profile is automatically created in public.users via Supabase trigger

      const cleanPairingCode = regPairingCode.trim().toUpperCase() || activeInviteCode?.trim().toUpperCase() || "";
      if (cleanPairingCode) {
        await AsyncStorage.setItem("@pending_invite_code", cleanPairingCode);
      }

      // If email confirmation is enabled in Supabase, session will be null
      if (!data.session) {
        setSuccessMsg("Kayıt başarılı! Doğrulama kodunuz gönderildi.");
        setTimeout(() => {
          router.push({
            pathname: "/(auth)/verify",
            params: { 
              email: regEmail.trim().toLowerCase(),
              inviteCode: cleanPairingCode || undefined
            },
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

      const deviceId = await getOrCreateDeviceId();

      await supabase.from("device_authorizations").upsert({
        user_id: data.user.id,
        device_id: deviceId,
        is_authorized: true,
      });

      await AsyncStorage.setItem("last_user_id", data.user.id);
      setIsDeviceAuthorized(true);
    } catch (e: any) {
      setErrorMsg("Beklenmedik bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Gender & button accent ───────────────────────────────────────────────
  const isMale = regGender === "male";
  const activeAccent = mode === "register" && isMale ? "#4D9CFF" : "#FF4D6D";
  const activeGradient = mode === "register" && isMale
    ? (["#4D9CFF", "#1B6FD8"] as const)
    : (["#FF3366", "#E8002D", "#C0006B"] as const);

  return (
    <LinearGradient
      colors={["#080811", "#0F0B18", "#080811"]}
      style={styles.container}
    >
      {/* Ambient Glows */}
      <View style={styles.topAmbientGlow} pointerEvents="none" />
      <View 
        style={[
          styles.bottomAmbientGlow, 
          { backgroundColor: mode === "register" && isMale ? "rgba(77, 156, 255, 0.12)" : "rgba(255, 77, 109, 0.12)" }
        ]} 
        pointerEvents="none" 
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 32,
              paddingBottom: insets.bottom + 40,
            }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Modern Hero Header ─── */}
          <View style={styles.heroSection}>
            <View style={[styles.heroIconWrapper, { borderColor: `${activeAccent}40` }]}>
              <LinearGradient
                colors={[`${activeAccent}33`, `${activeAccent}10`]}
                style={styles.heroIconGradient}
              >
                <Heart
                  color={activeAccent}
                  size={30}
                  fill={activeAccent}
                />
              </LinearGradient>
            </View>

            <Text style={styles.heroTitle}>Couples App</Text>
            <Text style={styles.heroSubtitle}>
              {mode === "login"
                ? "Aşkınızı belgelemenin ve büyütmenin en romantik yolu."
                : "Birlikte unutulmaz anılar biriktirmek için ilk adımı atın."}
            </Text>
          </View>

          {/* ─── Modern Segmented Toggle ─── */}
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              onPress={() => {
                setMode("login");
                clearErrors();
              }}
              activeOpacity={0.8}
              style={[
                styles.segmentBtn,
                mode === "login" && styles.segmentBtnActive
              ]}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  mode === "login" && styles.segmentBtnTextActive
                ]}
              >
                Giriş Yap
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setMode("register");
                clearErrors();
              }}
              activeOpacity={0.8}
              style={[
                styles.segmentBtn,
                mode === "register" && styles.segmentBtnActive
              ]}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  mode === "register" && styles.segmentBtnTextActive
                ]}
              >
                Kayıt Ol
              </Text>
            </TouchableOpacity>
          </View>

          {/* ─── LOGIN FORM ─── */}
          {mode === "login" && (
            <View style={styles.formContainer}>
              {/* E-Posta / Kullanıcı Adı */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>E-POSTA VEYA KULLANICI ADI</Text>
                <View style={styles.inputBox}>
                  <View style={styles.inputIconBox}>
                    <AtSign size={18} color="rgba(255,255,255,0.45)" />
                  </View>
                  <TextInput
                    value={loginUsername}
                    onChangeText={setLoginUsername}
                    placeholder="ornek@gmail.com veya kullanıcı adı"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    selectionColor={activeAccent}
                    style={styles.textInputField}
                  />
                </View>
              </View>

              {/* Şifre */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>ŞİFRE</Text>
                <View style={styles.inputBox}>
                  <View style={styles.inputIconBox}>
                    <Lock size={18} color="rgba(255,255,255,0.45)" />
                  </View>
                  <TextInput
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    secureTextEntry={!showLoginPass}
                    selectionColor={activeAccent}
                    style={styles.textInputField}
                  />
                  <TouchableOpacity
                    onPress={() => setShowLoginPass(!showLoginPass)}
                    style={styles.eyeBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {showLoginPass ? (
                      <EyeOff color="rgba(255,255,255,0.45)" size={19} />
                    ) : (
                      <Eye color="rgba(255,255,255,0.45)" size={19} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Şifremi Unuttum */}
              <TouchableOpacity
                onPress={() => router.push("/(auth)/forgot-password")}
                style={styles.forgotBtn}
                activeOpacity={0.7}
              >
                <Text style={[styles.forgotText, { color: activeAccent }]}>
                  Şifremi Unuttum?
                </Text>
              </TouchableOpacity>

              {/* Giriş Modu Yasal Bilgilendirme */}
              <View style={styles.loginLegalNotice}>
                <Text style={styles.loginLegalText}>
                  Giriş yaparak{" "}
                  <Text
                    style={[styles.legalLink, { color: activeAccent }]}
                    onPress={() => openLegalDoc("terms")}
                  >
                    Kullanım Koşulları
                  </Text>
                  {", "}
                  <Text
                    style={[styles.legalLink, { color: activeAccent }]}
                    onPress={() => openLegalDoc("privacy")}
                  >
                    Gizlilik Politikası
                  </Text>
                  {" ve "}
                  <Text
                    style={[styles.legalLink, { color: activeAccent }]}
                    onPress={() => openLegalDoc("kvkk")}
                  >
                    KVKK Metni
                  </Text>
                  'ni kabul etmiş sayılırsınız.
                </Text>
              </View>
            </View>
          )}

          {/* ─── REGISTER FORM ─── */}
          {mode === "register" && (
            <View style={styles.formContainer}>
              {/* Sevgilinin Daveti Rozeti */}
              {activeInviteCode ? (
                <View style={styles.inviteBannerCard}>
                  <View style={styles.inviteBannerIconCircle}>
                    <Heart size={16} color="#FF2E63" fill="#FF2E63" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inviteBannerTitle}>Sevgilinin Davetiyle Katılıyorsun 💕</Text>
                    <Text style={styles.inviteBannerSub}>
                      Eşleşme kodun ({activeInviteCode}) otomatik tanımlandı. Kayıt tamamlandığında kod girmene gerek kalmadan doğrudan sevgilinle eşleşeceksin!
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Ad Soyad */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>AD SOYAD</Text>
                <View style={styles.inputBox}>
                  <View style={styles.inputIconBox}>
                    <User size={18} color="rgba(255,255,255,0.45)" />
                  </View>
                  <TextInput
                    value={regDisplayName}
                    onChangeText={setRegDisplayName}
                    placeholder="Örn. Selin Yılmaz"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    selectionColor={activeAccent}
                    style={styles.textInputField}
                  />
                </View>
              </View>

              {/* Kullanıcı Adı */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>KULLANICI ADI</Text>
                <View style={styles.inputBox}>
                  <View style={styles.inputIconBox}>
                    <AtSign size={18} color="rgba(255,255,255,0.45)" />
                  </View>
                  <TextInput
                    value={regUsername}
                    onChangeText={setRegUsername}
                    placeholder="seliny"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    selectionColor={activeAccent}
                    style={styles.textInputField}
                  />
                </View>
              </View>

              {/* E-Posta */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>E-POSTA</Text>
                <View style={styles.inputBox}>
                  <View style={styles.inputIconBox}>
                    <Mail size={18} color="rgba(255,255,255,0.45)" />
                  </View>
                  <TextInput
                    value={regEmail}
                    onChangeText={setRegEmail}
                    placeholder="selin@gmail.com"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    selectionColor={activeAccent}
                    style={styles.textInputField}
                  />
                </View>
              </View>

              {/* Şifre */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>ŞİFRE</Text>
                <View style={styles.inputBox}>
                  <View style={styles.inputIconBox}>
                    <Lock size={18} color="rgba(255,255,255,0.45)" />
                  </View>
                  <TextInput
                    value={regPassword}
                    onChangeText={setRegPassword}
                    placeholder="En az 6 karakter"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    secureTextEntry={!showRegPass}
                    selectionColor={activeAccent}
                    style={styles.textInputField}
                  />
                  <TouchableOpacity
                    onPress={() => setShowRegPass(!showRegPass)}
                    style={styles.eyeBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {showRegPass ? (
                      <EyeOff color="rgba(255,255,255,0.45)" size={19} />
                    ) : (
                      <Eye color="rgba(255,255,255,0.45)" size={19} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Cinsiyet Seçimi */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>CİNSİYETİNİZ</Text>
                <View style={styles.genderRow}>
                  {([
                    { val: "female" as const, label: "Kadın ♀", color: "#FF4D6D", bg: "rgba(255, 77, 109, 0.14)" },
                    { val: "male" as const, label: "Erkek ♂", color: "#4D9CFF", bg: "rgba(77, 156, 255, 0.14)" },
                  ]).map(({ val, label, color, bg }) => {
                    const isSelected = regGender === val;
                    return (
                      <TouchableOpacity
                        key={val}
                        onPress={() => setRegGender(val)}
                        activeOpacity={0.8}
                        style={[
                          styles.genderCard,
                          isSelected && {
                            borderColor: color,
                            backgroundColor: bg,
                            borderWidth: 1.5,
                          }
                        ]}
                      >
                        <Text
                          style={[
                            styles.genderLabel,
                            isSelected && { color: "#FFFFFF", fontFamily: "Inter_700Bold" }
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Eşleşme Kodu */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>EŞLEŞME KODU (İSTEĞE BAĞLI)</Text>
                <View style={styles.inputBox}>
                  <View style={styles.inputIconBox}>
                    <Link size={18} color="rgba(255,255,255,0.45)" />
                  </View>
                  <TextInput
                    value={regPairingCode}
                    onChangeText={setRegPairingCode}
                    placeholder="Örn. X7Y9Z2"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    autoCapitalize="characters"
                    selectionColor={activeAccent}
                    style={styles.textInputField}
                  />
                </View>
              </View>

              {/* KVKK & Kullanım Koşulları Onay Kutuları */}
              <View style={styles.legalSection}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setRegAgreeTerms(!regAgreeTerms)}
                  style={[
                    styles.checkboxRow,
                    attemptedRegister && !regAgreeTerms && styles.checkboxRowError,
                  ]}
                >
                  <View
                    style={[
                      styles.checkboxBox,
                      regAgreeTerms && { backgroundColor: activeAccent, borderColor: activeAccent },
                    ]}
                  >
                    {regAgreeTerms && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                  <View style={styles.checkboxTextContainer}>
                    <Text style={styles.checkboxLabel}>
                      <Text
                        style={[styles.legalLink, { color: activeAccent }]}
                        onPress={() => openLegalDoc("terms")}
                      >
                        Kullanım Koşulları
                      </Text>
                      {" ve "}
                      <Text
                        style={[styles.legalLink, { color: activeAccent }]}
                        onPress={() => openLegalDoc("privacy")}
                      >
                        Gizlilik Politikası
                      </Text>
                      {"'nı okudum, kabul ediyorum."}
                      <Text style={{ color: activeAccent }}> *</Text>
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setRegAgreeKvkk(!regAgreeKvkk)}
                  style={[
                    styles.checkboxRow,
                    attemptedRegister && !regAgreeKvkk && styles.checkboxRowError,
                  ]}
                >
                  <View
                    style={[
                      styles.checkboxBox,
                      regAgreeKvkk && { backgroundColor: activeAccent, borderColor: activeAccent },
                    ]}
                  >
                    {regAgreeKvkk && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                  <View style={styles.checkboxTextContainer}>
                    <Text style={styles.checkboxLabel}>
                      <Text
                        style={[styles.legalLink, { color: activeAccent }]}
                        onPress={() => openLegalDoc("kvkk")}
                      >
                        KVKK Aydınlatma Metni
                      </Text>
                      {" ve "}
                      <Text
                        style={[styles.legalLink, { color: activeAccent }]}
                        onPress={() => openLegalDoc("consent")}
                      >
                        Açık Rıza Metni
                      </Text>
                      {" kapsamında verilerimin işlenmesini onaylıyorum."}
                      <Text style={{ color: activeAccent }}> *</Text>
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ─── Hata Bildirimi ─── */}
          {!!errorMsg && (
            <View style={styles.errorBanner}>
              <AlertCircle size={18} color="#FF4D6A" />
              <Text style={styles.errorBannerText}>{errorMsg}</Text>
            </View>
          )}

          {/* ─── Başarı Bildirimi ─── */}
          {!!successMsg && (
            <View style={styles.successBanner}>
              <CheckCircle2 size={18} color="#00C864" />
              <Text style={styles.successBannerText}>{successMsg}</Text>
            </View>
          )}

          {/* ─── Modern CTA Butonu ─── */}
          <TouchableOpacity
            onPress={mode === "login" ? handleLogin : handleRegister}
            disabled={isLoading}
            activeOpacity={0.88}
            style={styles.ctaWrapper}
          >
            <LinearGradient
              colors={activeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <View style={styles.ctaContentRow}>
                  <Text style={styles.ctaText}>
                    {mode === "login" ? "Giriş Yap" : "Hesap Oluştur"}
                  </Text>
                  <ArrowRight size={18} color="#ffffff" />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* ─── Demo / Keşfet Modu Butonu ─── */}
          <View style={styles.demoDividerContainer}>
            <View style={styles.demoDividerLine} />
            <Text style={styles.demoDividerText}>VEYA</Text>
            <View style={styles.demoDividerLine} />
          </View>

          <TouchableOpacity
            onPress={handleEnterDemo}
            activeOpacity={0.85}
            style={[styles.demoModeBtn, { borderColor: `${activeAccent}44` }]}
          >
            <Sparkles size={16} color={activeAccent} style={{ marginRight: 8 }} />
            <Text style={[styles.demoModeBtnText, { color: activeAccent }]}>
              Uygulamayı Keşfet (Demo Modu)
            </Text>
            <ArrowRight size={15} color={activeAccent} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <LegalModal
        visible={legalModalVisible}
        onClose={() => setLegalModalVisible(false)}
        initialDoc={selectedLegalDoc}
        accentColor={activeAccent}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topAmbientGlow: {
    position: "absolute",
    top: -120,
    alignSelf: "center",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(255, 77, 109, 0.1)",
  },
  bottomAmbientGlow: {
    position: "absolute",
    bottom: -100,
    alignSelf: "center",
    width: 340,
    height: 340,
    borderRadius: 170,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 28,
  },
  heroIconWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  heroIconGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 13.5,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 20,
  },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 4,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentBtnActive: {
    backgroundColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  segmentBtnText: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  segmentBtnTextActive: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
  },
  formContainer: {
    gap: 16,
    marginBottom: 20,
  },
  inputGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    marginLeft: 2,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    height: 52,
    paddingHorizontal: 14,
  },
  inputIconBox: {
    marginRight: 10,
  },
  textInputField: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14.5,
    fontFamily: "Inter_500Medium",
    height: "100%",
  },
  eyeBtn: {
    padding: 6,
    marginLeft: 6,
  },
  forgotBtn: {
    alignSelf: "flex-end",
    marginTop: -4,
    marginBottom: 4,
  },
  forgotText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  genderRow: {
    flexDirection: "row",
    gap: 12,
  },
  genderCard: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  genderLabel: {
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(232, 0, 45, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(232, 0, 45, 0.25)",
    borderRadius: 14,
    padding: 13,
    marginBottom: 16,
    gap: 10,
  },
  errorBannerText: {
    flex: 1,
    color: "#FF4D6A",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 200, 100, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(0, 200, 100, 0.25)",
    borderRadius: 14,
    padding: 13,
    marginBottom: 16,
    gap: 10,
  },
  successBannerText: {
    flex: 1,
    color: "#00C864",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  ctaWrapper: {
    borderRadius: 26,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  ctaGradient: {
    height: 54,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaContentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ctaText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    letterSpacing: -0.2,
  },
  loginLegalNotice: {
    paddingHorizontal: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  loginLegalText: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  legalSection: {
    gap: 12,
    marginTop: 4,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  checkboxRowError: {
    backgroundColor: "rgba(232, 0, 45, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(232, 0, 45, 0.35)",
    padding: 8,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxTextContainer: {
    flex: 1,
  },
  checkboxLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  legalLink: {
    fontFamily: "Inter_700Bold",
    textDecorationLine: "underline",
  },
  demoDividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 18,
    paddingHorizontal: 8,
  },
  demoDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  demoDividerText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 12,
    letterSpacing: 1,
  },
  demoModeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 24,
    borderWidth: 1.2,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    marginBottom: 8,
  },
  demoModeBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  inviteBannerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 46, 99, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 46, 99, 0.35)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  inviteBannerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 46, 99, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  inviteBannerTitle: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  inviteBannerSub: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
});

