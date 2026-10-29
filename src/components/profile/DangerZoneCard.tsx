import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Trash2 } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import { ModernSection } from "./ModernSection";
import { useTranslation } from "react-i18next";

interface DangerZoneCardProps {
  theme: AppTheme;
  isLight: boolean;
  loading: boolean;
  onDeleteAccount: () => void;
}

export function DangerZoneCard({ theme, isLight, loading, onDeleteAccount }: DangerZoneCardProps) {
  const { t } = useTranslation();
  return (
    <ModernSection
      title={t("profile.danger.title")}
      icon={<Trash2 size={18} color="#ff4d6a" />}
      theme={theme}
      defaultOpen={false}
    >
      <View style={[styles.dangerNoticeBox, isLight && { backgroundColor: "rgba(255, 77, 106, 0.08)", borderColor: "rgba(255, 77, 106, 0.25)" }]}>
        <Text style={styles.dangerNoticeTitle}>{t("profile.danger.noticeTitle")}</Text>
        <Text style={[styles.dangerNoticeText, { color: isLight ? "#991B1B" : "rgba(255,255,255,0.7)" }]}>
          {t("profile.danger.noticeText")}
        </Text>
      </View>

      <TouchableOpacity
        onPress={onDeleteAccount}
        disabled={loading}
        style={styles.deleteAccountBtn}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#ff4d6a" size="small" />
        ) : (
          <Text style={styles.deleteAccountBtnText}>{t("profile.danger.delete")}</Text>
        )}
      </TouchableOpacity>
    </ModernSection>
  );
}

const styles = StyleSheet.create({
  dangerNoticeBox: {
    backgroundColor: "rgba(255, 77, 106, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 77, 106, 0.25)",
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    gap: 6,
  },
  dangerNoticeTitle: {
    color: "#ff4d6a",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  dangerNoticeText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  deleteAccountBtn: {
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: "rgba(255, 77, 106, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 77, 106, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteAccountBtnText: {
    color: "#ff4d6a",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});
