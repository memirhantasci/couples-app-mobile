/**
 * @file welcome.tsx
 * @description Oturumu olmayan kullanıcının karşılama ekranı. Yeni indiren kullanıcı doğrudan örnek
 * (demo) bir çiftin profiline atılmıyordu: önce kendi hesabını açmayı ya da girişi seçer; demo yalnızca
 * "Uygulamayı Keşfet" ile, kullanıcının isteğiyle açılır.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight, Heart, Sparkles } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";
import { APP_NAME } from "@/constants/brand";

const ACCENT = "#FF4D6D";

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { enterDemoMode } = useAuth();

  const handleExplore = () => {
    enterDemoMode();
    router.replace("/(tabs)/home");
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("../../../assets/images/auth-bg.jpg")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        priority="high"
        transition={300}
      />
      <LinearGradient
        colors={["rgba(8, 8, 17, 0.35)", "rgba(8, 8, 17, 0.72)", "rgba(8, 8, 17, 0.94)", "#080811"]}
        locations={[0, 0.4, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }]}>
        <View style={styles.hero}>
          <View style={styles.heroIconWrapper}>
            <LinearGradient colors={[`${ACCENT}33`, `${ACCENT}10`]} style={styles.heroIconGradient}>
              <Heart color={ACCENT} size={34} fill={ACCENT} />
            </LinearGradient>
          </View>
          <Text style={styles.title}>{APP_NAME}</Text>
          <Text style={styles.subtitle}>
            {t("auth.welcome.subtitle")}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => router.push({ pathname: "/(auth)/login", params: { initialMode: "register" } })}
            accessibilityRole="button"
          >
            <LinearGradient
              colors={["#FF3366", "#E8002D", "#C0006B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>{t("auth.createAccount")}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: "/(auth)/login", params: { initialMode: "login" } })}
            style={styles.secondaryBtn}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryBtnText}>{t("auth.signIn")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleExplore}
            style={styles.exploreBtn}
            accessibilityRole="button"
            accessibilityLabel={t("auth.welcome.exploreA11y")}
          >
            <Sparkles size={16} color={ACCENT} style={{ marginRight: 8 }} />
            <Text style={styles.exploreBtnText}>{t("auth.welcome.explore")}</Text>
            <ArrowRight size={15} color={ACCENT} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
          <Text style={styles.exploreHint}>{t("auth.welcome.exploreHint")}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080811" },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: "space-between" },
  hero: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
  heroIconWrapper: {
    width: 84,
    height: 84,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: `${ACCENT}40`,
    overflow: "hidden",
  },
  heroIconGradient: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { color: "#FFFFFF", fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 340,
  },
  actions: { gap: 12 },
  primaryBtn: { height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  secondaryBtn: {
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  secondaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  exploreBtn: {
    height: 48,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: `${ACCENT}44`,
    marginTop: 4,
  },
  exploreBtnText: { color: ACCENT, fontSize: 14, fontWeight: "600" },
  exploreHint: { color: "rgba(255,255,255,0.45)", fontSize: 12, textAlign: "center" },
});
