import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { User, Lock, Clock, Sparkles } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import type { CooldownStatus } from "@/lib/cooldown";
import { ModernSection } from "./ModernSection";
import { SegmentedControl } from "./SegmentedControl";
import { SettingsButton } from "./SettingsButton";
import { AMBER, fieldSurface } from "./profileTokens";
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

/** Alanın üstündeki "x gün kaldı" kilit rozeti. */
function LockBadge({ label }: { label: string }) {
  return (
    <View style={styles.badge} accessibilityLabel={label}>
      <Lock size={11} color={AMBER} />
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export function PersonalInfoForm({
  theme,
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
            <LockBadge
              label={t("profile.cooldown.daysLeft", { count: nameCooldown?.remainingDays ?? 0 })}
            />
          )}
        </View>

        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: fieldSurface(theme),
              color: isNameLocked ? theme.textMuted : theme.text,
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

        {isNameLocked ? (
          <View style={styles.hintRow}>
            <Clock size={12} color={theme.textMuted} style={styles.hintIcon} />
            <Text style={[styles.hintText, { color: theme.textMuted }]}>
              {t("profile.cooldown.nameLocked", { count: nameCooldown?.remainingDays ?? 0 })}
            </Text>
          </View>
        ) : nameCooldown?.isInitialFreeRight ? (
          <View style={styles.hintRow}>
            <Sparkles size={12} color={theme.accent} style={styles.hintIcon} />
            <Text style={[styles.hintText, { color: theme.accent }]}>{t("profile.personal.nameFreeChange")}</Text>
          </View>
        ) : (
          <Text style={[styles.hintText, { color: theme.textMuted }]}>{t("profile.personal.nameRule")}</Text>
        )}
      </View>

      {/* 2. Cinsiyet Tercihi */}
      <View style={profileSharedStyles.inputGroup}>
        <View style={styles.labelRow}>
          <Text style={[profileSharedStyles.fieldLabel, { color: theme.textSecondary }]}>
            {t("profile.personal.genderLabel")}
          </Text>
          {isGenderLocked && (
            <LockBadge
              label={t("profile.cooldown.daysLeft", { count: genderCooldown?.remainingDays ?? 0 })}
            />
          )}
        </View>

        <SegmentedControl
          theme={theme}
          value={gender}
          onChange={onSelectGender}
          disabled={isGenderLocked || loading}
          options={[
            { key: "female", label: t("common.gender.female"), emoji: "🌸" },
            { key: "male", label: t("common.gender.male"), emoji: "⚡" },
          ]}
        />

        {isGenderLocked ? (
          <View style={styles.hintRow}>
            <Clock size={12} color={theme.textMuted} style={styles.hintIcon} />
            <Text style={[styles.hintText, { color: theme.textMuted }]}>
              {t("profile.cooldown.genderLocked", { count: genderCooldown?.remainingDays ?? 0 })}
            </Text>
          </View>
        ) : genderCooldown?.isInitialFreeRight ? (
          <View style={styles.hintRow}>
            <Sparkles size={12} color={theme.accent} style={styles.hintIcon} />
            <Text style={[styles.hintText, { color: theme.accent }]}>{t("profile.personal.genderFreeChange")}</Text>
          </View>
        ) : (
          <Text style={[styles.hintText, { color: theme.textMuted }]}>{t("profile.personal.genderRule")}</Text>
        )}
      </View>

      <SettingsButton
        label={t("profile.personal.save")}
        onPress={onSave}
        theme={theme}
        loading={loading}
        disabled={!hasChanges || (isNameLocked && isGenderLocked)}
      />
    </ModernSection>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(255, 179, 0, 0.14)",
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: AMBER,
  },
  textInput: {
    height: 50,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  inputError: {
    borderWidth: 1.5,
    borderColor: "#ff4d6a",
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  hintIcon: {
    marginTop: 2,
  },
  hintText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    flex: 1,
  },
});
