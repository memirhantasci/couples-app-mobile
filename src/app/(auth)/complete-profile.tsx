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
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertCircle, ArrowRight, Sparkles, User as UserIcon } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { encryptStatic } from "@/utils/crypto";

type Gender = "male" | "female";

const GENDER_OPTIONS: { value: Gender; label: string; symbol: string; color: string; bg: string }[] = [
  { value: "female", label: "Kadın", symbol: "♀", color: "#FF4D6D", bg: "rgba(255, 77, 109, 0.14)" },
  { value: "male", label: "Erkek", symbol: "♂", color: "#4D9CFF", bg: "rgba(77, 156, 255, 0.14)" },
];

/**
 * İlk sosyal girişte (Google / Apple) ismi ve cinsiyeti olmayan kullanıcıya gösterilir.
 * useProtectedRoute, profile.needsProfileSetup true olduğu sürece kullanıcıyı buraya yönlendirir.
 */
export default function CompleteProfileScreen() {
  const insets = useSafeAreaInsets();
  const { session, refreshProfile, signOut } = useAuth();
  const userId = session?.user?.id;

  const metadata = session?.user?.user_metadata ?? {};
  const suggestedName = String(metadata.full_name || metadata.name || "").trim();

  // Kullanıcı dokunana kadar öneri (örn. sonradan gelen Apple adı) gösterilir
  const [editedName, setEditedName] = useState<string | null>(null);
  const nameEdited = editedName !== null;
  const name = editedName ?? suggestedName;
  const [gender, setGender] = useState<Gender | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const selected = GENDER_OPTIONS.find((g) => g.value === gender);
  const accent = selected?.color ?? "#FF4D6D";
  const ctaColors = gender === "male"
    ? (["#4D9CFF", "#1B6FD8"] as const)
    : (["#FF3366", "#E8002D", "#C0006B"] as const);

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Lütfen partnerine görünecek ismini yaz.");
      return;
    }
    if (!gender) {
      setError("Lütfen cinsiyetini seç.");
      return;
    }
    if (!userId) {
      setError("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      // Klasik kayıttaki gibi statik anahtarla şifrele: oturum anahtarı eşleşmeyle değişse de isim çözülebilir kalır
      const { data, error: updateError } = await supabase
        .from("users")
        .update({ display_name: encryptStatic(trimmedName), gender })
        .eq("id", userId)
        .select("id");

      if (updateError) throw updateError;
      if (!data || data.length === 0) throw new Error("Profil kaydı bulunamadı.");

      await refreshProfile();
      router.replace("/(setup)/pairing");
    } catch (err: any) {
      setError("Profil kaydedilemedi: " + (err?.message || "Lütfen tekrar dene."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUseAnotherAccount() {
    try {
      await signOut();
    } finally {
      router.replace("/(auth)/login");
    }
  }

  return (
    <LinearGradient colors={["#080811", "#0F0B18", "#080811"]} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Başlık */}
          <View style={styles.header}>
            <View style={[styles.iconCircle, { borderColor: accent }]}>
              <Sparkles size={30} color={accent} />
            </View>
            <Text style={styles.title}>Seni Nasıl Tanıyalım? ✨</Text>
            <Text style={styles.subtitle}>
              Partnerine görüneceğin ismi ve uygulamanın temasını belirleyelim.
            </Text>
          </View>

          {/* İsim */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>PARTNERİNE GÖRÜNECEK İSİM</Text>
            <View style={styles.inputBox}>
              <View style={styles.inputIconBox}>
                <UserIcon size={18} color="rgba(255,255,255,0.45)" />
              </View>
              <TextInput
                value={name}
                onChangeText={(text) => {
                  setEditedName(text);
                  if (error) setError("");
                }}
                placeholder="Örn. Selin"
                placeholderTextColor="rgba(255,255,255,0.25)"
                selectionColor={accent}
                selectTextOnFocus
                maxLength={30}
                autoCorrect={false}
                style={styles.textInput}
              />
            </View>
            <Text style={styles.hint}>
              {suggestedName && !nameEdited
                ? "Hesabından aldık — istediğin gibi değiştirebilirsin."
                : "İstediğin zaman profilinden değiştirebilirsin."}
            </Text>
          </View>

          {/* Cinsiyet */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>CİNSİYETİN</Text>
            <View style={styles.genderRow}>
              {GENDER_OPTIONS.map((option) => {
                const isSelected = gender === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => {
                      setGender(option.value);
                      if (error) setError("");
                    }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.genderCard,
                      isSelected && {
                        borderColor: option.color,
                        backgroundColor: option.bg,
                        borderWidth: 1.5,
                        shadowColor: option.color,
                        shadowOpacity: 0.55,
                        shadowRadius: 16,
                        shadowOffset: { width: 0, height: 0 },
                        elevation: 8,
                      },
                    ]}
                  >
                    <Text style={[styles.genderSymbol, { color: isSelected ? option.color : "rgba(255,255,255,0.35)" }]}>
                      {option.symbol}
                    </Text>
                    <Text style={[styles.genderLabel, isSelected && { color: "#FFFFFF", fontFamily: "Inter_700Bold" }]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {!!error && (
            <View style={styles.errorBanner}>
              <AlertCircle size={18} color="#FF4D6A" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Kaydet */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.88}
            style={[styles.ctaWrapper, { opacity: isSaving ? 0.7 : 1 }]}
          >
            <LinearGradient
              colors={ctaColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={styles.ctaRow}>
                  <Text style={styles.ctaText}>Devam Et</Text>
                  <ArrowRight size={18} color="#FFFFFF" />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleUseAnotherAccount}
            disabled={isSaving}
            activeOpacity={0.7}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>Farklı bir hesapla devam et</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 36,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  inputGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11.5,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    marginBottom: 10,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
  },
  inputIconBox: {
    width: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15.5,
    fontFamily: "Inter_500Medium",
    paddingVertical: 15,
    paddingRight: 16,
  },
  hint: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    marginTop: 8,
    marginLeft: 4,
  },
  genderRow: {
    flexDirection: "row",
    gap: 12,
  },
  genderCard: {
    flex: 1,
    height: 124,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  genderSymbol: {
    fontSize: 40,
    lineHeight: 46,
    fontFamily: "Inter_700Bold",
  },
  genderLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255, 77, 106, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 77, 106, 0.3)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: "#FF4D6A",
    fontSize: 13.5,
    lineHeight: 19,
  },
  ctaWrapper: {
    borderRadius: 18,
    overflow: "hidden",
    marginTop: 4,
  },
  ctaGradient: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  secondaryBtn: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 8,
  },
  secondaryBtnText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
