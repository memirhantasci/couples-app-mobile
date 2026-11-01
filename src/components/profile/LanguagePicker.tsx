import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Check, Languages } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import type { AppTheme } from "@/lib/theme";
import { useAuth } from "@/context/AuthContext";
import { LANGUAGE_OPTIONS, setAppLanguage, type AppLanguage } from "@/lib/i18n";
import { hapticTap } from "@/lib/soundEffects";
import { ModernSection } from "./ModernSection";
import { SettingsRow } from "./SettingsRow";

interface LanguagePickerProps {
  theme: AppTheme;
  isLight: boolean;
}

/**
 * Uygulama dili seçici (Türkçe / English). Seçim anında uygulanır:
 * i18n.changeLanguage → ekranlar yeniden çizilir, dayjs locale'i güncellenir, tercih saklanır.
 */
export function LanguagePicker({ theme }: LanguagePickerProps) {
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
      defaultOpen={false}
      flush
    >
      {LANGUAGE_OPTIONS.map((option) => {
        const isSelected = i18n.language === option.code;
        return (
          <SettingsRow
            key={option.code}
            leading={<Text style={styles.flag}>{option.flag}</Text>}
            title={option.label}
            onPress={() => handleSelect(option.code)}
            trailing={
              isSelected ? (
                <View style={[styles.check, { backgroundColor: theme.accent }]}>
                  <Check size={13} color="#ffffff" strokeWidth={3} />
                </View>
              ) : (
                <View style={[styles.radio, { borderColor: theme.textMuted }]} />
              )
            }
            theme={theme}
          />
        );
      })}
    </ModernSection>
  );
}

const styles = StyleSheet.create({
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    opacity: 0.5,
  },
  flag: {
    fontSize: 20,
  },
});
