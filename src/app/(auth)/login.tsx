import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Modal,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { navigateAfterAuth } from "@/lib/navigate";
import { registerForPushNotifications } from "@/lib/notifications";
import { useAuth, DEVICE_AUTH_CACHE_KEY } from "@/context/AuthContext";
import { encrypt, decrypt, deterministicEncrypt } from "@/utils/crypto";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { logger } from "@/utils/logger";
import { 
  Eye, EyeOff, Heart, Link, 
  AtSign, Lock, User, Mail, 
  AlertCircle, CheckCircle2, ArrowRight,
  Sparkles
} from "lucide-react-native";
import { getOrCreateDeviceId } from "@/utils/device";
import { isDatesSkipped } from "@/lib/datesSkip";
import { LegalModal } from "@/components/legal/LegalModal";
import { LegalDocType } from "@/constants/legalTexts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as AppleAuthentication from "expo-apple-authentication";
import type { User as SupabaseUser } from "@supabase/supabase-js";

WebBrowser.maybeCompleteAuthSession();

// ─── Social Auth Helpers ─────────────────────────────────────────────────────

/**
 * OAuth dönüş URL'inden oturumu kurar.
 * supabase.ts'te detectSessionInUrl: false olduğu için token'lar URL'den elle ayrıştırılır
 * (implicit flow: couplesapp://auth/callback#access_token=...&refresh_token=...).
 */
async function createSessionFromOAuthUrl(url: string): Promise<SupabaseUser> {
  const [beforeHash, hash = ""] = url.split("#");
  const query = beforeHash.includes("?") ? beforeHash.split("?")[1] : "";
  const params = new URLSearchParams(query);
  new URLSearchParams(hash).forEach((value, key) => params.set(key, value));

  const providerError = params.get("error_description") ?? params.get("error");
  if (providerError) throw new Error(providerError);

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) {
    throw new Error("Oturum bilgisi alınamadı. Lütfen tekrar deneyin.");
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
  if (!data.user) throw new Error("Oturum açılamadı. Lütfen tekrar deneyin.");
  return data.user;
}

/**
 * Klasik girişteki cihaz kuralının aynısı: bu cihaz zaten yetkiliyse true;
 * hesabın hiç yetkili cihazı yoksa (ilk cihaz) otomatik yetkilendirip true;
 * aksi halde false (e-posta OTP doğrulaması gerekir).
 */
