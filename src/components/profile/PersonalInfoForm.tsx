import React from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { User, Lock, Clock, Sparkles } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import type { CooldownStatus } from "@/lib/cooldown";
import { ModernSection } from "./ModernSection";
import { profileSharedStyles } from "./profileSharedStyles";
import { useTranslation } from "react-i18next";

interface PersonalInfoFormProps {
  theme: AppTheme;
  isLight: boolean;
  displayName: string;
  nameError: boolean;
  gender: "male" | "female";
  loading: boolean;
  nameCooldown?: CooldownStatus;
  genderCooldown?: CooldownStatus;
  hasChanges?: boolean;
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
  nameCooldown,
  genderCooldown,
  hasChanges = true,
  onChangeDisplayName,
  onSelectGender,
  onSave,
}: PersonalInfoFormProps) {
  const { t } = useTranslation();
  const fieldBorder = isLight ? theme.cardBorder : "rgba(255,255,255,0.08)";
  const isNameLocked = nameCooldown ? !nameCooldown.canChange : false;
  const isGenderLocked = genderCooldown ? !genderCooldown.canChange : false;

  return (
    <ModernSection
      title={t("profile.personal.title")}
      icon={<User size={18} color={theme.accent} />}
      theme={theme}
      defaultOpen={true}
    >
      {/* 1. Görünen İsim */}
      <View style={profileSharedStyles.inputGroup}>
        <View style={styles.labelRow}>
          <Text style={[profileSharedStyles.fieldLabel, { color: theme.textSecondary }]}>
            {t("profile.personal.nameLabel")}
          </Text>
          {isNameLocked && (
            <View style={[styles.badge, { backgroundColor: "rgba(255, 179, 0, 0.12)", borderColor: "rgba(255, 179, 0, 0.3)" }]}>
              <Lock size={11} color="#FFB300" />
              <Text style={[styles.badgeText, { color: "#FFB300" }]}>
                {t("profile.cooldown.daysLeft", { count: nameCooldown?.remainingDays ?? 0 })}
              </Text>
            </View>
          )}
        </View>

        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: isNameLocked ? (isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)") : theme.unitBg,
              color: isNameLocked ? theme.textMuted : theme.text,
              borderColor: fieldBorder,
            },
            nameError && styles.inputError,
          ]}
          value={displayName}
          onChangeText={onChangeDisplayName}
          placeholder={t("profile.personal.namePlaceholder")}
          placeholderTextColor={theme.textMuted}
          maxLength={50}
          editable={!isNameLocked && !loading}
        />

        {/* İsim Bilgilendirme Notu */}
        <View style={styles.hintContainer}>
          {isNameLocked ? (
            <View style={styles.hintRow}>
              <Clock size={12} color={theme.textMuted} />
              <Text style={[styles.hintText, { color: theme.textMuted }]}>
                {t("profile.cooldown.nameLocked", { count: nameCooldown?.remainingDays ?? 0 })}
              </Text>
            </View>
          ) : nameCooldown?.isInitialFreeRight ? (
            <View style={styles.hintRow}>
              <Sparkles size={12} color={theme.accent} />
              <Text style={[styles.hintText, { color: theme.accent }]}>
                {t("profile.personal.nameFreeChange")}
              </Text>
            </View>
          ) : (
            <Text style={[styles.hintText, { color: theme.textMuted }]}>
              {t("profile.personal.nameRule")}
            </Text>
          )}
        </View>
      </View>

      {/* 2. Cinsiyet Tercihi */}
      <View style={profileSharedStyles.inputGroup}>
        <View style={styles.labelRow}>
          <Text style={[profileSharedStyles.fieldLabel, { color: theme.textSecondary }]}>
            {t("profile.personal.genderLabel")}
          </Text>
          {isGenderLocked && (
            <View style={[styles.badge, { backgroundColor: "rgba(255, 179, 0, 0.12)", borderColor: "rgba(255, 179, 0, 0.3)" }]}>
              <Lock size={11} color="#FFB300" />
              <Text style={[styles.badgeText, { color: "#FFB300" }]}>
                {t("profile.cooldown.daysLeft", { count: genderCooldown?.remainingDays ?? 0 })}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.genderSelectRow}>
          {(["female", "male"] as const).map((g) => {
            const isSelected = gender === g;
            return (
              <TouchableOpacity
                key={g}
                onPress={() => onSelectGender(g)}
                activeOpacity={0.8}
                disabled={isGenderLocked || loading}
                style={[
                  styles.genderBtn,
                  {
                    backgroundColor: theme.unitBg,
                    borderColor: fieldBorder,
                    opacity: isGenderLocked && !isSelected ? 0.45 : 1,
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
                  {g === "female" ? t("common.gender.female") : t("common.gender.male")}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Cinsiyet Bilgilendirme Notu */}
        <View style={styles.hintContainer}>
          {isGenderLocked ? (
            <View style={styles.hintRow}>
              <Clock size={12} color={theme.textMuted} />
              <Text style={[styles.hintText, { color: theme.textMuted }]}>
                {t("profile.cooldown.genderLocked", { count: genderCooldown?.remainingDays ?? 0 })}
              </Text>
            </View>
          ) : genderCooldown?.isInitialFreeRight ? (
            <View style={styles.hintRow}>
              <Sparkles size={12} color={theme.accent} />
              <Text style={[styles.hintText, { color: theme.accent }]}>
                {t("profile.personal.genderFreeChange")}
              </Text>
            </View>
          ) : (
            <Text style={[styles.hintText, { color: theme.textMuted }]}>
              {t("profile.personal.genderRule")}
            </Text>
          )}
        </View>
      </View>

      {/* Kaydet Butonu */}
      <TouchableOpacity
        style={[
          profileSharedStyles.actionSaveBtn,
          { backgroundColor: theme.accent },
          (!hasChanges || (isNameLocked && isGenderLocked)) && { opacity: 0.5 },
        ]}
        onPress={onSave}
        disabled={loading || !hasChanges || (isNameLocked && isGenderLocked)}
        activeOpacity={0.88}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={profileSharedStyles.actionSaveBtnText}>{t("profile.personal.save")}</Text>
        )}
      </TouchableOpacity>
    </ModernSection>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
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
  hintContainer: {
    marginTop: 6,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  hintText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    flex: 1,
  },
});
