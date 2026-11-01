import React from "react";
import { View, Text, Pressable, Switch, StyleSheet } from "react-native";
import { LayoutGrid, RotateCcw, Lock } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import { useTabBar } from "@/context/TabBarContext";
import { ModernSection } from "./ModernSection";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { fieldSurface } from "./profileTokens";
import { profileSharedStyles } from "./profileSharedStyles";
import { useTranslation } from "react-i18next";

interface TabBarCustomizerProps {
  theme: AppTheme;
  isLight: boolean;
}

export function TabBarCustomizer({ theme, isLight }: TabBarCustomizerProps) {
  const { t } = useTranslation();
  const { enabledTabs, allTabs, toggleTab, isTabEnabled, resetTabs, maxTabs } = useTabBar();
  const switchTrack = { false: isLight ? "#d1d5db" : "#374151", true: theme.accent };

  return (
    <ModernSection
      title={t("profile.tabBar.title")}
      icon={<LayoutGrid size={18} color={theme.accent} />}
      theme={theme}
      defaultOpen={false}
    >
      <Text style={[profileSharedStyles.sessionHintText, { color: theme.textMuted }]}>
        {t("profile.tabBar.description")}
      </Text>

      {/* Canlı önizleme: alt çubuğun küçük bir kopyası */}
      <View style={profileSharedStyles.inputGroup}>
        <Text style={[profileSharedStyles.fieldLabel, { color: theme.textSecondary }]}>
          {t("profile.tabBar.preview")}
        </Text>
        <View style={[styles.previewBar, { backgroundColor: fieldSurface(theme) }]}>
          {enabledTabs.map((key) => {
            const item = allTabs.find((tab) => tab.key === key);
            if (!item) return null;
            const ItemIcon = item.Icon;
            return (
              <View key={key} style={styles.previewTab}>
                <View style={[styles.previewIconWrap, { backgroundColor: theme.pillAccentBg }]}>
                  <ItemIcon size={16} color={theme.accent} />
                </View>
                <Text style={[styles.previewLabel, { color: theme.textSecondary }]} numberOfLines={1}>
                  {t(item.labelKey)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Sayaç ve sıfırlama */}
      <View style={styles.counterRow}>
        <Text style={[profileSharedStyles.fieldLabel, { color: theme.textSecondary }]}>
          {t("profile.tabBar.selected", { count: enabledTabs.length, max: maxTabs })}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.reset")}
          onPress={resetTabs}
          style={({ pressed }) => [styles.resetBtn, { backgroundColor: theme.pillAccentBg }, pressed && { opacity: 0.7 }]}
        >
          <RotateCcw size={12} color={theme.accent} />
          <Text style={[styles.resetText, { color: theme.accent }]}>{t("common.reset")}</Text>
        </Pressable>
      </View>

      {/* Tüm sayfalar: anahtarla aç / kapat */}
      <SettingsGroup inset theme={theme}>
        {allTabs.map((item) => {
          const isEnabled = isTabEnabled(item.key);
          return (
            <SettingsRow
              key={item.key}
              icon={item.Icon}
              title={t(item.labelKey)}
              subtitle={t(item.descriptionKey)}
              theme={theme}
              trailing={
                item.isMandatory ? (
                  <View style={styles.requiredPill}>
                    <Lock size={10} color={theme.textMuted} />
                    <Text style={[styles.requiredText, { color: theme.textMuted }]}>{t("common.required")}</Text>
                  </View>
                ) : (
                  <Switch
                    value={isEnabled}
                    onValueChange={() => {
                      toggleTab(item.key);
                    }}
                    trackColor={switchTrack}
                    thumbColor="#ffffff"
                  />
                )
              }
            />
          );
        })}
      </SettingsGroup>
    </ModernSection>
  );
}

const styles = StyleSheet.create({
  previewBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 22,
  },
  previewTab: {
    flex: 1,
    alignItems: "center",
    gap: 5,
  },
  previewIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  previewLabel: {
    fontSize: 9.5,
    fontFamily: "Inter_600SemiBold",
    maxWidth: "100%",
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 10,
  },
  resetText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  requiredPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(128,128,128,0.16)",
  },
  requiredText: {
    fontSize: 10.5,
    fontFamily: "Inter_600SemiBold",
  },
});
