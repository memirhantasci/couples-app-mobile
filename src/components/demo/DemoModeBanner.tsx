import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Sparkles, ArrowRight } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DemoActionModal } from "./DemoActionModal";
import { useTranslation } from "react-i18next";

/** Şeridin durum çubuğunun altında kalan yüksekliği (kendi içeriği). */
export const DEMO_STRIP_CONTENT_HEIGHT = 30;

/**
 * Demo modunu bildiren ince üst şerit.
 *
 * Eskiden alt gezinme çubuğunun üstünde yüzüyordu ve haritadaki "Yol Tarifi Al", takvimdeki
 * etkinlik kartları gibi etkileşimli alanları örtüyordu. Artık akışın içinde, ekranın tepesinde
 * durur: içeriğin yerini kendisi ayırır, hiçbir şeyin üstüne binmez. Durum çubuğu boşluğunu da
 * şerit üstlendiği için (bkz. `_layout.tsx`) ekranlar kendi üst boşluklarını şeridin altından başlatır.
 */
export function DemoModeBanner() {
  const { t } = useTranslation();
  const { isDemoMode } = useAuth();
  const { theme, isLight } = useTheme();
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);

  if (!isDemoMode) return null;

  return (
    <>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t("demo.banner.a11y")}
      >
        {/* Gradyan durum çubuğu boşluğunu da kaplar: şerit ile üstündeki alan tek parça görünür */}
        <LinearGradient
          colors={isLight ? ["#FFE4EC", "#FFF1F5"] : ["#2A0F1E", "#150C1F"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.strip,
            {
              paddingTop: insets.top,
              height: insets.top + DEMO_STRIP_CONTENT_HEIGHT,
              borderBottomColor: theme.pillAccentBorder,
            },
          ]}
        >
          <View style={styles.left}>
            <Sparkles size={12} color={theme.accent} />
            <Text
              style={[styles.title, { color: isLight ? "#9F1239" : "#FFFFFF" }]}
              numberOfLines={1}
            >
              {t("demo.banner.title")}
            </Text>
            <Text
              style={[styles.subtitle, { color: isLight ? "#BE5A75" : "rgba(255, 255, 255, 0.6)" }]}
              numberOfLines={1}
            >
              {t("demo.banner.subtitle")}
            </Text>
          </View>

          <View style={[styles.cta, { backgroundColor: theme.accent }]}>
            <Text style={styles.ctaText}>{t("auth.signUp")}</Text>
            <ArrowRight size={11} color="#FFFFFF" />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      <DemoActionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={t("demo.banner.promptTitle")}
        description={t("demo.banner.promptDescription")}
      />
    </>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  left: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: 10,
  },
  title: {
    fontSize: 11.5,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.1,
  },
  subtitle: {
    flexShrink: 1,
    fontSize: 10.5,
    fontFamily: "Inter_400Regular",
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 11,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
});
