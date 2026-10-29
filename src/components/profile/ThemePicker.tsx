import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Palette, Check } from "lucide-react-native";
import { getAvailableThemes, type AppTheme, type ThemeMode } from "@/lib/theme";
import { ModernSection } from "./ModernSection";
import { profileSharedStyles } from "./profileSharedStyles";
import { useTranslation } from "react-i18next";

interface ThemePickerProps {
  theme: AppTheme;
  isLight: boolean;
  gender: "male" | "female";
  themeMode: ThemeMode;
  onSelectTheme: (mode: ThemeMode) => void;
}

export function ThemePicker({ theme, isLight, gender, themeMode, onSelectTheme }: ThemePickerProps) {
  const { t } = useTranslation();
  return (
    <ModernSection
      title={t("profile.theme.title")}
      icon={<Palette size={18} color={theme.accent} />}
      theme={theme}
      defaultOpen={true}
    >
      <View style={{ gap: 10 }}>
        <Text style={[profileSharedStyles.fieldLabel, { color: theme.textSecondary }]}>
          {gender === "female" ? t("profile.theme.femaleModes") : t("profile.theme.maleModes")}
        </Text>

        <View style={styles.themeOptionsContainer}>
          {getAvailableThemes(gender).map((option) => {
            const isSelected = themeMode === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                activeOpacity={0.82}
                onPress={() => {
                  onSelectTheme(option.id);
                }}
                style={[
                  styles.themeOptionCard,
                  {
                    backgroundColor: theme.unitBg,
                    borderColor: isSelected ? theme.accent : (isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)"),
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                {/* Renk Paleti Önizleme */}
                <View style={styles.palettePreviewRow}>
                  <View style={[styles.colorDot, { backgroundColor: option.previewColors[0] }]} />
                  <View style={[styles.colorDot, { backgroundColor: option.previewColors[1] }]} />
                  <View style={[styles.colorDot, { backgroundColor: option.previewColors[2] }]} />
                </View>

                {/* Bilgi */}
                <View style={styles.themeInfoBlock}>
                  <View style={styles.themeTitleRow}>
                    <Text style={[styles.themeOptionTitle, { color: theme.text }]}>
                      {t(option.nameKey)}
                    </Text>
                    {isSelected ? (
                      <View style={[styles.activeThemeCheck, { backgroundColor: theme.accent }]}>
                        <Check size={12} color="#ffffff" strokeWidth={3} />
                      </View>
                    ) : (
                      <View style={[styles.inactiveThemeCheck, { borderColor: isLight ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.2)" }]} />
                    )}
                  </View>
                  <Text style={[styles.themeOptionDesc, { color: theme.textMuted }]}>
                    {t(option.descriptionKey)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ModernSection>
  );
}

const styles = StyleSheet.create({
  themeOptionsContainer: {
    gap: 10,
    marginTop: 4,
  },
  themeOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    borderRadius: 16,
    gap: 12,
  },
  palettePreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 6,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  colorDot: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  themeInfoBlock: {
    flex: 1,
  },
  themeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  themeOptionTitle: {
    fontSize: 14.5,
    fontFamily: "Inter_700Bold",
  },
  themeOptionDesc: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  activeThemeCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  inactiveThemeCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
  },
});
