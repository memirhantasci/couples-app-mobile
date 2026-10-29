import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Languages, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import type { AppTheme } from "@/lib/theme";
import { useAuth } from "@/context/AuthContext";
import { LANGUAGE_OPTIONS, setAppLanguage, type AppLanguage } from "@/lib/i18n";
import { hapticTap } from "@/lib/soundEffects";
import { ModernSection } from "./ModernSection";
import { profileSharedStyles } from "./profileSharedStyles";

interface LanguagePickerProps {
  theme: AppTheme;
  isLight: boolean;
}

/**
 * Uygulama dili seçici (Türkçe / English). Seçim anında uygulanır:
 * i18n.changeLanguage → ekranlar yeniden çizilir, dayjs locale'i güncellenir, tercih saklanır.
 */
export function LanguagePicker({ theme, isLight }: LanguagePickerProps) {
  const { t, i18n } = useTranslation();
  const { isDemoMode } = useAuth();
  const queryClient = useQueryClient();
  const [switching, setSwitching] = useState(false);

  const handleSelect = async (code: AppLanguage) => {
    if (switching || i18n.language === code) return;
    hapticTap();
    setSwitching(true);
    try {
      await setAppLanguage(code);
      // Demo verisi metni sorgu önbelleğinde durduğundan, demo oturumunda yeni dilde yeniden üretilir
      if (isDemoMode) queryClient.invalidateQueries();
    } finally {
      setSwitching(false);
    }
  };

  return (
    <ModernSection
      title={t("language.title")}
      icon={<Languages size={18} color={theme.accent} />}
      theme={theme}
      defaultOpen={true}
    >
      <View style={{ gap: 10 }}>
        <Text style={[profileSharedStyles.fieldLabel, { color: theme.textSecondary }]}>
          {t("language.description")}
        </Text>

        <View style={styles.optionsContainer}>
          {LANGUAGE_OPTIONS.map((option) => {
            const isSelected = i18n.language === option.code;
            return (
              <TouchableOpacity
                key={option.code}
                activeOpacity={0.82}
                disabled={switching}
                onPress={() => handleSelect(option.code)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={option.label}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: theme.unitBg,
                    borderColor: isSelected ? theme.accent : isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)",
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                <Text style={styles.flag}>{option.flag}</Text>
                <Text style={[styles.optionLabel, { color: theme.text }]}>{option.label}</Text>
                {isSelected ? (
                  <View style={[styles.activeCheck, { backgroundColor: theme.accent }]}>
                    <Check size={12} color="#ffffff" strokeWidth={3} />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.inactiveCheck,
                      { borderColor: isLight ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.2)" },
                    ]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ModernSection>
  );
}

const styles = StyleSheet.create({
  optionsContainer: {
    gap: 10,
    marginTop: 4,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    borderRadius: 16,
    gap: 12,
  },
  flag: {
    fontSize: 26,
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  activeCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  inactiveCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
  },
});
