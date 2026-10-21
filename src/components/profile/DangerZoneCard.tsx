import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Trash2 } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import { ModernSection } from "./ModernSection";

interface DangerZoneCardProps {
  theme: AppTheme;
  isLight: boolean;
  loading: boolean;
  onDeleteAccount: () => void;
}

export function DangerZoneCard({ theme, isLight, loading, onDeleteAccount }: DangerZoneCardProps) {
  return (
    <ModernSection
      title="Hesap Yönetimi & Tehlike Bölgesi"
      icon={<Trash2 size={18} color="#ff4d6a" />}
      theme={theme}
      defaultOpen={false}
    >
      <View style={[styles.dangerNoticeBox, isLight && { backgroundColor: "rgba(255, 77, 106, 0.08)", borderColor: "rgba(255, 77, 106, 0.25)" }]}>
        <Text style={styles.dangerNoticeTitle}>⚠️ KVKK md. 11 Kapsamında Veri İmhası</Text>
        <Text style={[styles.dangerNoticeText, { color: isLight ? "#991B1B" : "rgba(255,255,255,0.7)" }]}>
          Unutulma hakkınız uyarınca hesabınızı sildiğinizde hesabınız, profil fotoğrafınız ve ilişkinize ait tüm ortak fotoğraflar, şifreli mektuplar, günlükler ve veriler 7 günlük cayma süresi sonunda sunucularımızdan kalıcı olarak imha edilir. Bu süre içinde aynı hesapla giriş yaparak vazgeçebilirsiniz.
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
          <Text style={styles.deleteAccountBtnText}>Hesabımı ve Tüm Verileri Sil</Text>
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
