import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WifiOff } from "lucide-react-native";
import { useIsOffline } from "@/hooks/useIsOffline";
import { useTranslation } from "react-i18next";

/**
 * İnternet bağlantısı koptuğunda ekranın üstünde süzülen ince uyarı.
 * Veriler önbellekten gösterilmeye devam eder; bağlantı gelince sorgular kendiliğinden yenilenir.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const offline = useIsOffline();
  const insets = useSafeAreaInsets();

  if (!offline) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(200)}
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + 6 }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.pill}>
        <WifiOff size={14} color="#FBBF24" />
        <Text style={styles.text}>{t("common.offlineBanner")}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9998,
    elevation: 9998,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(20, 16, 24, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.45)",
  },
  text: {
    color: "#FDE68A",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