async function ensureDeviceAuthorized(userId: string, deviceId: string): Promise<boolean> {
  const { data: auths, error: authError } = await supabase
    .from("device_authorizations")
    .select("is_authorized")
    .eq("user_id", userId)
    .eq("device_id", deviceId)
    .maybeSingle();

  if (authError) return false;
  if (auths) return !!auths.is_authorized;

  const { count, error: countError } = await supabase
    .from("device_authorizations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError || (count ?? 0) > 0) return false;

  await supabase.from("device_authorizations").upsert({
    user_id: userId,
    device_id: deviceId,
    device_name: Platform.OS,
    is_authorized: true,
  });
  return true;
}

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

  // Legal Modal States
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [selectedLegalDoc, setSelectedLegalDoc] = useState<LegalDocType>("kvkk");

  function openLegalDoc(doc: LegalDocType) {
    setSelectedLegalDoc(doc);
    setLegalModalVisible(true);
  }

  // Apple ile giriş yalnızca iOS'ta ve sistem destekliyorsa gösterilir
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    AppleAuthentication.isAvailableAsync()
      .then(setIsAppleAvailable)
      .catch(() => setIsAppleAvailable(false));
  }, []);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Brute Force (AsyncStorage ile kalıcı hale getirilmiştir)
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_SECONDS = 30;
  const BRUTE_FORCE_KEY = "@auth_login_brute_force";

  useEffect(() => {
    async function loadBruteForceState() {
      try {
        const stored = await AsyncStorage.getItem(BRUTE_FORCE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.lockedUntil && parsed.lockedUntil > Date.now()) {
            setLockedUntil(parsed.lockedUntil);
            setLoginAttempts(parsed.attempts || MAX_ATTEMPTS);
          } else if (parsed.attempts && Date.now() - (parsed.lastAttemptAt || 0) < 60000) {
            setLoginAttempts(parsed.attempts);
          } else {
            await AsyncStorage.removeItem(BRUTE_FORCE_KEY);
          }
        }
      } catch (e) {
        // ignore
      }
    }
    loadBruteForceState();
  }, []);

  function isLockedOut(): boolean {
    if (!lockedUntil) return false;
    if (Date.now() < lockedUntil) return true;
    setLockedUntil(null);
    setLoginAttempts(0);
    AsyncStorage.removeItem(BRUTE_FORCE_KEY).catch(() => {});
    return false;
  }

  function registerFailedAttempt() {
    const newAttempts = loginAttempts + 1;
    setLoginAttempts(newAttempts);
    if (newAttempts >= MAX_ATTEMPTS) {
      const lockTime = Date.now() + LOCKOUT_SECONDS * 1000;
      setLockedUntil(lockTime);
      setErrorMsg(`Çok fazla başarısız deneme. ${LOCKOUT_SECONDS} saniye bekle.`);
      AsyncStorage.setItem(
        BRUTE_FORCE_KEY,
        JSON.stringify({ attempts: newAttempts, lockedUntil: lockTime, lastAttemptAt: Date.now() })
      ).catch(() => {});
    } else {
      AsyncStorage.setItem(
        BRUTE_FORCE_KEY,
        JSON.stringify({ attempts: newAttempts, lockedUntil: null, lastAttemptAt: Date.now() })
      ).catch(() => {});
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

      const { data: auths, error: authError } = await supabase
        .from("device_authorizations")
        .select("is_authorized")
        .eq("user_id", userId)
        .eq("device_id", deviceId)
        .maybeSingle();

      let isAuthorized = !authError && !!auths?.is_authorized;

      // If this device is not recorded yet, check if the user has ANY authorized devices at all
      if (!isAuthorized && !authError && !auths) {
        const { count, error: countErr } = await supabase
          .from("device_authorizations")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);

        if (!countErr && (count === 0 || count === null)) {
          // First device ever for this account! Auto-authorize as primary device
          await supabase.from("device_authorizations").upsert({
            user_id: userId,
            device_id: deviceId,
            device_name: Platform.OS,
            is_authorized: true,
          });
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        // Send OTP email while spinner is active on the login button
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: emailToUse,
          options: {
            shouldCreateUser: false,
          },
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
      await AsyncStorage.setItem("last_user_id", userId);
      await AsyncStorage.setItem(DEVICE_AUTH_CACHE_KEY, JSON.stringify({
        userId,
        deviceId,
        isAuthorized: true,
        timestamp: Date.now(),
      }));
      setIsDeviceAuthorized(true);
      setLoginAttempts(0);
      setLockedUntil(null);
      await AsyncStorage.removeItem(BRUTE_FORCE_KEY).catch(() => {});

      // Route user according to couple & profile status
      const { data: userData } = await supabase
        .from("users")
        .select("display_name, couple_id")
        .eq("id", userId)
        .single();

      let couple: any = null;
      if (userData?.couple_id) {
        const { data: cData } = await supabase
          .from("couples")
          .select("meet_date, relationship_start_date")
          .eq("id", userData.couple_id)
          .single();
        if (cData) {
          couple = cData;
        }
      }

      navigateAfterAuth({
        coupleId: userData?.couple_id ?? null,
        meetDate: couple?.meet_date ?? null,
        relationshipStartDate: couple?.relationship_start_date ?? null,
        isPaired: !!userData?.couple_id,
        hasDates: !!couple?.relationship_start_date || (await isDatesSkipped(userId)),
        displayName: userData?.display_name ? decrypt(userData.display_name) : null,
      });
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
        device_name: Platform.OS,
        is_authorized: true,
      });

      await AsyncStorage.setItem("last_user_id", data.user.id);
      await AsyncStorage.setItem(DEVICE_AUTH_CACHE_KEY, JSON.stringify({
        userId: data.user.id,
        deviceId,
        isAuthorized: true,
        timestamp: Date.now(),
      }));
      setIsDeviceAuthorized(true);
    } catch (e: any) {
      setErrorMsg("Beklenmedik bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Social Auth (Google / Apple) ─────────────────────────────────────────

  // Sosyal giriş sonrası cihazı yetkilendirir; profil ve yönlendirme AuthContext + useProtectedRoute'a bırakılır
  // (handleRegister ile aynı yaklaşım — refreshProfile burada eski oturum closure'ı yüzünden profili sıfırlar).
  async function handleSocialSuccess(user: SupabaseUser) {
    const cleanPairingCode =
      regPairingCode.trim().toUpperCase() || activeInviteCode?.trim().toUpperCase() || "";
    if (cleanPairingCode) {
      await AsyncStorage.setItem("@pending_invite_code", cleanPairingCode);
    }

    const deviceId = await getOrCreateDeviceId();
    const isAuthorized = await ensureDeviceAuthorized(user.id, deviceId);

    if (!isAuthorized) {
      // Yeni cihaz: klasik girişteki gibi e-posta OTP doğrulaması iste
      if (!user.email) throw new Error("Hesabınızda doğrulama için e-posta adresi bulunamadı.");

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: { shouldCreateUser: false },
      });
      if (otpError) {
        throw new Error("Cihaz doğrulama kodu gönderilemedi: " + otpError.message);
      }

      setIsDeviceAuthorized(false);
      router.replace({
        pathname: "/(auth)/verify-device",
        params: { userId: user.id, deviceId, email: user.email },
      });
      return;
    }

    await AsyncStorage.setItem("last_user_id", user.id);
    await AsyncStorage.setItem(DEVICE_AUTH_CACHE_KEY, JSON.stringify({
      userId: user.id,
      deviceId,
      isAuthorized: true,
      timestamp: Date.now(),
    }));
    setIsDeviceAuthorized(true);

    // Cinsiyeti olmayan (ilk kez sosyal girişle gelen) kullanıcı önce profilini tamamlar.
    // Dolu ise yönlendirmeyi useProtectedRoute (pairing / dates / home) yapar.
    const { data: profileRow } = await supabase
      .from("users")
      .select("gender")
      .eq("id", user.id)
      .maybeSingle();
    if (profileRow && !profileRow.gender) {
      router.replace("/(auth)/complete-profile");
    }
  }

  async function handleGoogleAuth() {
    if (isLoading) return;
    setErrorMsg("");
    setSuccessMsg("");
    setIsLoading(true);
    try {
      const redirectUrl = Linking.createURL("auth/callback");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Giriş bağlantısı oluşturulamadı.");

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      // Kullanıcı tarayıcıyı kapattıysa sessizce çık
      if (result.type !== "success" || !result.url) return;

      const user = await createSessionFromOAuthUrl(result.url);
      await handleSocialSuccess(user);
    } catch (err: any) {
      setErrorMsg(err?.message || "Google ile giriş yapılırken bir sorun oluştu.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAppleAuth() {
    if (isLoading) return;
    setErrorMsg("");
    setSuccessMsg("");
    setIsLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error("Apple kimlik doğrulaması tamamlanamadı.");
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });
      if (error) throw error;
      if (!data.user) throw new Error("Oturum açılamadı. Lütfen tekrar deneyin.");

      // Apple adı yalnızca ilk girişte verir; profil tamamlama ekranı önerebilsin diye metadata'ya yaz
      if (credential.fullName) {
        const fullName = AppleAuthentication.formatFullName(credential.fullName).trim();
        if (fullName) {
          try {
            await supabase.auth.updateUser({ data: { full_name: fullName } });
          } catch {
            // Öneri kaydedilemezse kullanıcı ismi elle yazar
          }
        }
      }

      await handleSocialSuccess(data.user);
    } catch (err: any) {
      // Kullanıcı Apple penceresini kapattıysa hata gösterme
      if (err?.code !== "ERR_REQUEST_CANCELED") {
        setErrorMsg(err?.message || "Apple ile giriş yapılırken bir sorun oluştu.");
      }
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

      {/* Kayıt formunda alttaki alanlar (Şifre, Partner Kodu) klavyenin altında kalmasın: odaktaki alan otomatik yukarı kayar */}
      <View style={{ flex: 1 }}>
        <KeyboardAwareScrollView
          enableOnAndroid
          extraScrollHeight={30}
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

          {/* ─── Kayıt Modu Yasal Bilgilendirme (tek dokunuşla kabul) ─── */}
          {mode === "register" && (
            <View style={styles.registerLegalNotice}>
              <Text style={styles.loginLegalText}>
                Hesap Oluştur'a ya da Apple / Google ile devam etmeye dokunarak{" "}
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
                  KVKK Aydınlatma Metni
                </Text>
                'ni kabul etmiş sayılırsınız.
              </Text>
            </View>
          )}

          {/* ─── Demo / Keşfet Modu Butonu ─── */}
          <View style={styles.demoDividerContainer}>
            <View style={styles.demoDividerLine} />
            <Text style={styles.demoDividerText}>VEYA</Text>
            <View style={styles.demoDividerLine} />
          </View>

          {/* ─── Sosyal Giriş Butonları ─── */}
          <View style={[styles.socialGroup, isLoading && { opacity: 0.6 }]} pointerEvents={isLoading ? "none" : "auto"}>
            {/* Apple: Apple'ın onaylı native butonu (HIG / App Store uyumlu) */}
            {Platform.OS === "ios" && isAppleAvailable && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  mode === "login"
                    ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                    : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
                }
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={16}
                style={styles.appleButton}
                onPress={handleAppleAuth}
              />
            )}

            <TouchableOpacity
              onPress={handleGoogleAuth}
              disabled={isLoading}
              activeOpacity={0.85}
              style={styles.socialBtn}
            >
              <View style={styles.googleBadge}>
                <Text style={styles.googleBadgeText}>G</Text>
              </View>
              <Text style={styles.socialBtnText}>
                {mode === "login" ? "Google ile Giriş Yap" : "Google ile Devam Et"}
              </Text>
            </TouchableOpacity>
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
        </KeyboardAwareScrollView>
      </View>

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
  registerLegalNotice: {
    marginTop: 14,
    paddingHorizontal: 8,
  },
  socialGroup: {
    gap: 10,
    marginBottom: 14,
  },
  appleButton: {
    width: "100%",
    height: 50,
  },
  socialBtn: {
    height: 50,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  socialBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  googleBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  googleBadgeText: {
    color: "#4285F4",
    fontSize: 14,
    fontWeight: "900",
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

