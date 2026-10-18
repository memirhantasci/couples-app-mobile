import React from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { User } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import { ModernSection } from "./ModernSection";
import { profileSharedStyles } from "./profileSharedStyles";

interface PersonalInfoFormProps {
  theme: AppTheme;
  isLight: boolean;
  displayName: string;
  nameError: boolean;
  gender: "male" | "female";
  loading: boolean;
  onChangeDisplayName: (value: string) => void;
  onSelectGender: (gender: "male" | "female") => void;
  onSave: () => void;
}

export function PersonalInfoForm({
  theme,
  isLight,
  displayName,
  nameError,
  gender,
  loading,
  onChangeDisplayName,
  onSelectGender,
  onSave,
}: PersonalInfoFormProps) {
  const fieldBorder = isLight ? theme.cardBorder : "rgba(255,255,255,0.08)";

  return (
    <ModernSection
      title="Kişisel Bilgiler"
      icon={<User size={18} color={theme.accent} />}
      theme={theme}
      defaultOpen={true}
    >
      <View style={profileSharedStyles.inputGroup}>
        <Text style={[profileSharedStyles.fieldLabel, { color: theme.textSecondary }]}>GÖRÜNEN İSİM</Text>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: theme.unitBg,
              color: theme.text,
              borderColor: fieldBorder,
            },
            nameError && styles.inputError,
          ]}
          value={displayName}
          onChangeText={onChangeDisplayName}
          placeholder="Adınız..."
          placeholderTextColor={theme.textMuted}
          maxLength={50}
        />
      </View>

      <View style={profileSharedStyles.inputGroup}>
        <Text style={[profileSharedStyles.fieldLabel, { color: theme.textSecondary }]}>CİNSİYET TERCİHİ</Text>
        <View style={styles.genderSelectRow}>
          {(["female", "male"] as const).map((g) => {
            const isSelected = gender === g;
            return (
              <TouchableOpacity
                key={g}
                onPress={() => onSelectGender(g)}
                activeOpacity={0.8}
                style={[
                  styles.genderBtn,
                  {
                    backgroundColor: theme.unitBg,
                    borderColor: fieldBorder,
                  },
                  isSelected && {
                    borderColor: theme.accent,
                    backgroundColor: theme.pillAccentBg,
                    borderWidth: 1.5,
                  },
                ]}
              >
                <Text style={{ fontSize: 16 }}>{g === "female" ? "🌸" : "⚡"}</Text>
                <Text
                  style={[
                    styles.genderBtnText,
                    { color: isSelected ? (isLight ? theme.accent : "#ffffff") : theme.textSecondary },
                    isSelected && { fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {g === "female" ? "Kadın" : "Erkek"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TouchableOpacity
        style={[profileSharedStyles.actionSaveBtn, { backgroundColor: theme.accent }]}
        onPress={onSave}
        disabled={loading}
        activeOpacity={0.88}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={profileSharedStyles.actionSaveBtnText}>Değişiklikleri Kaydet</Text>
        )}
      </TouchableOpacity>
    </ModernSection>
  );
}

const styles = StyleSheet.create({
  textInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 14.5,
    fontFamily: "Inter_400Regular",
  },
  inputError: {
    borderColor: "#ff4d6a",
    borderWidth: 1.5,
  },
  genderSelectRow: {
    flexDirection: "row",
    gap: 10,
  },
  genderBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  genderBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.6)",
  },
});
