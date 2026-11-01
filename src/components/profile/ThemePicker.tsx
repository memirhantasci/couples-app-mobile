import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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

export function ThemePicker({ theme, gender, themeMode, onSelectTheme }: ThemePickerProps) {
  const { t } = useTranslation();
  const options = getAvailableThemes(gender);
  const selected = options.find((option) => option.id === themeMode);

  return (
    <ModernSection
      title={t("profile.theme.title")}
      icon={<Palette size={18} color={theme.accent} />}
      theme={theme}
      defaultOpen={true}
    >
      <Text style={[profileSharedStyles.fieldLabel, { color: theme.textSecondary }]}>
        {gender === "female" ? t("profile.theme.femaleModes") : t("profile.theme.maleModes")}
      </Text>

      <View style={styles.row}>
        {options.map((option) => {
          const isSelected = themeMode === option.id;
          const [bg, surface, accent] = option.previewColors;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={t(option.nameKey)}
              onPress={() => onSelectTheme(option.id)}
              style={({ pressed }) => [styles.option, pressed && { opacity: 0.85 }]}
            >
              {/* Temanın gerçek renkleriyle çizilmiş mini ekran */}
              <View
                style={[
                  styles.preview,
                  { borderColor: isSelected ? theme.accent : "transparent" },
                ]}
              >
                <LinearGradient colors={[bg, surface]} style={StyleSheet.absoluteFill} />
                <View style={[styles.miniCard, { backgroundColor: surface }]}>
                  <View style={[styles.miniDot, { backgroundColor: accent }]} />
                  <View style={styles.miniLines}>
                    <View style={[styles.miniLine, { backgroundColor: accent, width: "70%" }]} />
                    <View style={[styles.miniLine, { backgroundColor: accent, opacity: 0.4, width: "45%" }]} />
                  </View>
                </View>
                <View style={[styles.miniButton, { backgroundColor: accent }]} />

                {isSelected ? (
                  <View style={[styles.check, { backgroundColor: theme.accent }]}>
                    <Check size={12} color="#ffffff" strokeWidth={3} />
                  </View>
                ) : null}
              </View>

              <Text
                style={[
                  styles.name,
                  { color: isSelected ? theme.text : theme.textSecondary },
                  isSelected && { fontFamily: "Inter_700Bold" },
                ]}
                numberOfLines={1}
              >
                {t(option.nameKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selected ? (
        <Text style={[profileSharedStyles.sessionHintText, { color: theme.textMuted }]}>
          {t(selected.descriptionKey)}
        </Text>
      ) : null}
    </ModernSection>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
  },
  option: {
    flex: 1,
    gap: 8,
    alignItems: "center",
  },
  preview: {
    width: "100%",
    height: 96,
    borderRadius: 18,
    borderWidth: 2.5,
    overflow: "hidden",
    padding: 8,
    justifyContent: "space-between",
  },
  miniCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 6,
    borderRadius: 9,
  },
  miniDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  miniLines: {
    flex: 1,
    gap: 4,
  },
  miniLine: {
    height: 4,
    borderRadius: 2,
  },
  miniButton: {
    height: 12,
    borderRadius: 6,
  },
  check: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
});
